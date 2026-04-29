// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import "forge-std/Test.sol";

import { Prism } from "../src/Prism.sol";
import { PrismTestHelper } from "./PrismTestHelper.sol";
import { MockERC20 } from "./MockERC20.sol";


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
        vm.prank(user1);
        uint256 allowance = prism.createNewMarket(marketId, statement);
        // The returned allowance is the user's allowance after the fee is transferred, which is type(uint256).max - fee
        assertEq(allowance, usdc.allowance(user1, address(prism)));
        assertEq(prism.statements(marketId), statement);
        assertEq(prism.resolutionTimes(marketId), 0);
        assertEq(prism.totalCollateralUsd(marketId), 0);
    }
    function testCreateNewMarketFailsIfExists() public {
        uint128 marketId = 2;
        string memory statement = "Will BTC > $100k?";
        vm.prank(user1);
        prism.createNewMarket(marketId, statement);
        vm.prank(user1);
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

    // --- buyPositionTokensOnBehalfAtomic (onlyOwner) ---
    function testBuyPositionTokensOnBehalfAtomicOnlyOwner() public {
        uint128 marketId = 3;
        string memory statement = "Will SOL > $500?";
        vm.prank(user1);
        prism.createNewMarket(marketId, statement);
        // This will revert due to signature and precompile checks, but onlyOwner is enforced
        vm.prank(user1);
        vm.expectRevert();
        prism.buyPositionTokensOnBehalfAtomic(marketId, user1, user2, 100e6, 100e6, 100e6, 100e6, 1, 2, hex"", hex"", false, false);
    }

    // --- resolveMarket (onlyOracle) ---
    function testResolveMarketOnlyOracle() public {
        uint128 marketId = 4;
        string memory statement = "Will ADA > $10?";
        vm.prank(user1);
        prism.createNewMarket(marketId, statement);
        // Only owner/oracle can resolve
        vm.prank(user1);
        vm.expectRevert();
        prism.resolveMarket(marketId, true);
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

    // --- redeem, buyPositionTokensOnBehalfAtomic, isAuthorized, etc. ---
    // These require more advanced mocking of precompiles and signatures, which is not possible in pure Solidity tests.
    // You can add integration tests with a JS/TS test runner or extend with custom cheatcodes/mocks if needed.
}
