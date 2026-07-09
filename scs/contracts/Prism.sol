// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/Base64.sol";

interface IERC20 {
  function transfer(address to, uint256 amount) external returns (bool);
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  function balanceOf(address account) external view returns (uint256);
  function allowance(address owner, address spender) external view returns (uint256);
}

// Hedera Token Service (HTS) precompile interface (testnet/mainnet share the same precompile)
// https://github.com/hashgraph/hedera-smart-contracts/blob/main/contracts/system-contracts/hedera-token-service/IHederaTokenService.sol
interface IHederaTokenService {
  function associateToken(address account, address token) external returns (int64);
}
// Hedera Account Service (HAS) precompile interface (testnet/mainnet share the same precompile)
// https://github.com/hashgraph/hedera-smart-contracts/blob/main/contracts/system-contracts/hedera-account-service/IHederaAccountService.sol
interface IHederaAccountService {
  function isAuthorized(address account, bytes memory message, bytes memory signature) external returns (int64 responseCode, bool authorized);
}

/**
prism.market prediction market smart contract
*/
contract Prism {
  // For USDC addresses, see: https://www.circle.com/multi-chain-usdc/hedera
  IERC20 public immutable collateralToken;

  IHederaTokenService constant HTS = IHederaTokenService(address(0x167));
  IHederaAccountService constant HAS = IHederaAccountService(address(0x16a));

  address owner;
  address oracle;
  address dao;
  mapping(address => bool) public associatedTokens;

  mapping(uint128 => string) public statements;
  mapping(uint128 => uint8) public outcomes; // 0 = NO wins, 1 = YES wins, 2 = EmergClose5050
  mapping(uint128 => uint256) public resolutionTimes;
  mapping(uint128 => uint256) public totalCollateralUsd;
  mapping(uint128 => uint256) public totalYesTokensOutstanding;
  mapping(uint128 => uint256) public totalNoTokensOutstanding;
  
  mapping(uint128 => mapping(address => uint256)) public yesTokens;
  mapping(uint128 => mapping(address => uint256)) public noTokens;

  uint256 public marketCreationFeeUsdc;
  uint256 public collateralTokenNdecimals;
  uint256 internal rakePercentScaled100;

  // events in alphabetical order:
  event DaoUpdated(address newDao);
  event MarketResolved(uint128 marketId, uint8 outcome);
  event OracleUpdated(address newOracle);
  event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled, bool primarySecondary);
  event RakeUpdated(uint256 newRakePercentScaled100);
  event TokenAssociated(address indexed token);
  event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);

  /**
  Smart contract contructor to initialize the contract with the specified collateral token.
  @param _collateralToken The address of the ERC20 token to be used as collateral (e.g., USDC).
  */
  constructor(address _collateralToken) {
    collateralToken = IERC20(_collateralToken);
    owner = msg.sender;
    oracle = msg.sender;
    dao = msg.sender;

    marketCreationFeeUsdc = 100000; // defaults to 0.10 USDC (6 decimals)
    collateralTokenNdecimals = 6;   // defaults to 6
    rakePercentScaled100 = 200; // defaults to 2%
  }

  /**
  Function to create a new prediction market with a unique market ID and statement.
  @param marketId The unique identifier for the new market.
  @param _statement The statement or question for the prediction market.

  @return allowance The remaining allowance of the collateral token for the market creator.
  */
  function createNewMarket(uint128 marketId, string memory _statement) public onlyOwner returns (uint256 allowance) {
    require(keccak256(abi.encodePacked(statements[marketId])) == keccak256(abi.encodePacked("")), "Market already exists");
    
    // Two steps process: Pull the fee into the contract first, then forward it to the owner.
    // Hedera rejects owner-to-owner self transfers, so we avoid a direct
    // msg.sender -> owner transfer here even when the owner is the caller
    // eventually, can remove onlyOwner guard and allow any user to create a market, but for now, only the owner can create markets.
    require(collateralToken.transferFrom(msg.sender, address(this), marketCreationFeeUsdc), "Transfer failed");
    require(collateralToken.transfer(owner, marketCreationFeeUsdc), "Fee transfer failed");
    
    statements[marketId] = _statement;
    resolutionTimes[marketId] = 0;
    totalCollateralUsd[marketId] = 0;
    totalYesTokensOutstanding[marketId] = 0;
    totalNoTokensOutstanding[marketId] = 0;

    return collateralToken.allowance(msg.sender, address(this));
  }

  function setMarketCreationFee(uint256 _marketCreationFeeUsdc) external onlyOwner {
    marketCreationFeeUsdc = _marketCreationFeeUsdc; // including nDecimals
  }

  /**
  posColToksOnBehalfAtomic - (atomically) allocate position/collateral tokens on behalf of two users
  This function allows the CLOB to initiate the buying of YES and NO position tokens atomically on behalf of two accounts "yes" and "no".
  Requires --optimize flag due to size of the call stack
  See: api/server/services/hedera.go `params := hiero.NewContractFunctionParameters()....`
  @param marketId The ID of the market
  @param signerSlot0 The signing address of slot 0 (positive-price leg)
  @param signerSlot1 The signing address of slot 1 (negative-price leg)
  @param collateralUsdAbsScaledSlot0 Slot 0 collateral amount (scaled)
  @param collateralUsdAbsScaledSlot1 Slot 1 collateral amount (scaled)
  @param qtyScaledSlot0 Slot 0 quantity (scaled)
  @param qtyScaledSlot1 Slot 1 quantity (scaled)
  @param txIdSlot0 txId of slot 0
  @param txIdSlot1 txId of slot 1
  @param sigObjSlot0 The signatureObject (includes key type) for slot 0
  @param sigObjSlot1 The signatureObject (includes key type) for slot 1
  @param primarySecondarySlot0 True if slot 0 is secondary (sell), false if primary (buy)
  @param primarySecondarySlot1 True if slot 1 is secondary (sell), false if primary (buy)
  @return yes The updated number of YES position tokens held by signerSlot0
  @return no The updated number of NO position tokens held by signerSlot0
  */
  function posColToksOnBehalfAtomic(
    uint128 marketId,
    address signerSlot0,
    address signerSlot1,
    uint256 collateralUsdAbsScaledSlot0,
    uint256 collateralUsdAbsScaledSlot1,
    uint256 qtyScaledSlot0,
    uint256 qtyScaledSlot1,
    uint128 txIdSlot0,
    uint128 txIdSlot1,
    bytes calldata sigObjSlot0,
    bytes calldata sigObjSlot1,
    bool primarySecondarySlot0,
    bool primarySecondarySlot1
  ) external onlyOwner returns (uint256 yes, uint256 no, uint256 yes2, uint256 no2) {
    require(resolutionTimes[marketId] == 0, "Market resolved");
    require(bytes(statements[marketId]).length > 0, "No market statement has been set");

    // calculate the lower collateral amount:
    uint256 collateralUsdAbsScaled_lower = 0; // the lower of the two collateral amounts
    if (collateralUsdAbsScaledSlot0 < collateralUsdAbsScaledSlot1) {
      collateralUsdAbsScaled_lower = collateralUsdAbsScaledSlot0;
    } else {
      collateralUsdAbsScaled_lower = collateralUsdAbsScaledSlot1; // always transfer the lower amount of collateral (partial match)
    }

    uint256 qty_lower = 0; // the lower of the two qty amounts
    if (qtyScaledSlot0 < qtyScaledSlot1) {
      qty_lower = qtyScaledSlot0;
    } else {
      qty_lower = qtyScaledSlot1;
    }

    // Apply an invariant here
    // Enforce 1:1 settlement units between collateral and position token quantity.
    require(collateralUsdAbsScaled_lower == qty_lower, "Collateral/qty mismatch");

    // On-chain signature verification mirrors payload assembly in API/web:
    // buySell byte is slot-position-based (slot0=0xf0, slot1=0xf1) because the
    // API/frontend derives it from price sign (positive=0xf0, negative=0xf1)
    // and slot0 always carries the positive leg, slot1 always carries the negative leg.
    // primarySecondary suffix is derived from the actual order type boolean.
    require(
      isAuthorized(
        signerSlot0,
        assemblePayload(0xf0 /* slot0 = positive price = buy prefix */, collateralUsdAbsScaledSlot0, signerSlot0, marketId, txIdSlot0, primarySecondarySlot0 ? 0xf1 : 0xf0),
        sigObjSlot0
      ),
      "isAuthorized slot0 failed"
    );
    require(
      isAuthorized(
        signerSlot1,
        assemblePayload(0xf1 /* slot1 = negative price = sell prefix */, collateralUsdAbsScaledSlot1, signerSlot1, marketId, txIdSlot1, primarySecondarySlot1 ? 0xf1 : 0xf0),
        sigObjSlot1
      ),
      "isAuthorized slot1 failed"
    );

    /*
    Settlement semantics (README-aligned) with sign-ordered slots:
    - signerSlot0 is the positive-price leg
    - signerSlot1 is the negative-price leg

    Token side per slot:
    - positive+primary  => buy YES
    - positive+secondary=> sell NO
    - negative+primary  => buy NO
    - negative+secondary=> sell YES
    */

    // positive-price slot (signerSlot0)
    if (primarySecondarySlot0) {
      // positive+secondary => SELL NO
      require(noTokens[marketId][signerSlot0] >= qty_lower, "Insufficient NO tokens");
      noTokens[marketId][signerSlot0] -= qty_lower;
      totalNoTokensOutstanding[marketId] -= qty_lower;
      require(collateralToken.transfer(signerSlot0, collateralUsdAbsScaled_lower), "Transfer to NO seller failed");
      totalCollateralUsd[marketId] -= collateralUsdAbsScaled_lower;
    } else {
      // positive+primary => BUY YES
      require(collateralToken.transferFrom(signerSlot0, address(this), collateralUsdAbsScaled_lower), "Transfer from YES buyer failed");
      yesTokens[marketId][signerSlot0] += qty_lower; // 1:1 mapping of collateral qty to position tokens
      totalYesTokensOutstanding[marketId] += qty_lower;
      totalCollateralUsd[marketId] += collateralUsdAbsScaled_lower;
    }

    // negative-price slot (signerSlot1)
    if (primarySecondarySlot1) {
      // negative+secondary => SELL YES
      require(yesTokens[marketId][signerSlot1] >= qty_lower, "Insufficient YES tokens");
      yesTokens[marketId][signerSlot1] -= qty_lower;
      totalYesTokensOutstanding[marketId] -= qty_lower;
      require(collateralToken.transfer(signerSlot1, collateralUsdAbsScaled_lower), "Transfer to YES seller failed");
      totalCollateralUsd[marketId] -= collateralUsdAbsScaled_lower;
    } else {
      // negative+primary => BUY NO
      require(collateralToken.transferFrom(signerSlot1, address(this), collateralUsdAbsScaled_lower), "Transfer from NO buyer failed");
      noTokens[marketId][signerSlot1] += qty_lower; // 1:1 mapping of collateral qty to position tokens
      totalNoTokensOutstanding[marketId] += qty_lower;
      totalCollateralUsd[marketId] += collateralUsdAbsScaled_lower;
    }

    emit PositionTokensPurchased(marketId, signerSlot0, collateralUsdAbsScaled_lower, qtyScaledSlot0, primarySecondarySlot0);
    emit PositionTokensPurchased(marketId, signerSlot1, collateralUsdAbsScaled_lower, qtyScaledSlot1, primarySecondarySlot1);

    return (yesTokens[marketId][signerSlot0], noTokens[marketId][signerSlot0], yesTokens[marketId][signerSlot1], noTokens[marketId][signerSlot1]); // return current balances
  }

  /**
  This function allows users to redeem their winning position tokens for collateral after the market has been resolved.
  A user (msg.sender) can only access their own winnings after the market is resolved
  @param marketId The ID of the market for which the user wants to redeem their winnings.
  @return amountUSDC The amount of collateral (in USDC) redeemed by the user
  */
  function redeem(uint128 marketId) external returns (uint256 amountUSDC) {
    return redeemInternal(marketId, msg.sender);
  }

  /**
  An admin-only function to redeem winnings on behalf of a user
  Can be used in cases where the user is unable to call the redeem function themselves
  This function would require the admin to provide a valid signature from the user authorizing the redemption
  @param marketId The ID of the market for the user the admin wants to redeem for
  @param user_account The address of the user whose winnings are being redeemed
  @return amountUSDC The amount of collateral (in USDC) redeemed by the user
  */
  function redeemOnBehalfOfUser(uint128 marketId, address user_account) external onlyOwner returns (uint256 amountUSDC) {
    return redeemInternal(marketId, user_account);
  }

  /**
  An internal-only function for redeeming winnings for a specific user on a specific marketId.
  Resolved winners receive their pro-rata share of the market's remaining collateral based on
  their winning token balance. As claims are processed, both the remaining pot and the remaining
  winning-token supply are reduced so the market drains to zero once all winners redeem.
  @param marketId The ID of the market for which the user wants to redeem their winnings
  @param winner The address of the user whose winnings are being redeemed
  @return amountUSDC The amount of collateral (in USDC) redeemed by the user
  */
  function redeemInternal(uint128 marketId, address winner) internal returns (uint256 amountUSDC) {
    require(resolutionTimes[marketId] > 0, "Not resolved yet");

    uint256 yesBalance = yesTokens[marketId][winner];
    uint256 noBalance = noTokens[marketId][winner];
    uint256 claimUnits;
    uint256 totalClaimUnits;
    if (outcomes[marketId] == 1) { // YES outcome
      claimUnits = yesBalance;
      totalClaimUnits = totalYesTokensOutstanding[marketId];
    } else if (outcomes[marketId] == 0) { // NO outcome
      claimUnits = noBalance;
      totalClaimUnits = totalNoTokensOutstanding[marketId];
    } else if (outcomes[marketId] == 2) { // EmergClose5050 outcome - all outstanding position tokens share the remaining market pot.
      claimUnits = yesBalance + noBalance;
      totalClaimUnits = totalYesTokensOutstanding[marketId] + totalNoTokensOutstanding[marketId];
    } else {
      revert("Invalid market outcome");
    }

    require(claimUnits > 0, "No winning tokens");
    require(totalClaimUnits >= claimUnits, "Winning supply mismatch");
    require(totalCollateralUsd[marketId] > 0, "No market collateral");

    uint256 grossWinnings;
    if (claimUnits == totalClaimUnits) {
      grossWinnings = totalCollateralUsd[marketId];
    } else {
      grossWinnings = (totalCollateralUsd[marketId] * claimUnits) / totalClaimUnits;
    }
    require(grossWinnings > 0, "No claimable collateral");

    // send the rake
    uint256 rakeAmount = (grossWinnings * rakePercentScaled100) / 10000;
    uint256 payoutAmount = grossWinnings - rakeAmount;

    // Ensure the real token balance can support payout, not just internal accounting.
    uint256 contractBalance = collateralToken.balanceOf(address(this));
    require(contractBalance >= totalCollateralUsd[marketId], "Collateral accounting mismatch");

    require(collateralToken.transfer(owner, rakeAmount), "Rake transfer failed");
    
    // Transfer (remaining, after rake) collateral 1:1
    require(collateralToken.transfer(winner, payoutAmount), "Collateral transfer failed");

    // Clear balances and reduce outstanding position-token supply.
    if (yesBalance > 0) {
      totalYesTokensOutstanding[marketId] -= yesBalance;
      yesTokens[marketId][winner] = 0;
    }
    if (noBalance > 0) {
      totalNoTokensOutstanding[marketId] -= noBalance;
      noTokens[marketId][winner] = 0;
    }

    // Reduce the remaining market pot by the claimant's gross share so the final winner drains the market.
    totalCollateralUsd[marketId] -= grossWinnings;
    
    emit WinningsRedeemed(marketId, winner, payoutAmount /* excluding rake */);

    return payoutAmount; // payoutAmount === amountUSDC (1:1 mapping after rake)
  }

  /**
  Sweep any residual market collateral to the owner after the post-resolution waiting period.
  Under normal winner redemption flow, totalCollateralUsd should reach zero before this path is needed.
  This function exists as a recovery path for abandoned or otherwise unclaimed markets.
  */
  function claimCollateralAfterOneYear(uint128 marketId) external onlyOwner {
    require(resolutionTimes[marketId] > 0, "Not resolved yet");
    require(block.timestamp >= resolutionTimes[marketId] + 365 days + 1 days, "Too early to claim collateral");

    uint256 remainingCollateral = totalCollateralUsd[marketId];
    require(remainingCollateral > 0, "No collateral to claim");

    // Transfer remaining collateral to owner
    require(collateralToken.transfer(owner, remainingCollateral), "Transfer failed");

    // Clear total collateral for the market
    totalCollateralUsd[marketId] = 0;
  }

  /**
  This function allows the oracle to resolve the market by specifying the outcome (YES or NO)
  @param marketId The ID of the market to be resolved.
  @param noYes A boolean indicating the outcome of the market: true for YES wins, false for NO wins.
  */
  function resolveMarket(uint128 marketId, bool noYes) external onlyOracle {
    require(resolutionTimes[marketId] == 0, "Already resolved");

    outcomes[marketId] = noYes ? 1 : 0; // 1 = YES wins, 0 = NO wins
    resolutionTimes[marketId] = block.timestamp;
   
    emit MarketResolved(marketId, noYes ? 1 : 0);
  }

  /////
  // DAO-only functions
  /////

  /**
  Function to set the rake percentage scaled by 100.
  @param _rakePercentScaled100 The new rake percentage scaled by 100 (e.g., 200 = 2%).
  */
  function setRakeScaled100(uint256 _rakePercentScaled100) external onlyDao {
    require(_rakePercentScaled100 <= 10000, "Rake cannot exceed 100%");
    rakePercentScaled100 = _rakePercentScaled100;
    emit RakeUpdated(_rakePercentScaled100);
  }

  /**
  Function to set the DAO address
  Note: be extremely careful calling this function
  Note: Transferring control to the wrong address could result in loss of funds or a broken contract if the new DAO address does not have the expected functionality to manage the contract properly
  @param _dao The new address of the DAO
  */
  function setDao(address _dao) external onlyDao {
    require(_dao != address(0), "DAO cannot be zero address");
    dao = _dao;
    emit DaoUpdated(_dao);
  }

  /**
  Function to set the Oracle address
  Note: be extremely careful calling this function
  Note: Transferring control to the wrong address could result in loss of funds or a broken contract if the new Oracle address does not have the expected functionality to manage the contract properly
  @param _oracle The new address of the Oracle
  */
  function setOracle(address _oracle) external onlyDao {
    require(_oracle != address(0), "Oracle cannot be zero address");
    oracle = _oracle;
    emit OracleUpdated(_oracle);
  }

  /**
  Function to emergency close a market and return funds 50/50 to YES and NO token holders.
  @param marketId The ID of the market to be closed.
  */
  function emergencyCloseMarket5050(uint128 marketId) external onlyDao {
    require(resolutionTimes[marketId] == 0, "Market already resolved");

    resolutionTimes[marketId] = block.timestamp;
    outcomes[marketId] = 2; // emergency close with 50/50 payout (EmergClose5050)

    emit MarketResolved(marketId, 2);
  }


  /////
  // Read-only functions
  /////

  /**
  Retrieve the number of YES and NO position tokens held by a user for a specific market.
  @param marketId The ID of the market.
  @param user The address of the user whose tokens are being queried.
  @return yes The number of YES position tokens held by the user.
  @return no The number of NO position tokens held by the user.
  */
  function getUserTokens(uint128 marketId, address user) external view returns (uint256 yes, uint256 no) {
    return (yesTokens[marketId][user], noTokens[marketId][user]);
  }

  /**
  Get the total collateral for a specific market.
  @param marketId The ID of the market.
  @return amountUSDC The total amount of collateral deposited in the specified market.
  */
  function getTotalCollateral(uint128 marketId) external view returns (uint256 amountUSDC) {
    return totalCollateralUsd[marketId];
  }

  /////
  // HCS functions
  /////

  /**
  An internal-only function which determines if a signatureMap object is valid for the given message and account.
  It is assumed that the signature is composed of a possibly complex cryptographic key.
  @param account The account to check the signature against (a 20 byte identifier)
  @param message The original plaintext data or payload that the signature is derived from. This is the information that was signed to produce the signature.
  @param signatureMap A byte-encoded serialized signature (see buildSignatureMap .ts) to check against
  @return responseCode The response code for the status of the request.  SUCCESS is 22.
  See: https://docs.hedera.com/hedera/core-concepts/smart-contracts/system-smart-contracts/hedera-account-service#isauthorizedraw-address-messagehash-signatureblob
  */
  function isAuthorized(address account, bytes memory message, bytes memory signatureMap) internal returns (bool) {
    (int64 responseCode, bool authorized) = HAS.isAuthorized(account, message, signatureMap);
    require(responseCode == 22, "isAuthorized failed");
    return authorized;
  }

  /**
  Associate the specified token with the contract using the Hedera Token Service precompile.
  It can only be called by the contract owner.
  @param tokenAddress The address of the token to be associated with the contract.
  */
  function associateToken(address tokenAddress) external onlyOwner {
    (int64 responseCode) = HTS.associateToken(address(this), tokenAddress);
    require(responseCode == 22, "Association not successful");

    associatedTokens[tokenAddress] = true;
    emit TokenAssociated(tokenAddress);
  }

  /////
  // utility functions
  /////

  /**
  An internal-only function which takes a base64-encoded message has and prefixes it with the Hedera Signed Message header.
  N.B. the length of the base64-encoded keccak256 hash is always 44 characters.
  @param messageHashBase64 The base64 message to be prefixed.
  @return The prefixed message as bytes.
  */
  function prefixMessageFixed(string memory messageHashBase64) internal pure returns (bytes memory) {
    return abi.encodePacked("\x19Hedera Signed Message:\n44", messageHashBase64);
  }

  /**
  This internal-only function takes the USDC collateral amount, market ID, and transaction ID and assembles them together
  Then calculates the keccak256 hash of the assembled payload
  Then it converts the keccak hash to a base64-encoded string (which will have a fixed length of 44 characters)
  Finally, it prefixes the base64-encoded string with the Hedera Signed Message header (using a hard-coded input string length of 44 characters)
  */
  function assemblePayload(uint8 buySell, uint256 collateralUsd, address evmAddr, uint128 marketId, uint128 txId, uint8 primarySecondary) internal pure returns (bytes memory) {
    // note: when using encodePacked, a bool gets encoded to 0x00 or 0x01 - this zero prefix prevents an odd register length
    bytes memory assembled = abi.encodePacked(buySell, collateralUsd, evmAddr, marketId, txId, primarySecondary);
    bytes32 keccak = keccak256(assembled);

    string memory base64 = Base64.encode(abi.encodePacked(keccak));

    bytes memory prefixedKeccak64 = prefixMessageFixed(base64);

    return prefixedKeccak64;
  }

  /////
  // Guards
  /////

  /**
  Only contract owner guard
  */
  modifier onlyOwner() {
    require(msg.sender == owner, "Only direct user calls are allowed for this function");
    _;
  }

  /**
  Only Oracle guard
  */
  modifier onlyOracle() {
    require(msg.sender == oracle, "Only oracle can call this function");
    _;
  }

  /**
  Only DAO guard
  */
  modifier onlyDao() {
    require(msg.sender == dao, "Only DAO can call this function");
    _;
  }
}
