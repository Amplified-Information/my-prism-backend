// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/Base64.sol";

interface IERC20 {
  function transfer(address to, uint256 amount) external returns (bool);
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  function balanceOf(address account) external view returns (uint256);
  function allowance(address owner, address spender) external view returns (uint256);
  // function approve(address spender, uint256 amount) external returns (bool);
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

// oraclePubkeys = [
//   "302a300506032b6570032100b4c8cfcaaea7e1d9e8fbbacfa1cbbacfa1cbbacfa1cbbacfa1cbbac",
//   "302a300506032b6570032100a3dcbdbfbdcd9e8f8fbbacfa1cbbacfa1cbbacfa1cbbacfa1cbbac",
//   "asdfasdfasd"
// ]

/**
prism.market prediction market smart contract
Authors: ionneb
*/
contract Prism {
  // For USDC addresses, see: https://www.circle.com/multi-chain-usdc/hedera
  IERC20 public immutable collateralToken;

  IHederaTokenService constant HTS = IHederaTokenService(address(0x167));
  IHederaAccountService constant HAS = IHederaAccountService(address(0x16a));

  address owner;
  mapping(address => bool) public associatedTokens;

  mapping(uint128 => bool) public usedTxIds; // to prevent replay attacks

  mapping(uint128 => string) public statements;
  mapping(uint128 => bool) public outcomes;               // true = YES wins, false = NO wins
  mapping(uint128 => uint256) public resolutionTimes;
  mapping(uint128 => uint256) public totalCollateralUsd;
  
  mapping(uint128 => mapping(address => uint256)) public yesTokens;
  mapping(uint128 => mapping(address => uint256)) public noTokens;

  uint256 public marketCreationFeeUsdc;
  uint256 public collateralTokenNdecimals;
  
  // Note: must also update the database scheme (event_* tables)
  event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled, bool primarySecondary);
  event MarketResolved(uint128 marketId, bool outcome);
  event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);
  event TokenAssociated(address indexed token);
  // event AccountAuthorizationResponse(int64 responseCode, address account, bool response);

  /**
  Smart contract contructor to initialize the contract with the specified collateral token.
  @param _collateralToken The address of the ERC20 token to be used as collateral (e.g., USDC).
  */
  constructor(address _collateralToken) {
    collateralToken = IERC20(_collateralToken);
    owner = msg.sender;

    marketCreationFeeUsdc = 100000; // defaults to 0.10 USDC (6 decimals)
    collateralTokenNdecimals = 6;   // defaults to 6
  }

  /**
  Function to create a new prediction market with a unique market ID and statement.
  @param marketId The unique identifier for the new market.
  @param _statement The statement or question for the prediction market.

  @return allowance The remaining allowance of the collateral token for the market creator.
  */
  function createNewMarket(uint128 marketId, string memory _statement) public returns (uint256 allowance) { // TODO: uint8 txFee - configure fees per-market?
    require(keccak256(abi.encodePacked(statements[marketId])) == keccak256(abi.encodePacked("")), "Market already exists");
    
    // transfer the market creation fee from the owner to the contract
    // msg.sender must provide an allowance for this amount of USDC or this entire function call will fail
    require(collateralToken.transferFrom(msg.sender, address(this), marketCreationFeeUsdc), "Transfer failed");
    
    statements[marketId] = _statement;
    resolutionTimes[marketId] = 0;
    totalCollateralUsd[marketId] = 0;

    return collateralToken.allowance(msg.sender, address(this));
  }

  function setMarketCreationFee(uint256 _marketCreationFeeUsdc) external onlyOwner {
    marketCreationFeeUsdc = _marketCreationFeeUsdc; // including nDecimals
  }

  /**
  -> posColToksOnBehalfAtomic <- (atomically) allocate position/collateral tokens on behalf of two users
  This function allows the CLOB to initiate the buying of YES and NO position tokens atomically on behalf of two accounts "yes" and "no".
  Requires --optimize flag due to size of the call stack
  See: api/server/services/hedera.go `params := hiero.NewContractFunctionParameters()....`
  @param marketId The ID of the market
  @param signerYes The (signing) address of the account buying YES position tokens
  @param signerNo The (signing) address of the account buying NO position tokens
  @param collateralUsdAbsScaledYes Yes side amount of collateral (in USDC) to be used for purchasing position tokens (scaled to the number of collatoral token decimal places).
  @param collateralUsdAbsScaledNo  No side amount of collateral (in USDC) to be used for purchasing position tokens (scaled to the number of collatoral token decimal places).
  @param qtyScaledYes The quantity of YES position tokens to buy (scaled up to the number of collateral token decimal places)
  @param qtyScaledNo The quantity of NO position tokens to buy (scaled up to the number of collateral token decimal places)
  @param txIdYes txId of the Yes side 
  @param txIdNo txId of the No side
  @param sigObjYes The signatureObject (includes the key type) of the YES transaction
  @param sigObjNo The signatureObject (includes the key type) of the NO transaction
  @param primarySecondaryYes A boolean indicating whether this is a primary or secondary market transaction for the YES side
  @param primarySecondaryNo A boolean indicating whether this is a primary or secondary market transaction for the NO side
  @return yes The updated number of YES position tokens held by the signerYes account
  @return no The updated number of NO position tokens held by the signerNo account
  */
  function posColToksOnBehalfAtomic(
    uint128 marketId,
    address signerYes,
    address signerNo,
    uint256 collateralUsdAbsScaledYes, // need to send Yes and No collateral amounts for sig verification
    uint256 collateralUsdAbsScaledNo,
    uint256 qtyScaledYes,
    uint256 qtyScaledNo,
    // uint256 priceUsdAbsScaledYes,
    // uint256 priceUsdAbsScaledNo,
    uint128 txIdYes,
    uint128 txIdNo,
    bytes calldata sigObjYes,
    bytes calldata sigObjNo,
    bool primarySecondaryYes,
    bool primarySecondaryNo
  ) external onlyOwner returns (uint256 yes, uint256 no, uint256 yes2, uint256 no2) {
    require(resolutionTimes[marketId] == 0, "Market resolved");
    require(bytes(statements[marketId]).length > 0, "No market statement has been set");

    // calculate the lower collateral amount:
    uint256 collateralUsdAbsScaled_lower = 0; // the lower of the two collateral amounts
    if (collateralUsdAbsScaledYes < collateralUsdAbsScaledNo) {
      collateralUsdAbsScaled_lower = collateralUsdAbsScaledYes;
    } else {
      collateralUsdAbsScaled_lower = collateralUsdAbsScaledNo; // always transfer the lower amount of collateral (partial match)
    }

    uint256 qty_lower = 0; // the lower of the two qty amounts
    if (qtyScaledYes < qtyScaledNo) {
      qty_lower = qtyScaledYes;
    } else {
      qty_lower = qtyScaledNo;
    }

    // on-chain signature verifiaction using an on-chain assembled payload (check the original values at order entry):
    require(isAuthorized(signerYes, assemblePayload(0xf0 /* YES MUST have this prefix */, collateralUsdAbsScaledYes, signerYes, marketId, txIdYes, primarySecondaryYes ? 0xf1 : 0xf0 /* true => secondary (0xf1), false => primary (0xf0) */), sigObjYes), "isAuthorized YES failed");
    require(isAuthorized(signerNo,  assemblePayload(0xf1 /* NO MUST have this prefix */,  collateralUsdAbsScaledNo,  signerNo,  marketId, txIdNo, primarySecondaryNo ? 0xf1 : 0xf0 /* true => secondary (0xf1), false => primary (0xf0) */),  sigObjNo),  "isAuthorized NO failed");


    /*
    primarySecondaryYes	| primarySecondaryNo	| Collateral flow
    --------------------|---------------------|-----------------
    false	              | false	              | both deposit → contract
    true	              | false	              | NO buyer deposits → contract pays YES seller
    false	              | true	              | YES buyer deposits → contract pays NO seller
    true	              | true	              | contract pays both sellers
    */

    // YES side: primary = buyer deposits collateral and receives YES tokens
    //           secondary = seller surrenders YES tokens and receives collateral
    if (primarySecondaryYes) {
      // Secondary: signerYes is selling YES tokens back for collateral
      require(yesTokens[marketId][signerYes] >= qty_lower, "Insufficient YES tokens");
      yesTokens[marketId][signerYes] -= qty_lower;
      require(collateralToken.transfer(signerYes, collateralUsdAbsScaled_lower), "Transfer to YES seller failed");
      totalCollateralUsd[marketId] -= collateralUsdAbsScaled_lower;
    } else {
      // Primary: signerYes is buying YES tokens with collateral
      require(collateralToken.transferFrom(signerYes, address(this), collateralUsdAbsScaled_lower), "Transfer from YES buyer failed");
      yesTokens[marketId][signerYes] += qty_lower;                  // 1:1 mapping of collateral qty to position tokens
      totalCollateralUsd[marketId] += collateralUsdAbsScaled_lower;
    }

    // NO side: primary = buyer deposits collateral and receives NO tokens
    //          secondary = seller surrenders NO tokens and receives collateral
    if (primarySecondaryNo) {
      // Secondary: signerNo is selling NO tokens back for collateral
      require(noTokens[marketId][signerNo] >= qty_lower, "Insufficient NO tokens");
      noTokens[marketId][signerNo] -= qty_lower;
      require(collateralToken.transfer(signerNo, collateralUsdAbsScaled_lower), "Transfer to NO seller failed");
      totalCollateralUsd[marketId] -= collateralUsdAbsScaled_lower;
    } else {
      // Primary: signerNo is buying NO tokens with collateral
      require(collateralToken.transferFrom(signerNo, address(this), collateralUsdAbsScaled_lower), "Transfer from NO buyer failed");
      noTokens[marketId][signerNo] += qty_lower;                    // 1:1 mapping of collateral qty to position tokens
      totalCollateralUsd[marketId] += collateralUsdAbsScaled_lower;
    }

    emit PositionTokensPurchased(marketId, signerYes, collateralUsdAbsScaled_lower, qtyScaledYes, primarySecondaryYes);
    emit PositionTokensPurchased(marketId, signerNo, collateralUsdAbsScaled_lower, qtyScaledNo, primarySecondaryNo);

    return (yesTokens[marketId][signerYes] , noTokens[marketId][signerYes], yesTokens[marketId][signerNo] , noTokens[marketId][signerNo]); // return current balances
  }
  
  /**
  This function allows users to redeem their winning position tokens for collateral after the market has been resolved.
  A user (msg.sender) can only access their own winnings after the market is resolved
  @param marketId The ID of the market for which the user wants to redeem their winnings.
  @return amountUSDC The amount of collateral (in USDC) redeemed by the user
  */
  function redeem(uint128 marketId) external returns (uint256 amountUSDC) {
    require(resolutionTimes[marketId] > 0, "Not resolved yet");
    
    uint256 nTokens = outcomes[marketId] ? yesTokens[marketId][msg.sender] : noTokens[marketId][msg.sender];
    require(nTokens > 0, "No winning tokens");

    // TODO - 2% profit redeem fee...
    // TODO - 1% profit fee for the market makers - TODO: how do we keep track of market makers?
    // collateralToken.transfer(owner, nTokens * 1/50);
    // collateralToken.transfer(msg.sender, nTokens * 49/50);

    // Transfer collateral 1:1
    require(collateralToken.transfer(msg.sender, nTokens), "Transfer failed");

    // Clear balances
    if (yesTokens[marketId][msg.sender] > 0 ) yesTokens[marketId][msg.sender] = 0;
    if (noTokens[marketId][msg.sender] > 0 ) noTokens[marketId][msg.sender] = 0;

    // don't forget to reduce totalCollateral
    totalCollateralUsd[marketId] = totalCollateralUsd[marketId] - nTokens;
    
    emit WinningsRedeemed(marketId, msg.sender, nTokens);

    return nTokens; // nTokens === amountUSDC (1:1 mapping)
  }

  /**
  This function allows the oracle to resolve the market by specifying the outcome (YES or NO)
  @param marketId The ID of the market to be resolved.
  @param noYes A boolean indicating the outcome of the market: true for YES wins, false for NO wins.
  */
  function resolveMarket(uint128 marketId, bool noYes) external onlyOracle {
    require(resolutionTimes[marketId] == 0, "Already resolved");

    outcomes[marketId] = noYes;
    resolutionTimes[marketId] = block.timestamp;
   
    emit MarketResolved(marketId, noYes);
  }

  // TODO - handle unresolved markets - user gets their USDC back (minus fees)

  /**
  TODO - implement this function
  */
  // function redeemOnBehalfOfUser(uint128 marketId, address user_account) external view onlyOwner returns (uint256 amountUSDC) {
  //     // transfer - this costs gas - prism.market would pay the gas
  //     return 0;
  // }

  // TODO - function for Prism to claim collateral tokens after 1 year + 1 day?

  // TODO - implement an admin function to freeze a particular market?
  // is suspending/freezing the orderbook sufficient, making this function unnecessary?

  // TODO - implement storage pruning...

  // TODO - implement an admin function close a market and return funds 50/50 to YES and NO token holders respectively

    


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
    // emit AccountAuthorizationResponse(responseCode, account, authorized);
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
    require(msg.sender == owner /* TODO - change to Oracle address */, "Only oracle can call this function");
    _;
  }
}
