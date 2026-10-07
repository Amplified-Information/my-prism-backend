// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

interface IHederaAccountServiceV2 {
    function isAuthorized(address account, bytes memory message, bytes memory signature)
        external
        returns (int64 responseCode, bool authorized);
}

interface IHederaTokenServiceV2 {
    function associateToken(address account, address token) external returns (int64 responseCode);
}

/// @title PrismV2
/// @notice Complete-set prediction-market custody and settlement for a trusted CLOB operator.
/// @dev Position and collateral quantities use the collateral token's smallest unit. A complete
///      YES + NO set always has a gross redemption value of exactly one collateral unit per share.
contract PrismV2 is Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    uint8 public constant AUTHORIZATION_VERSION = 2;
    uint256 public constant PRICE_SCALE = 1_000_000;
    uint16 public constant MAX_RAKE_BPS = 1_000;
    int64 internal constant HEDERA_SUCCESS = 22;
    IHederaAccountServiceV2 internal constant HAS =
        IHederaAccountServiceV2(address(0x16a));
    IHederaTokenServiceV2 internal constant HTS =
        IHederaTokenServiceV2(address(0x167));

    bytes32 public constant AUTHORIZATION_TYPEHASH = keccak256(
        "PrismAuthorization(uint8 version,uint256 chainId,address verifyingContract,address signer,uint128 marketId,uint128 txId,uint8 side,uint8 action,uint256 limitYesPrice,uint256 qtyShares,uint256 collateralCap,uint64 deadline)"
    );

    enum Side {
        YES,
        NO
    }

    enum Action {
        BUY,
        SELL
    }

    enum MarketState {
        UNINITIALIZED,
        OPEN,
        HALTED,
        CLOSED,
        RESOLVED_YES,
        RESOLVED_NO,
        VOID
    }

    struct Authorization {
        uint8 version;
        uint256 chainId;
        address verifyingContract;
        address signer;
        uint128 marketId;
        uint128 txId;
        Side side;
        Action action;
        uint256 limitYesPrice;
        uint256 qtyShares;
        uint256 collateralCap;
        uint64 deadline;
    }

    struct FillState {
        uint256 shares;
        uint256 collateral;
    }

    struct Market {
        MarketState state;
        uint64 closeTime;
        uint16 rakeBps;
        uint256 reserve;
        uint256 totalYes;
        uint256 totalNo;
    }

    IERC20 public collateralToken;
    address public owner;
    address public pendingOwner;
    address public operator;
    address public oracle;
    address public dao;
    uint16 public defaultRakeBps;
    uint256 public aggregateReserved;

    mapping(uint128 marketId => Market market) public markets;
    mapping(uint128 marketId => string statement) public statements;
    mapping(uint128 marketId => mapping(address account => uint256 balance)) public yesBalance;
    mapping(uint128 marketId => mapping(address account => uint256 balance)) public noBalance;
    mapping(bytes32 authorizationHash => FillState fill) public fills;
    mapping(address signer => mapping(uint128 txId => bytes32 authorizationHash)) public authorizationByNonce;
    mapping(address signer => mapping(uint128 txId => bool canceled)) public canceled;
    mapping(bytes32 matchId => bool executed) public executedMatches;

    uint256 private _reentrancyStatus;

    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address indexed operator);
    event OracleUpdated(address indexed oracle);
    event DaoUpdated(address indexed dao);
    event DefaultRakeUpdated(uint16 rakeBps);
    event CollateralTokenAssociated(address indexed token);
    event MarketCreated(uint128 indexed marketId, uint64 closeTime, uint16 rakeBps, string statement);
    event MarketStateChanged(uint128 indexed marketId, MarketState state);
    event AuthorizationCanceled(address indexed signer, uint128 indexed txId);
    event AuthorizationFilled(
        bytes32 indexed authorizationHash,
        uint128 indexed marketId,
        address indexed signer,
        uint256 fillShares,
        uint256 fillCollateral,
        uint256 cumulativeShares,
        uint256 cumulativeCollateral
    );
    event MatchSettled(
        bytes32 indexed matchId,
        uint128 indexed marketId,
        uint256 fillShares,
        uint256 executionYesPrice,
        uint256 yesCollateral,
        uint256 noCollateral
    );
    event Redeemed(uint128 indexed marketId, address indexed account, uint256 gross, uint256 fee, uint256 net);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAuthorization();
    error InvalidMarketState();
    error InvalidPairing();
    error InvalidPrice();
    error InvalidFill();
    error LimitPriceViolated();
    error AuthorizationCanceledError();
    error SignatureRejected();
    error TokenAssociationFailed(int64 responseCode);
    error MatchAlreadyExecuted();
    error InsufficientPosition();
    error Insolvent();
    error UnsupportedCollateralBehavior();
    error ReentrantCall();

    /// @dev Locks the implementation. PrismProxy performs initialization atomically in its constructor.
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address collateralToken_,
        address owner_,
        address operator_,
        address oracle_,
        address dao_,
        uint16 defaultRakeBps_
    ) external initializer {
        if (
            collateralToken_ == address(0) || collateralToken_ == address(this) || !_isValidRole(owner_)
                || !_isValidRole(operator_) || !_isValidRole(oracle_) || !_isValidRole(dao_)
        ) revert InvalidAddress();
        if (defaultRakeBps_ > MAX_RAKE_BPS) revert InvalidAuthorization();

        collateralToken = IERC20(collateralToken_);
        // A functional probe catches zero, EOA and wrong-network addresses while
        // remaining compatible with Hedera token redirect contracts.
        collateralToken.balanceOf(address(this));
        owner = owner_;
        operator = operator_;
        oracle = oracle_;
        dao = dao_;
        defaultRakeBps = defaultRakeBps_;
        _reentrancyStatus = 1;

        emit OwnershipTransferred(address(0), owner_);
        emit OperatorUpdated(operator_);
        emit OracleUpdated(oracle_);
        emit DaoUpdated(dao_);
        emit DefaultRakeUpdated(defaultRakeBps_);
    }

    /// @notice Associates the proxy account with its configured Hedera collateral token.
    /// @dev Must be called on the proxy before it can receive USDC. The implementation is
    ///      intentionally locked and must never be associated instead of the proxy.
    function associateCollateralToken() external onlyOwner {
        int64 responseCode = HTS.associateToken(address(this), address(collateralToken));
        if (responseCode != HEDERA_SUCCESS) revert TokenAssociationFailed(responseCode);
        emit CollateralTokenAssociated(address(collateralToken));
    }

    function createMarket(uint128 marketId, string calldata statement, uint64 closeTime) external onlyOwner {
        if (markets[marketId].state != MarketState.UNINITIALIZED) revert InvalidMarketState();
        if (bytes(statement).length == 0 || closeTime <= block.timestamp) revert InvalidAuthorization();

        markets[marketId] = Market({
            state: MarketState.OPEN,
            closeTime: closeTime,
            rakeBps: defaultRakeBps,
            reserve: 0,
            totalYes: 0,
            totalNo: 0
        });
        statements[marketId] = statement;
        emit MarketCreated(marketId, closeTime, defaultRakeBps, statement);
    }

    function haltMarket(uint128 marketId) external onlyOwnerOrOracle {
        Market storage market = markets[marketId];
        if (market.state != MarketState.OPEN) revert InvalidMarketState();
        market.state = MarketState.HALTED;
        emit MarketStateChanged(marketId, MarketState.HALTED);
    }

    function resumeMarket(uint128 marketId) external onlyOwner {
        Market storage market = markets[marketId];
        if (market.state != MarketState.HALTED || block.timestamp >= market.closeTime) {
            revert InvalidMarketState();
        }
        market.state = MarketState.OPEN;
        emit MarketStateChanged(marketId, MarketState.OPEN);
    }

    function closeMarket(uint128 marketId) external {
        Market storage market = markets[marketId];
        if (
            (market.state != MarketState.OPEN && market.state != MarketState.HALTED)
                || block.timestamp < market.closeTime
        ) revert InvalidMarketState();
        market.state = MarketState.CLOSED;
        emit MarketStateChanged(marketId, MarketState.CLOSED);
    }

    function resolveMarket(uint128 marketId, bool yesWon) external onlyOracle {
        Market storage market = markets[marketId];
        if (
            (market.state != MarketState.OPEN && market.state != MarketState.HALTED
                && market.state != MarketState.CLOSED) || block.timestamp < market.closeTime
        ) revert InvalidMarketState();
        market.state = yesWon ? MarketState.RESOLVED_YES : MarketState.RESOLVED_NO;
        emit MarketStateChanged(marketId, market.state);
    }

    /// @notice Voids a market. Each YES or NO share receives 0.5 collateral, with no rake.
    /// @dev The oracle may void early when an event is canceled before its scheduled close.
    function voidMarket(uint128 marketId) external onlyOracle {
        Market storage market = markets[marketId];
        if (
            (market.state != MarketState.OPEN && market.state != MarketState.HALTED
                && market.state != MarketState.CLOSED)
        ) revert InvalidMarketState();
        market.state = MarketState.VOID;
        emit MarketStateChanged(marketId, MarketState.VOID);
    }

    function settle(
        Authorization calldata a,
        bytes calldata signatureA,
        Authorization calldata b,
        bytes calldata signatureB,
        uint256 fillShares,
        uint256 executionYesPrice,
        bytes32 matchId
    ) external onlyOperator nonReentrant {
        if (matchId == bytes32(0) || executedMatches[matchId]) revert MatchAlreadyExecuted();
        if (a.marketId != b.marketId || a.signer == b.signer) revert InvalidPairing();

        Market storage market = markets[a.marketId];
        if (market.state != MarketState.OPEN || block.timestamp >= market.closeTime) {
            revert InvalidMarketState();
        }
        if (fillShares == 0 || executionYesPrice == 0 || executionYesPrice >= PRICE_SCALE) {
            revert InvalidPrice();
        }

        bytes32 hashA = _validateAuthorization(a, signatureA, executionYesPrice);
        bytes32 hashB = _validateAuthorization(b, signatureB, executionYesPrice);
        uint256 yesCollateral = Math.mulDiv(fillShares, executionYesPrice, PRICE_SCALE);
        uint256 noCollateral = fillShares - yesCollateral;
        if (yesCollateral == 0 || noCollateral == 0) revert InvalidFill();

        _consume(a, hashA, fillShares, a.side == Side.YES ? yesCollateral : noCollateral);
        _consume(b, hashB, fillShares, b.side == Side.YES ? yesCollateral : noCollateral);
        executedMatches[matchId] = true;

        if (a.action == Action.BUY && b.action == Action.BUY && a.side != b.side) {
            _mintCompleteSet(a, b, market, fillShares, yesCollateral, noCollateral);
        } else if (a.action == Action.SELL && b.action == Action.SELL && a.side != b.side) {
            _mergeCompleteSet(a, b, market, fillShares, yesCollateral, noCollateral);
        } else if (a.side == b.side && a.action != b.action) {
            _transferPosition(a, b, fillShares, a.side == Side.YES ? yesCollateral : noCollateral);
        } else {
            revert InvalidPairing();
        }

        _assertSolvent();
        emit MatchSettled(matchId, a.marketId, fillShares, executionYesPrice, yesCollateral, noCollateral);
    }

    function redeem(uint128 marketId) external nonReentrant returns (uint256 net) {
        Market storage market = markets[marketId];
        uint256 gross;
        uint256 fee;

        if (market.state == MarketState.RESOLVED_YES) {
            uint256 shares = yesBalance[marketId][msg.sender];
            if (shares == 0) revert InsufficientPosition();
            yesBalance[marketId][msg.sender] = 0;
            market.totalYes -= shares;
            gross = shares;
            fee = Math.mulDiv(gross, market.rakeBps, 10_000);
        } else if (market.state == MarketState.RESOLVED_NO) {
            uint256 shares = noBalance[marketId][msg.sender];
            if (shares == 0) revert InsufficientPosition();
            noBalance[marketId][msg.sender] = 0;
            market.totalNo -= shares;
            gross = shares;
            fee = Math.mulDiv(gross, market.rakeBps, 10_000);
        } else if (market.state == MarketState.VOID) {
            uint256 yesShares = yesBalance[marketId][msg.sender];
            uint256 noShares = noBalance[marketId][msg.sender];
            if (yesShares + noShares == 0) revert InsufficientPosition();
            yesBalance[marketId][msg.sender] = 0;
            noBalance[marketId][msg.sender] = 0;
            market.totalYes -= yesShares;
            market.totalNo -= noShares;
            gross = (yesShares + noShares) / 2;
            // Assign only indivisible-unit rounding dust to the last claimant.
            if (market.totalYes + market.totalNo == 0) gross = market.reserve;
        } else {
            revert InvalidMarketState();
        }

        if (gross > market.reserve) revert Insolvent();
        market.reserve -= gross;
        aggregateReserved -= gross;
        net = gross - fee;

        if (fee != 0) _pushCollateral(dao, fee);
        _pushCollateral(msg.sender, net);
        _assertSolvent();
        emit Redeemed(marketId, msg.sender, gross, fee, net);
    }

    function cancelAuthorization(uint128 txId) external {
        canceled[msg.sender][txId] = true;
        emit AuthorizationCanceled(msg.sender, txId);
    }

    function authorizationHash(Authorization calldata authorization) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                AUTHORIZATION_TYPEHASH,
                authorization.version,
                authorization.chainId,
                authorization.verifyingContract,
                authorization.signer,
                authorization.marketId,
                authorization.txId,
                authorization.side,
                authorization.action,
                authorization.limitYesPrice,
                authorization.qtyShares,
                authorization.collateralCap,
                authorization.deadline
            )
        );
    }

    /// @notice Exact bytes users sign for HAS verification.
    function authorizationMessage(Authorization calldata authorization) public pure returns (bytes memory) {
        string memory hashBase64 = Base64.encode(abi.encodePacked(authorizationHash(authorization)));
        return abi.encodePacked("\x19Hedera Signed Message:\n44", hashBase64);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (!_isValidRole(newOwner)) revert InvalidAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address oldOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, msg.sender);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (!_isValidRole(newOperator)) revert InvalidAddress();
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    function setOracle(address newOracle) external onlyOwner {
        if (!_isValidRole(newOracle)) revert InvalidAddress();
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    function setDao(address newDao) external onlyOwner {
        if (!_isValidRole(newDao)) revert InvalidAddress();
        dao = newDao;
        emit DaoUpdated(newDao);
    }

    function setDefaultRake(uint16 newRakeBps) external onlyOwner {
        if (newRakeBps > MAX_RAKE_BPS) revert InvalidAuthorization();
        defaultRakeBps = newRakeBps;
        emit DefaultRakeUpdated(newRakeBps);
    }

    function _validateAuthorization(
        Authorization calldata authorization,
        bytes calldata signature,
        uint256 executionYesPrice
    ) internal returns (bytes32 hash) {
        if (
            authorization.version != AUTHORIZATION_VERSION || authorization.chainId != block.chainid
                || authorization.verifyingContract != address(this) || authorization.signer == address(0)
                || authorization.qtyShares == 0
                || (authorization.action == Action.BUY && authorization.collateralCap == 0)
                || authorization.deadline < block.timestamp || authorization.limitYesPrice > PRICE_SCALE
                || canceled[authorization.signer][authorization.txId]
        ) {
            if (canceled[authorization.signer][authorization.txId]) revert AuthorizationCanceledError();
            revert InvalidAuthorization();
        }

        if (
            (authorization.side == Side.YES && authorization.action == Action.BUY
                && executionYesPrice > authorization.limitYesPrice)
                || (authorization.side == Side.YES && authorization.action == Action.SELL
                    && executionYesPrice < authorization.limitYesPrice)
                || (authorization.side == Side.NO && authorization.action == Action.BUY
                    && executionYesPrice < authorization.limitYesPrice)
                || (authorization.side == Side.NO && authorization.action == Action.SELL
                    && executionYesPrice > authorization.limitYesPrice)
        ) revert LimitPriceViolated();

        hash = authorizationHash(authorization);
        if (!_isAuthorized(authorization.signer, authorizationMessage(authorization), signature)) {
            revert SignatureRejected();
        }
    }

    function _consume(
        Authorization calldata authorization,
        bytes32 hash,
        uint256 fillShares,
        uint256 fillCollateral
    ) internal {
        FillState storage fill = fills[hash];
        bytes32 nonceHash = authorizationByNonce[authorization.signer][authorization.txId];
        if (nonceHash == bytes32(0)) {
            authorizationByNonce[authorization.signer][authorization.txId] = hash;
        } else if (nonceHash != hash) {
            revert InvalidAuthorization();
        }
        uint256 cumulativeShares = fill.shares + fillShares;
        uint256 cumulativeCollateral = fill.collateral + fillCollateral;
        if (
            cumulativeShares > authorization.qtyShares
                || (authorization.action == Action.BUY
                    && cumulativeCollateral > authorization.collateralCap)
        ) revert InvalidFill();
        fill.shares = cumulativeShares;
        fill.collateral = cumulativeCollateral;
        emit AuthorizationFilled(
            hash,
            authorization.marketId,
            authorization.signer,
            fillShares,
            fillCollateral,
            cumulativeShares,
            cumulativeCollateral
        );
    }

    function _mintCompleteSet(
        Authorization calldata a,
        Authorization calldata b,
        Market storage market,
        uint256 shares,
        uint256 yesCollateral,
        uint256 noCollateral
    ) internal {
        Authorization calldata yesOrder = a.side == Side.YES ? a : b;
        Authorization calldata noOrder = a.side == Side.NO ? a : b;

        yesBalance[a.marketId][yesOrder.signer] += shares;
        noBalance[a.marketId][noOrder.signer] += shares;
        market.totalYes += shares;
        market.totalNo += shares;
        market.reserve += shares;
        aggregateReserved += shares;

        _pullCollateral(yesOrder.signer, address(this), yesCollateral);
        _pullCollateral(noOrder.signer, address(this), noCollateral);
    }

    function _mergeCompleteSet(
        Authorization calldata a,
        Authorization calldata b,
        Market storage market,
        uint256 shares,
        uint256 yesCollateral,
        uint256 noCollateral
    ) internal {
        Authorization calldata yesOrder = a.side == Side.YES ? a : b;
        Authorization calldata noOrder = a.side == Side.NO ? a : b;
        if (
            yesBalance[a.marketId][yesOrder.signer] < shares
                || noBalance[a.marketId][noOrder.signer] < shares || market.reserve < shares
        ) revert InsufficientPosition();

        yesBalance[a.marketId][yesOrder.signer] -= shares;
        noBalance[a.marketId][noOrder.signer] -= shares;
        market.totalYes -= shares;
        market.totalNo -= shares;
        market.reserve -= shares;
        aggregateReserved -= shares;

        _pushCollateral(yesOrder.signer, yesCollateral);
        _pushCollateral(noOrder.signer, noCollateral);
    }

    function _transferPosition(
        Authorization calldata a,
        Authorization calldata b,
        uint256 shares,
        uint256 collateral
    ) internal {
        Authorization calldata buyer = a.action == Action.BUY ? a : b;
        Authorization calldata seller = a.action == Action.SELL ? a : b;
        if (a.side == Side.YES) {
            if (yesBalance[a.marketId][seller.signer] < shares) revert InsufficientPosition();
            yesBalance[a.marketId][seller.signer] -= shares;
            yesBalance[a.marketId][buyer.signer] += shares;
        } else {
            if (noBalance[a.marketId][seller.signer] < shares) revert InsufficientPosition();
            noBalance[a.marketId][seller.signer] -= shares;
            noBalance[a.marketId][buyer.signer] += shares;
        }
        _pullCollateral(buyer.signer, seller.signer, collateral);
    }

    function _isAuthorized(address account, bytes memory message, bytes calldata signature)
        internal
        virtual
        returns (bool)
    {
        (int64 responseCode, bool authorized) = HAS.isAuthorized(account, message, signature);
        if (responseCode != HEDERA_SUCCESS) revert SignatureRejected();
        return authorized;
    }

    function _assertSolvent() internal view {
        if (collateralToken.balanceOf(address(this)) < aggregateReserved) revert Insolvent();
    }

    /// @dev Reject fee-on-transfer and otherwise non-conserving tokens. A donated surplus must not
    ///      be able to hide a short receipt while new complete sets are being minted.
    function _pullCollateral(address from, address to, uint256 amount) internal {
        uint256 balanceBefore = collateralToken.balanceOf(to);
        collateralToken.safeTransferFrom(from, to, amount);
        if (collateralToken.balanceOf(to) != balanceBefore + amount) {
            revert UnsupportedCollateralBehavior();
        }
    }

    /// @dev Check the contract's debit instead of the recipient's credit so a transfer to a contract
    ///      with unusual token hooks cannot falsify the reserve movement.
    function _pushCollateral(address to, uint256 amount) internal {
        uint256 balanceBefore = collateralToken.balanceOf(address(this));
        collateralToken.safeTransfer(to, amount);
        if (collateralToken.balanceOf(address(this)) + amount != balanceBefore) {
            revert UnsupportedCollateralBehavior();
        }
    }

    function _isValidRole(address account) internal view returns (bool) {
        return account != address(0) && account != address(this);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert Unauthorized();
        _;
    }

    modifier onlyOwnerOrOracle() {
        if (msg.sender != owner && msg.sender != oracle) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus != 1) revert ReentrantCall();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    uint256[40] private __gap;
}
