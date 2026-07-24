// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import "forge-std/Test.sol";

import { Prism } from "../src/Prism.sol";
import { PrismTestHelper } from "./PrismTestHelper.sol";
import { MockERC20 } from "./MockERC20.sol";

contract MockConfigurableERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // 0 = normal, 1 = fail first transfer() call, 2 = fail second transfer() call
    uint8 public failMode;
    uint256 public transferCalls;

    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
    }

    function setFailMode(uint8 mode) external {
        failMode = mode;
        transferCalls = 0;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        transferCalls += 1;
        if (failMode == 1 && transferCalls == 1) return false;
        if (failMode == 2 && transferCalls == 2) return false;

        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ERC20: insufficient allowance");
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");

        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockRejectSelfTransferERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(from != to, "SELF_TRANSFER");

        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ERC20: insufficient allowance");
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");

        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}


contract PrismTest is Test {
    MockERC20 usdc;
    PrismTestHelper prism;
    address owner = address(this);
    address user1 = address(0x1);
    address user2 = address(0x2);
    address oracle = address(this); // owner is oracle for now
    uint256 initialSupply = 1_000_000e6;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6, initialSupply);
        prism = new PrismTestHelper(address(usdc));
        require(usdc.transfer(user1, 100_000e6), "Transfer to user1 failed");
        require(usdc.transfer(user2, 100_000e6), "Transfer to user2 failed");
        usdc.approve(address(prism), type(uint256).max);
        vm.prank(user1); usdc.approve(address(prism), type(uint256).max);
        vm.prank(user2); usdc.approve(address(prism), type(uint256).max);
    }

    // --- Constructor & Owner ---
    function testCollateralTokenIsSet() public view {
        assertEq(address(prism.collateralToken()), address(usdc));
    }
    function testOwnerIsMsgSender() public {
        prism.setMarketCreationFee(123456);
        assertEq(prism.marketCreationFeeUsdc(), 123456);
    }
    function testMarketCreationFeeDefault() public view {
        assertEq(prism.marketCreationFeeUsdc(), 100000);
    }
    function testCollateralTokenNdecimalsDefault() public view {
        assertEq(prism.collateralTokenNdecimals(), 6);
    }

    // --- onlyOwner modifier ---
    function testOnlyOwnerModifier() public {
        vm.prank(user1);
        vm.expectRevert();
        prism.setMarketCreationFee(1);
    }

    // --- createNewMarket ---
    function testCreateNewMarket() public {
        uint128 marketId = 1;
        string memory statement = "Will ETH > $5k?";
        uint256 allowance = prism.createNewMarket(marketId, statement);
        // Returned allowance tracks the owner's allowance after transferFrom in createNewMarket.
        assertEq(allowance, usdc.allowance(owner, address(prism)));
        assertEq(prism.statements(marketId), statement);
        assertEq(prism.resolutionTimes(marketId), 0);
        assertEq(prism.totalCollateralUsd(marketId), 0);
    }

    function testCreateNewMarketAvoidsSelfTransferRevert() public {
        MockRejectSelfTransferERC20 rejectSelfTransferUsdc = new MockRejectSelfTransferERC20("USD Coin", "USDC", 6, initialSupply);
        PrismTestHelper rejectSelfTransferPrism = new PrismTestHelper(address(rejectSelfTransferUsdc));
        rejectSelfTransferUsdc.approve(address(rejectSelfTransferPrism), type(uint256).max);

        uint128 marketId = 6;
        string memory statement = "Will CREATE market avoid Hedera self-transfer?";

        uint256 ownerBalanceBefore = rejectSelfTransferUsdc.balanceOf(owner);
        uint256 allowance = rejectSelfTransferPrism.createNewMarket(marketId, statement);

        assertEq(rejectSelfTransferPrism.statements(marketId), statement);
        assertEq(rejectSelfTransferPrism.resolutionTimes(marketId), 0);
        assertEq(rejectSelfTransferPrism.totalCollateralUsd(marketId), 0);
        assertEq(rejectSelfTransferUsdc.balanceOf(address(rejectSelfTransferPrism)), 0);
        assertEq(rejectSelfTransferUsdc.balanceOf(owner), ownerBalanceBefore);
        assertEq(allowance, rejectSelfTransferUsdc.allowance(owner, address(rejectSelfTransferPrism)));
    }
    function testCreateNewMarketFailsIfExists() public {
        uint128 marketId = 2;
        string memory statement = "Will BTC > $100k?";
        prism.createNewMarket(marketId, statement);
        vm.expectRevert();
        prism.createNewMarket(marketId, statement);
    }

    // --- associateToken (onlyOwner) ---
    function testAssociateTokenOnlyOwner() public {
        // This will revert because the mock does not implement the precompile, but we can check onlyOwner
        vm.prank(user1);
        vm.expectRevert();
        prism.associateToken(address(usdc));
    }

    // --- posColToksOnBehalfAtomic (onlyOwner) ---
    function posColToksOnBehalfAtomic() public {
        uint128 marketId = 3;
        string memory statement = "Will SOL > $500?";
        prism.createNewMarket(marketId, statement);
        // This will revert due to signature and precompile checks, but onlyOwner is enforced
        vm.prank(user1);
        vm.expectRevert();
        prism.posColToksOnBehalfAtomic(marketId, user1, user2, 100e6, 100e6, 100e6, 100e6, 1, 2, hex"", hex"", false, false);
    }

    // --- resolveMarket (onlyOracle) ---
    function testResolveMarketOnlyOracle() public {
        uint128 marketId = 4;
        string memory statement = "Will ADA > $10?";
        prism.createNewMarket(marketId, statement);
        // Only owner/oracle can resolve
        vm.prank(user1);
        vm.expectRevert();
        prism.resolveMarket(marketId, true);
    }

    function testResolveMarketRequiresExistingMarket() public {
        uint128 marketId = 4001;
        vm.expectRevert("No market statement has been set");
        prism.resolveMarket(marketId, true);
    }

    function testEmergencyCloseRequiresExistingMarket() public {
        uint128 marketId = 4002;
        vm.expectRevert("No market statement has been set");
        prism.emergencyCloseMarket5050(marketId);
    }

    function testCreateNewMarketResetsOutcomeToDefault() public {
        uint128 marketId = 4003;
        prism.setOutcomeForTest(marketId, 2);
        prism.createNewMarket(marketId, "Outcome reset check");
        assertEq(prism.outcomes(marketId), 0, "outcome reset to default on create");
    }

    // --- getUserTokens & getTotalCollateral ---
    function testGetUserTokensAndTotalCollateral() public view {
        uint128 marketId = 5;
        (uint256 yes, uint256 no) = prism.getUserTokens(marketId, user1);
        assertEq(yes, 0);
        assertEq(no, 0);
        assertEq(prism.getTotalCollateral(marketId), 0);
    }

    // --- Utility: assemblePayload, prefixMessageFixed ---
    function testAssemblePayloadAndPrefix() public view {
        bool primarySecondary = false; // primary market
        bytes memory payload = prism.exposedAssemblePayload(0xf0, 100e6, address(0x123), 1, 2, primarySecondary);
        assertGt(payload.length, 0);
        bytes memory prefixed = prism.exposedPrefixMessageFixed("abcdeabcdeabcdeabcdeabcdeabcdeabcdeabcdeabcdeabcdeab");
        assertGt(prefixed.length, 0);
    }

    // --- Secondary market tests ---
    //
    // The Hedera Account Service precompile (0x16a) is mocked via vm.mockCall to return
    // responseCode=22 (SUCCESS) and authorized=true for any isAuthorized call.
    //
    // Four cases:
    //   (false, false) - both primary  => already exercised by other tests via expectRevert on onlyOwner
    //   (true,  false) - YES secondary, NO primary
    //   (false, true)  - YES primary,   NO secondary
    //   (true,  true)  - both secondary

    bytes4 constant HAS_SELECTOR = bytes4(keccak256("isAuthorized(address,bytes,bytes)"));

    function _mockHAS() internal {
        vm.mockCall(
            address(0x16a),
            abi.encodePacked(HAS_SELECTOR),
            abi.encode(int64(22), true)
        );
    }

    function _createAndFundMarket(uint128 marketId) internal {
        prism.createNewMarket(marketId, "Test market");
    }

    // Both primary (false, false): user1 buys YES, user2 buys NO
    function testBuyBothPrimary() public {
        uint128 marketId = 10;
        _createAndFundMarket(marketId);
        _mockHAS();

        uint256 qty        = 50e6;
        uint256 collateral = 50e6;

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 user2BalBefore = usdc.balanceOf(user2);

        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            collateral, collateral,
            qty, qty,
            1, 2,
            hex"", hex"",
            false, false
        );

        (uint256 yesUser1, uint256 noUser1) = prism.getUserTokens(marketId, user1);
        (uint256 yesUser2, uint256 noUser2) = prism.getUserTokens(marketId, user2);

        assertEq(yesUser1, qty,  "user1 YES tokens");
        assertEq(noUser1,  0,    "user1 NO tokens");
        assertEq(yesUser2, 0,    "user2 YES tokens");
        assertEq(noUser2,  qty,  "user2 NO tokens");

        assertEq(prism.getTotalCollateral(marketId), 2 * collateral, "total collateral");
        assertEq(usdc.balanceOf(user1), user1BalBefore - collateral, "user1 USDC balance");
        assertEq(usdc.balanceOf(user2), user2BalBefore - collateral, "user2 USDC balance");
    }

    // slot0 primary, slot1 secondary (false, true):
    // slot0 README: +primary => BUY YES. slot1 README: -secondary => SELL YES.
    // user1 (slot0) buys YES tokens; user2 (slot1) sells YES tokens.
    // user2 must already hold YES tokens.
    function testSecondaryYesPrimaryNo() public {
        uint128 marketId = 11;
        _createAndFundMarket(marketId);
        _mockHAS();

        uint256 qty        = 40e6;
        uint256 collateral = 40e6;

        // Give user2 YES tokens and fund the contract with collateral to pay the seller (slot1 secondary)
        prism.setTokensForTest(marketId, user2, qty, 0);
        usdc.transfer(address(prism), collateral);
        prism.setTotalCollateralForTest(marketId, collateral);

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 user2BalBefore = usdc.balanceOf(user2);

        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            collateral, collateral,
            qty, qty,
            3, 4,
            hex"", hex"",
            false, true  // slot0=primary(buy YES), slot1=secondary(sell YES)
        );

        (uint256 yesUser1,) = prism.getUserTokens(marketId, user1);
        (uint256 yesUser2,) = prism.getUserTokens(marketId, user2);

        assertEq(yesUser1, qty, "user1 YES tokens after buying");
        assertEq(yesUser2, 0,   "user2 YES tokens after selling");

        // user1 paid collateral (primary buy); user2 received collateral (secondary sell)
        assertEq(usdc.balanceOf(user1), user1BalBefore - collateral, "user1 USDC balance after buying");
        assertEq(usdc.balanceOf(user2), user2BalBefore + collateral, "user2 USDC balance after selling");

        assertEq(prism.getTotalCollateral(marketId), collateral, "total collateral after");
    }

    // slot0 secondary, slot1 primary (true, false):
    // slot0 README: +secondary => SELL NO. slot1 README: -primary => BUY NO.
    // user1 (slot0) sells NO tokens; user2 (slot1) buys NO tokens.
    function testPrimaryYesSecondaryNo() public {
        uint128 marketId = 12;
        _createAndFundMarket(marketId);
        _mockHAS();

        uint256 qty        = 30e6;
        uint256 collateral = 30e6;

        // Give user1 NO tokens (slot0 secondary: SELL NO) and fund contract to pay the seller
        prism.setTokensForTest(marketId, user1, 0, qty);
        usdc.transfer(address(prism), collateral);
        prism.setTotalCollateralForTest(marketId, collateral);

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 user2BalBefore = usdc.balanceOf(user2);

        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            collateral, collateral,
            qty, qty,
            5, 6,
            hex"", hex"",
            true, false  // slot0=secondary(sell NO), slot1=primary(buy NO)
        );

        (, uint256 noUser1) = prism.getUserTokens(marketId, user1);
        (, uint256 noUser2) = prism.getUserTokens(marketId, user2);

        assertEq(noUser1, 0,   "user1 NO tokens after selling");
        assertEq(noUser2, qty, "user2 NO tokens after buying");

        assertEq(usdc.balanceOf(user1), user1BalBefore + collateral, "user1 USDC balance after selling");
        assertEq(usdc.balanceOf(user2), user2BalBefore - collateral, "user2 USDC balance after buying");

        assertEq(prism.getTotalCollateral(marketId), collateral, "total collateral after");
    }

    // Both secondary (true, true):
    // slot0 README: +secondary => SELL NO. slot1 README: -secondary => SELL YES.
    // slot0 sells NO, slot1 sells YES; contract pays both.
    function testBothSecondary() public {
        uint128 marketId = 13;
        _createAndFundMarket(marketId);
        _mockHAS();

        uint256 qty        = 20e6;
        uint256 collateral = 20e6;

        // Give both users position tokens and fund the contract with 2x collateral
        // slot0(user1): +secondary => SELL NO => needs NO tokens
        // slot1(user2): -secondary => SELL YES => needs YES tokens
        prism.setTokensForTest(marketId, user1, 0, qty);
        prism.setTokensForTest(marketId, user2, qty, 0);
        usdc.transfer(address(prism), 2 * collateral);
        prism.setTotalCollateralForTest(marketId, 2 * collateral);

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 user2BalBefore = usdc.balanceOf(user2);

        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            collateral, collateral,
            qty, qty,
            7, 8,
            hex"", hex"",
            true, true  // both secondary
        );

        (, uint256 noUser1) = prism.getUserTokens(marketId, user1);
        (uint256 yesUser2,) = prism.getUserTokens(marketId, user2);

        assertEq(noUser1,  0, "user1 NO tokens after selling");
        assertEq(yesUser2, 0, "user2 YES tokens after selling");

        assertEq(usdc.balanceOf(user1), user1BalBefore + collateral, "user1 USDC balance after selling");
        assertEq(usdc.balanceOf(user2), user2BalBefore + collateral, "user2 USDC balance after selling");

        assertEq(prism.getTotalCollateral(marketId), 0, "total collateral after both sell");
    }

    // slot0 secondary (+secondary = SELL NO); insufficient NO tokens should revert
    function testSecondaryYesInsufficientTokensReverts() public {
        uint128 marketId = 14;
        _createAndFundMarket(marketId);
        _mockHAS();

        uint256 qty = 50e6;

        // user1 (slot0, +secondary) holds only 10e6 NO tokens but needs 50e6
        prism.setTokensForTest(marketId, user1, 0, 10e6);
        usdc.transfer(address(prism), qty);
        prism.setTotalCollateralForTest(marketId, qty);

        vm.expectRevert("Insufficient NO tokens");
        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            qty, qty,
            qty, qty,
            9, 10,
            hex"", hex"",
            true, false
        );
    }

    // slot1 secondary (-secondary = SELL YES); insufficient YES tokens should revert
    function testSecondaryNoInsufficientTokensReverts() public {
        uint128 marketId = 15;
        _createAndFundMarket(marketId);
        _mockHAS();

        uint256 qty = 50e6;

        // user2 (slot1, -secondary) holds only 5e6 YES tokens but needs 50e6
        prism.setTokensForTest(marketId, user2, 5e6, 0);
        usdc.transfer(address(prism), qty);
        prism.setTotalCollateralForTest(marketId, qty);

        vm.expectRevert("Insufficient YES tokens");
        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            qty, qty,
            qty, qty,
            11, 12,
            hex"", hex"",
            false, true
        );
    }

    // Settlement invariant: lower collateral and lower qty must match.
    function testSettlementInvariantCollateralQtyMismatchReverts() public {
        uint128 marketId = 17;
        _createAndFundMarket(marketId);
        _mockHAS();

        // lower(collateral)=49e6, lower(qty)=50e6 -> invariant violation
        vm.expectRevert("Collateral/qty mismatch");
        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            49e6, 60e6,
            50e6, 70e6,
            13, 14,
            hex"", hex"",
            false, false
        );
    }

    // Settlement invariant positive case: lower collateral equals lower qty.
    function testSettlementInvariantCollateralQtyMatchPasses() public {
        uint128 marketId = 18;
        _createAndFundMarket(marketId);
        _mockHAS();

        // lower(collateral)=50e6 and lower(qty)=50e6 -> invariant satisfied
        prism.posColToksOnBehalfAtomic(
            marketId, user1, user2,
            50e6, 60e6,
            50e6, 70e6,
            15, 16,
            hex"", hex"",
            false, false
        );

        (uint256 yesUser1, uint256 noUser1) = prism.getUserTokens(marketId, user1);
        (uint256 yesUser2, uint256 noUser2) = prism.getUserTokens(marketId, user2);
        assertEq(yesUser1, 50e6, "user1 YES tokens after matched buy");
        assertEq(noUser1, 0, "user1 NO tokens after matched buy");
        assertEq(yesUser2, 0, "user2 YES tokens after matched buy");
        assertEq(noUser2, 50e6, "user2 NO tokens after matched buy");
        assertEq(prism.getTotalCollateral(marketId), 100e6, "total collateral tracks matched amount on both legs");
    }

    // --- setRakeScaled100 ---

    function testSetRakeScaled100() public {
        prism.setRakeScaled100(500);
        assertEq(prism.getRakePercentScaled100(), 500);
    }

    function testSetRakeScaled100DefaultIs200() public view {
        assertEq(prism.getRakePercentScaled100(), 200);
    }

    function testSetRakeScaled100AtMax() public {
        prism.setRakeScaled100(10000); // 100%
        assertEq(prism.getRakePercentScaled100(), 10000);
    }

    function testSetRakeScaled100ToZero() public {
        prism.setRakeScaled100(0);
        assertEq(prism.getRakePercentScaled100(), 0);
    }

    function testSetRakeScaled100ExceedsMaxReverts() public {
        vm.expectRevert("Rake cannot exceed 100%");
        prism.setRakeScaled100(10001);
    }

    function testSetRakeScaled100NonOwnerReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        prism.setRakeScaled100(500);
    }

    // --- DAO/oracle role management ---

    function testSetDaoOnlyDaoRevertsForNonDao() public {
        vm.prank(user1);
        vm.expectRevert("Only DAO can call this function");
        prism.setDao(user2);
    }

    function testSetDaoZeroAddressReverts() public {
        vm.expectRevert("DAO cannot be zero address");
        prism.setDao(address(0));
    }

    function testSetDaoTransfersDaoPrivileges() public {
        prism.setDao(user1);

        vm.expectRevert("Only DAO can call this function");
        prism.setRakeScaled100(300);

        vm.prank(user1);
        prism.setRakeScaled100(300);
        assertEq(prism.getRakePercentScaled100(), 300);
    }

    function testSetOracleOnlyDaoRevertsForNonDao() public {
        vm.prank(user1);
        vm.expectRevert("Only DAO can call this function");
        prism.setOracle(user2);
    }

    function testSetOracleZeroAddressReverts() public {
        vm.expectRevert("Oracle cannot be zero address");
        prism.setOracle(address(0));
    }

    function testSetOracleTransfersResolvePrivilege() public {
        uint128 marketId = 16;
        prism.createNewMarket(marketId, "Oracle role market");

        prism.setOracle(user1);

        vm.expectRevert("Only oracle can call this function");
        prism.resolveMarket(marketId, true);

        vm.prank(user1);
        prism.resolveMarket(marketId, true);

        assertEq(prism.outcomes(marketId), 1);
        assertGt(prism.resolutionTimes(marketId), 0);
    }

    // --- redeem with rake ---

    function _setupResolvedMarket(uint128 marketId, bool yesWins, address winner, uint256 qty) internal {
        prism.createNewMarket(marketId, "Rake test market");
        prism.setTokensForTest(marketId, winner, yesWins ? qty : 0, yesWins ? 0 : qty);
        usdc.transfer(address(prism), qty);
        prism.setTotalCollateralForTest(marketId, qty);
        prism.resolveMarket(marketId, yesWins);
    }

    function testRedeemYesWinnerDefaultRake() public {
        uint128 marketId = 20;
        uint256 qty = 100e6;
        _setupResolvedMarket(marketId, true, user1, qty);

        uint256 rakeAmount = (qty * 200) / 10000; // 2e6
        uint256 expectedPayout = qty - rakeAmount; // 98e6

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 ownerBalBefore = usdc.balanceOf(owner);

        vm.prank(user1);
        uint256 returned = prism.redeem(marketId);

        assertEq(returned,                   expectedPayout,             "returned amount");
        assertEq(usdc.balanceOf(user1),      user1BalBefore + expectedPayout, "user1 USDC after redeem");
        assertEq(usdc.balanceOf(owner),      ownerBalBefore + rakeAmount,     "owner USDC after rake");
        assertEq(prism.getTotalCollateral(marketId), 0,                   "total collateral cleared");
        (uint256 yes, uint256 no) = prism.getUserTokens(marketId, user1);
        assertEq(yes, 0, "YES tokens cleared");
        assertEq(no,  0, "NO tokens cleared");
    }

    function testRedeemYesWinnerGetsFullMatchedPotLessRake() public {
        uint128 marketId = 36;
        uint256 qty = 100e6;

        prism.createNewMarket(marketId, "Matched market full-pot payout");
        prism.setTokensForTest(marketId, user1, qty, 0);
        prism.setTokensForTest(marketId, user2, 0, qty);
        usdc.transfer(address(prism), 2 * qty);
        prism.setTotalCollateralForTest(marketId, 2 * qty);
        prism.resolveMarket(marketId, true);

        uint256 grossPayout = 2 * qty;
        uint256 rakeAmount = (grossPayout * 200) / 10000;
        uint256 expectedPayout = grossPayout - rakeAmount;

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 ownerBalBefore = usdc.balanceOf(owner);

        vm.prank(user1);
        uint256 returned = prism.redeem(marketId);

        assertEq(returned, expectedPayout, "winner receives full matched pot less rake");
        assertEq(usdc.balanceOf(user1), user1BalBefore + expectedPayout, "winner USDC after redeem");
        assertEq(usdc.balanceOf(owner), ownerBalBefore + rakeAmount, "owner receives rake on full pot");
        assertEq(prism.getTotalCollateral(marketId), 0, "matched market collateral cleared");
    }

    function testRedeemNoWinnerDefaultRake() public {
        uint128 marketId = 21;
        uint256 qty = 50e6;
        _setupResolvedMarket(marketId, false, user2, qty);

        uint256 rakeAmount    = (qty * 200) / 10000;
        uint256 expectedPayout = qty - rakeAmount;

        uint256 user2BalBefore = usdc.balanceOf(user2);
        uint256 ownerBalBefore = usdc.balanceOf(owner);

        vm.prank(user2);
        uint256 returned = prism.redeem(marketId);

        assertEq(returned,              expectedPayout,                  "returned amount");
        assertEq(usdc.balanceOf(user2), user2BalBefore + expectedPayout, "user2 USDC after redeem");
        assertEq(usdc.balanceOf(owner), ownerBalBefore + rakeAmount,     "owner USDC after rake");
        assertEq(prism.getTotalCollateral(marketId), 0, "total collateral cleared");
    }

    function testRedeemWithZeroRake() public {
        uint128 marketId = 22;
        uint256 qty = 75e6;
        prism.setRakeScaled100(0);
        _setupResolvedMarket(marketId, true, user1, qty);

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 ownerBalBefore = usdc.balanceOf(owner);

        vm.prank(user1);
        uint256 returned = prism.redeem(marketId);

        assertEq(returned,              qty,              "all tokens returned with 0% rake");
        assertEq(usdc.balanceOf(user1), user1BalBefore + qty, "user1 receives full amount");
        assertEq(usdc.balanceOf(owner), ownerBalBefore,       "owner receives no rake");
    }

    function testRedeemWithCustomRake() public {
        uint128 marketId = 23;
        uint256 qty = 200e6;
        prism.setRakeScaled100(500); // 5%
        _setupResolvedMarket(marketId, true, user1, qty);

        uint256 rakeAmount    = (qty * 500) / 10000; // 10e6
        uint256 expectedPayout = qty - rakeAmount;   // 190e6

        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 ownerBalBefore = usdc.balanceOf(owner);

        vm.prank(user1);
        uint256 returned = prism.redeem(marketId);

        assertEq(returned,              expectedPayout,                  "returned amount with 5% rake");
        assertEq(usdc.balanceOf(user1), user1BalBefore + expectedPayout, "user1 balance after 5% rake");
        assertEq(usdc.balanceOf(owner), ownerBalBefore + rakeAmount,     "owner balance after 5% rake");
    }

    function testRedeemNotResolvedReverts() public {
        uint128 marketId = 24;
        prism.createNewMarket(marketId, "Unresolved market");
        prism.setTokensForTest(marketId, user1, 100e6, 0);

        vm.prank(user1);
        vm.expectRevert("Not resolved yet");
        prism.redeem(marketId);
    }

    function testRedeemNoWinningTokensReverts() public {
        uint128 marketId = 25;
        prism.createNewMarket(marketId, "Empty balance market");
        usdc.transfer(address(prism), 10e6);
        prism.setTotalCollateralForTest(marketId, 10e6);
        prism.resolveMarket(marketId, true); // YES wins, but user1 has 0 YES tokens

        vm.prank(user1);
        vm.expectRevert("No winning tokens");
        prism.redeem(marketId);
    }

    function testRedeemUsesTrackedRemainingCollateralWhenBelowWinningSupply() public {
        uint128 marketId = 26;
        uint256 qty = 100e6;

        prism.createNewMarket(marketId, "Under-collateralized market");
        prism.setTokensForTest(marketId, user1, qty, 0);
        usdc.transfer(address(prism), qty);
        prism.setTotalCollateralForTest(marketId, qty - 1);
        prism.resolveMarket(marketId, true);

        uint256 grossPayout = qty - 1;
        uint256 rakeAmount = (grossPayout * 200) / 10000;
        uint256 expectedPayout = grossPayout - rakeAmount;
        uint256 user1BalBefore = usdc.balanceOf(user1);
        uint256 ownerBalBefore = usdc.balanceOf(owner);

        vm.prank(user1);
        uint256 returned = prism.redeem(marketId);

        assertEq(returned, expectedPayout, "redeem uses remaining tracked market collateral");
        assertEq(usdc.balanceOf(user1), user1BalBefore + expectedPayout, "winner receives tracked remaining collateral less rake");
        assertEq(usdc.balanceOf(owner), ownerBalBefore + rakeAmount, "owner receives rake on tracked remaining collateral");
        assertEq(prism.getTotalCollateral(marketId), 0, "tracked market collateral cleared");
    }

    function testRedeemCollateralAccountingMismatchReverts() public {
        uint128 marketId = 27;
        uint256 qty = 100e6;

        prism.createNewMarket(marketId, "Accounting mismatch market");
        prism.setTokensForTest(marketId, user1, qty, 0);
        usdc.transfer(address(prism), qty);
        prism.setTotalCollateralForTest(marketId, qty + 1);
        prism.resolveMarket(marketId, true);

        vm.prank(user1);
        vm.expectRevert("Collateral accounting mismatch");
        prism.redeem(marketId);
    }

    function testRedeemRakeTransferFailedReverts() public {
        MockConfigurableERC20 token = new MockConfigurableERC20("USD Coin", "USDC", 6, initialSupply);
        PrismTestHelper localPrism = new PrismTestHelper(address(token));

        require(token.transfer(user1, 100_000e6), "Transfer to user1 failed");
        token.approve(address(localPrism), type(uint256).max);
        vm.prank(user1); token.approve(address(localPrism), type(uint256).max);

        uint128 marketId = 29;
        uint256 qty = 100e6;

        localPrism.createNewMarket(marketId, "Rake transfer failure market");
        localPrism.setTokensForTest(marketId, user1, qty, 0);
        require(token.transfer(address(localPrism), qty), "Fund local prism failed");
        localPrism.setTotalCollateralForTest(marketId, qty);
        localPrism.resolveMarket(marketId, true);

        token.setFailMode(1); // fail first transfer call in redeem: owner rake transfer

        vm.prank(user1);
        vm.expectRevert("Rake transfer failed");
        localPrism.redeem(marketId);
    }

    function testRedeemCollateralTransferFailedReverts() public {
        MockConfigurableERC20 token = new MockConfigurableERC20("USD Coin", "USDC", 6, initialSupply);
        PrismTestHelper localPrism = new PrismTestHelper(address(token));

        require(token.transfer(user1, 100_000e6), "Transfer to user1 failed");
        token.approve(address(localPrism), type(uint256).max);
        vm.prank(user1); token.approve(address(localPrism), type(uint256).max);

        uint128 marketId = 35;
        uint256 qty = 100e6;

        localPrism.createNewMarket(marketId, "Payout transfer failure market");
        localPrism.setTokensForTest(marketId, user1, qty, 0);
        require(token.transfer(address(localPrism), qty), "Fund local prism failed");
        localPrism.setTotalCollateralForTest(marketId, qty);
        localPrism.resolveMarket(marketId, true);

        token.setFailMode(2); // first transfer succeeds (rake), second fails (winner payout)

        vm.prank(user1);
        vm.expectRevert("Collateral transfer failed");
        localPrism.redeem(marketId);
    }

    function testRedeemInvalidMarketOutcomeReverts() public {
        uint128 marketId = 28;
        _setupResolvedMarket(marketId, true, user1, 100e6);

        prism.setOutcomeForTest(marketId, 3);

        vm.prank(user1);
        vm.expectRevert("Invalid market outcome");
        prism.redeem(marketId);
    }

    // --- claimCollateralAfterOneYear ---

    function testClaimCollateralAfterOneYearByOwner() public {
        uint128 marketId = 30;
        uint256 collateral = 25e6;

        prism.createNewMarket(marketId, "Claim collateral market");
        usdc.transfer(address(prism), collateral);
        prism.setTotalCollateralForTest(marketId, collateral);
        prism.resolveMarket(marketId, true);

        uint256 resolvedAt = prism.resolutionTimes(marketId);
        vm.warp(resolvedAt + 366 days);

        uint256 ownerBalBefore = usdc.balanceOf(owner);

        prism.claimCollateralAfterOneYear(marketId);

        assertEq(usdc.balanceOf(owner), ownerBalBefore + collateral, "owner receives remaining collateral");
        assertEq(prism.getTotalCollateral(marketId), 0, "total collateral cleared");
    }

    function testClaimCollateralAfterOneYearTooEarlyReverts() public {
        uint128 marketId = 31;
        uint256 collateral = 10e6;

        prism.createNewMarket(marketId, "Too early market");
        usdc.transfer(address(prism), collateral);
        prism.setTotalCollateralForTest(marketId, collateral);
        prism.resolveMarket(marketId, true);

        uint256 resolvedAt = prism.resolutionTimes(marketId);
        vm.warp(resolvedAt + 365 days + 23 hours);

        vm.expectRevert("Too early to claim collateral");
        prism.claimCollateralAfterOneYear(marketId);
    }

    function testClaimCollateralAfterOneYearNotResolvedReverts() public {
        uint128 marketId = 32;
        prism.createNewMarket(marketId, "Unresolved claim market");

        vm.expectRevert("Not resolved yet");
        prism.claimCollateralAfterOneYear(marketId);
    }

    function testClaimCollateralAfterOneYearNoCollateralReverts() public {
        uint128 marketId = 33;
        prism.createNewMarket(marketId, "No collateral market");
        prism.resolveMarket(marketId, true);

        uint256 resolvedAt = prism.resolutionTimes(marketId);
        vm.warp(resolvedAt + 366 days);

        vm.expectRevert("No collateral to claim");
        prism.claimCollateralAfterOneYear(marketId);
    }

    function testClaimCollateralAfterOneYearNonOwnerReverts() public {
        uint128 marketId = 34;
        uint256 collateral = 10e6;

        prism.createNewMarket(marketId, "Non-owner claim market");
        usdc.transfer(address(prism), collateral);
        prism.setTotalCollateralForTest(marketId, collateral);
        prism.resolveMarket(marketId, true);

        uint256 resolvedAt = prism.resolutionTimes(marketId);
        vm.warp(resolvedAt + 366 days);

        vm.prank(user1);
        vm.expectRevert("Only direct user calls are allowed for this function");
        prism.claimCollateralAfterOneYear(marketId);
    }

    function testRedeemOnBehalfOfUserByOwner() public {
        uint128 marketId = 26;
        uint256 qty = 80e6;
        _setupResolvedMarket(marketId, true, user2, qty);

        uint256 rakeAmount = (qty * 200) / 10000;
        uint256 expectedPayout = qty - rakeAmount;

        uint256 user2BalBefore = usdc.balanceOf(user2);
        uint256 ownerBalBefore = usdc.balanceOf(owner);

        uint256 returned = prism.redeemOnBehalfOfUser(marketId, user2);

        assertEq(returned, expectedPayout, "returned amount");
        assertEq(usdc.balanceOf(user2), user2BalBefore + expectedPayout, "user2 receives payout");
        assertEq(usdc.balanceOf(owner), ownerBalBefore + rakeAmount, "owner receives rake");
        assertEq(prism.getTotalCollateral(marketId), 0, "total collateral cleared");

        (uint256 yes, uint256 no) = prism.getUserTokens(marketId, user2);
        assertEq(yes, 0, "YES tokens cleared");
        assertEq(no, 0, "NO tokens cleared");
    }

    function testRedeemOnBehalfOfUserNonOwnerReverts() public {
        uint128 marketId = 27;
        uint256 qty = 10e6;
        _setupResolvedMarket(marketId, true, user1, qty);

        vm.prank(user1);
        vm.expectRevert("Only direct user calls are allowed for this function");
        prism.redeemOnBehalfOfUser(marketId, user1);
    }
}
