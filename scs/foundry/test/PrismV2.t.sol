// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {PrismV2} from "../src/PrismV2.sol";
import {PrismProxy} from "../src/PrismProxy.sol";
import {MockERC20} from "./MockERC20.sol";
import {PrismV2TestHelper, PrismV2UpgradeMock} from "./PrismV2TestHelper.sol";

contract PrismV2Test is Test {
    uint128 internal constant MARKET = 1;
    uint256 internal constant ONE = 1_000_000;
    address internal constant HTS = address(0x167);
    address internal yesTrader = address(0xA11CE);
    address internal noTrader = address(0xB0B);
    address internal thirdTrader = address(0xCAFE);

    MockERC20 internal token;
    PrismV2TestHelper internal prism;

    function setUp() public {
        token = new MockERC20("USD Coin", "USDC", 6, 0);
        PrismV2TestHelper implementation = new PrismV2TestHelper();
        bytes memory initializationData = abi.encodeCall(
            PrismV2.initialize,
            (address(token), address(this), address(this), address(this), address(0xDA0), 200)
        );
        PrismProxy proxy = new PrismProxy(address(implementation), initializationData);
        prism = PrismV2TestHelper(address(proxy));
        prism.createMarket(MARKET, "Will Prism ship?", uint64(block.timestamp + 7 days));

        token.mint(yesTrader, 10_000 * ONE);
        token.mint(noTrader, 10_000 * ONE);
        token.mint(thirdTrader, 10_000 * ONE);
        vm.prank(yesTrader);
        token.approve(address(prism), type(uint256).max);
        vm.prank(noTrader);
        token.approve(address(prism), type(uint256).max);
        vm.prank(thirdTrader);
        token.approve(address(prism), type(uint256).max);
    }

    function testPrimaryPrimaryMintsOneDollarCompleteSet() public {
        uint256 shares = 100 * ONE;
        _settle(
            _auth(yesTrader, 1, PrismV2.Side.YES, PrismV2.Action.BUY, 450_000, shares, 40 * ONE),
            _auth(noTrader, 2, PrismV2.Side.NO, PrismV2.Action.BUY, 350_000, shares, 60 * ONE),
            shares,
            400_000,
            keccak256("mint")
        );

        assertEq(prism.yesBalance(MARKET, yesTrader), shares);
        assertEq(prism.noBalance(MARKET, noTrader), shares);
        assertEq(token.balanceOf(address(prism)), shares);
        assertEq(prism.aggregateReserved(), shares);
        (, , , uint256 reserve, uint256 totalYes, uint256 totalNo) = prism.markets(MARKET);
        assertEq(reserve, shares);
        assertEq(totalYes, shares);
        assertEq(totalNo, shares);
    }

    function testAllFourPairingsPreserveReserve() public {
        uint256 shares = 100 * ONE;
        _mintInitial(shares);

        // BUY YES + SELL YES transfers a position and collateral between users.
        _settle(
            _auth(thirdTrader, 3, PrismV2.Side.YES, PrismV2.Action.BUY, 500_000, 20 * ONE, 9 * ONE),
            _auth(yesTrader, 4, PrismV2.Side.YES, PrismV2.Action.SELL, 400_000, 20 * ONE, 9 * ONE),
            20 * ONE,
            450_000,
            keccak256("yes-transfer")
        );
        // BUY NO + SELL NO uses the complementary price (1 - YES price).
        _settle(
            _auth(yesTrader, 5, PrismV2.Side.NO, PrismV2.Action.BUY, 400_000, 20 * ONE, 11 * ONE),
            _auth(noTrader, 6, PrismV2.Side.NO, PrismV2.Action.SELL, 500_000, 20 * ONE, 11 * ONE),
            20 * ONE,
            450_000,
            keccak256("no-transfer")
        );
        assertEq(prism.aggregateReserved(), shares);

        // SELL YES + SELL NO merges a complete set and releases exactly one unit/share.
        _settle(
            _auth(thirdTrader, 7, PrismV2.Side.YES, PrismV2.Action.SELL, 400_000, 20 * ONE, 9 * ONE),
            _auth(yesTrader, 8, PrismV2.Side.NO, PrismV2.Action.SELL, 500_000, 20 * ONE, 11 * ONE),
            20 * ONE,
            450_000,
            keccak256("merge")
        );
        assertEq(prism.aggregateReserved(), 80 * ONE);
        assertEq(token.balanceOf(address(prism)), 80 * ONE);
    }

    function testPartialFillsTrackSharesAndSpendAndBlockOverfill() public {
        PrismV2.Authorization memory yesOrder =
            _auth(yesTrader, 10, PrismV2.Side.YES, PrismV2.Action.BUY, 400_000, 100 * ONE, 40 * ONE);
        PrismV2.Authorization memory noOrder =
            _auth(noTrader, 11, PrismV2.Side.NO, PrismV2.Action.BUY, 400_000, 100 * ONE, 60 * ONE);
        _settle(yesOrder, noOrder, 30 * ONE, 400_000, keccak256("partial-1"));
        _settle(yesOrder, noOrder, 70 * ONE, 400_000, keccak256("partial-2"));

        (uint256 filledShares, uint256 spent) = prism.fills(prism.authorizationHash(yesOrder));
        assertEq(filledShares, 100 * ONE);
        assertEq(spent, 40 * ONE);

        vm.expectRevert(PrismV2.InvalidFill.selector);
        _settle(yesOrder, noOrder, ONE, 400_000, keccak256("partial-3"));
    }

    function testMatchReplayAndCancellationAreRejected() public {
        PrismV2.Authorization memory yesOrder =
            _auth(yesTrader, 12, PrismV2.Side.YES, PrismV2.Action.BUY, 500_000, 10 * ONE, 5 * ONE);
        PrismV2.Authorization memory noOrder =
            _auth(noTrader, 13, PrismV2.Side.NO, PrismV2.Action.BUY, 500_000, 10 * ONE, 5 * ONE);
        bytes32 matchId = keccak256("same-match");
        _settle(yesOrder, noOrder, 10 * ONE, 500_000, matchId);
        vm.expectRevert(PrismV2.MatchAlreadyExecuted.selector);
        _settle(yesOrder, noOrder, 10 * ONE, 500_000, matchId);

        PrismV2.Authorization memory canceledOrder =
            _auth(yesTrader, 99, PrismV2.Side.YES, PrismV2.Action.BUY, 500_000, ONE, ONE);
        vm.prank(yesTrader);
        prism.cancelAuthorization(99);
        vm.expectRevert(PrismV2.AuthorizationCanceledError.selector);
        _settle(
            canceledOrder,
            _auth(noTrader, 14, PrismV2.Side.NO, PrismV2.Action.BUY, 500_000, ONE, ONE),
            ONE,
            500_000,
            keccak256("canceled")
        );
    }

    function testNormalizedLimitInequalities() public {
        PrismV2.Authorization memory buyYes =
            _auth(yesTrader, 20, PrismV2.Side.YES, PrismV2.Action.BUY, 399_999, ONE, ONE);
        PrismV2.Authorization memory buyNo =
            _auth(noTrader, 21, PrismV2.Side.NO, PrismV2.Action.BUY, 400_000, ONE, ONE);
        vm.expectRevert(PrismV2.LimitPriceViolated.selector);
        _settle(buyYes, buyNo, ONE, 400_000, keccak256("bad-buy-yes"));

        buyYes = _auth(yesTrader, 22, PrismV2.Side.YES, PrismV2.Action.BUY, 500_000, ONE, ONE);
        buyNo = _auth(noTrader, 23, PrismV2.Side.NO, PrismV2.Action.BUY, 400_001, ONE, ONE);
        vm.expectRevert(PrismV2.LimitPriceViolated.selector);
        _settle(buyYes, buyNo, ONE, 400_000, keccak256("bad-buy-no"));
    }

    function testRakeIsSnapshottedAndVoidHasNoRake() public {
        uint256 shares = 100 * ONE;
        _mintInitial(shares);
        prism.setDefaultRake(900);
        vm.warp(block.timestamp + 8 days);
        prism.resolveMarket(MARKET, true);
        uint256 before = token.balanceOf(yesTrader);
        vm.prank(yesTrader);
        prism.redeem(MARKET);
        assertEq(token.balanceOf(yesTrader) - before, 98 * ONE);

        uint128 voided = 2;
        prism.createMarket(voided, "Void", uint64(block.timestamp + 1 days));
        _settleMarket(
            voided,
            _authFor(voided, yesTrader, 30, PrismV2.Side.YES, PrismV2.Action.BUY, 500_000, 10 * ONE, 5 * ONE),
            _authFor(voided, noTrader, 31, PrismV2.Side.NO, PrismV2.Action.BUY, 500_000, 10 * ONE, 5 * ONE),
            10 * ONE,
            500_000,
            keccak256("void-mint")
        );
        vm.warp(block.timestamp + 2 days);
        prism.voidMarket(voided);
        uint256 voidBefore = token.balanceOf(yesTrader);
        vm.prank(yesTrader);
        prism.redeem(voided);
        assertEq(token.balanceOf(yesTrader) - voidBefore, 5 * ONE);
    }

    function testCrossMarketReserveCannotMaskRedemption() public {
        _mintInitial(100 * ONE);
        uint128 second = 2;
        prism.createMarket(second, "Second", uint64(block.timestamp + 7 days));
        _settleMarket(
            second,
            _authFor(second, yesTrader, 40, PrismV2.Side.YES, PrismV2.Action.BUY, 500_000, 40 * ONE, 20 * ONE),
            _authFor(second, noTrader, 41, PrismV2.Side.NO, PrismV2.Action.BUY, 500_000, 40 * ONE, 20 * ONE),
            40 * ONE,
            500_000,
            keccak256("second-market")
        );
        vm.warp(block.timestamp + 8 days);
        prism.resolveMarket(MARKET, true);
        vm.prank(yesTrader);
        prism.redeem(MARKET);
        assertEq(token.balanceOf(address(prism)), 40 * ONE);
        assertEq(prism.aggregateReserved(), 40 * ONE);
        (, , , uint256 secondReserve, , ) = prism.markets(second);
        assertEq(secondReserve, 40 * ONE);
    }

    function testProxyIsAtomicallyInitializedAndUpgradeRequiresOwner() public {
        PrismV2TestHelper implementation = new PrismV2TestHelper();
        vm.expectRevert();
        new PrismProxy(address(implementation), "");

        vm.expectRevert();
        implementation.initialize(address(token), address(this), address(this), address(this), address(this), 0);

        PrismV2UpgradeMock upgraded = new PrismV2UpgradeMock();
        vm.prank(yesTrader);
        vm.expectRevert(PrismV2.Unauthorized.selector);
        prism.upgradeToAndCall(address(upgraded), "");
        prism.upgradeToAndCall(address(upgraded), "");
        assertEq(PrismV2UpgradeMock(address(prism)).implementationVersion(), 3);
    }

    function testOwnerAssociatesProxyWithConfiguredCollateral() public {
        bytes memory callData = abi.encodeWithSignature(
            "associateToken(address,address)", address(prism), address(token)
        );
        vm.mockCall(HTS, callData, abi.encode(int64(22)));
        vm.expectCall(HTS, callData);

        prism.associateCollateralToken();
    }

    function testOnlyOwnerCanAssociateCollateral() public {
        vm.prank(yesTrader);
        vm.expectRevert(PrismV2.Unauthorized.selector);
        prism.associateCollateralToken();
    }

    function testAssociationFailureReverts() public {
        bytes memory callData = abi.encodeWithSignature(
            "associateToken(address,address)", address(prism), address(token)
        );
        vm.mockCall(HTS, callData, abi.encode(int64(1)));
        vm.expectRevert(abi.encodeWithSelector(PrismV2.TokenAssociationFailed.selector, int64(1)));

        prism.associateCollateralToken();
    }

    function testFuzz_RoundingAlwaysBuildsExactlyOneCompleteSet(uint96 rawShares, uint32 rawPrice) public {
        uint256 shares = bound(uint256(rawShares), 10, 1_000 * ONE);
        uint256 price = bound(uint256(rawPrice), 1, prism.PRICE_SCALE() - 1);
        uint256 yesCost = shares * price / prism.PRICE_SCALE();
        vm.assume(yesCost > 0 && yesCost < shares);
        _settle(
            _auth(yesTrader, 50, PrismV2.Side.YES, PrismV2.Action.BUY, price, shares, yesCost),
            _auth(noTrader, 51, PrismV2.Side.NO, PrismV2.Action.BUY, price, shares, shares - yesCost),
            shares,
            price,
            keccak256(abi.encode(shares, price))
        );
        assertEq(token.balanceOf(address(prism)), shares);
        assertEq(prism.aggregateReserved(), shares);
    }

    function _mintInitial(uint256 shares) internal {
        _settle(
            _auth(yesTrader, 1, PrismV2.Side.YES, PrismV2.Action.BUY, 400_000, shares, shares * 4 / 10),
            _auth(noTrader, 2, PrismV2.Side.NO, PrismV2.Action.BUY, 400_000, shares, shares * 6 / 10),
            shares,
            400_000,
            keccak256(abi.encodePacked("initial", shares))
        );
    }

    function _auth(
        address signer,
        uint128 txId,
        PrismV2.Side side,
        PrismV2.Action action,
        uint256 limitYesPrice,
        uint256 shares,
        uint256 cap
    ) internal view returns (PrismV2.Authorization memory) {
        return _authFor(MARKET, signer, txId, side, action, limitYesPrice, shares, cap);
    }

    function _authFor(
        uint128 marketId,
        address signer,
        uint128 txId,
        PrismV2.Side side,
        PrismV2.Action action,
        uint256 limitYesPrice,
        uint256 shares,
        uint256 cap
    ) internal view returns (PrismV2.Authorization memory) {
        return PrismV2.Authorization({
            version: 2,
            chainId: block.chainid,
            verifyingContract: address(prism),
            signer: signer,
            marketId: marketId,
            txId: txId,
            side: side,
            action: action,
            limitYesPrice: limitYesPrice,
            qtyShares: shares,
            collateralCap: cap,
            deadline: uint64(block.timestamp + 1 days)
        });
    }

    function _settle(
        PrismV2.Authorization memory a,
        PrismV2.Authorization memory b,
        uint256 shares,
        uint256 price,
        bytes32 matchId
    ) internal {
        prism.settle(a, hex"01", b, hex"02", shares, price, matchId);
    }

    function _settleMarket(
        uint128,
        PrismV2.Authorization memory a,
        PrismV2.Authorization memory b,
        uint256 shares,
        uint256 price,
        bytes32 matchId
    ) internal {
        _settle(a, b, shares, price, matchId);
    }
}
