// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import { Prism } from "../src/Prism.sol";

contract PrismTestHelper is Prism {
    constructor(address _collateralToken) Prism(_collateralToken) {}

    function exposedAssemblePayload(uint8 buySell, uint256 collateralUsd, address evmAddr, uint128 marketId, uint128 txId, bool primarySecondary) external pure returns (bytes memory) {
        return assemblePayload(buySell, collateralUsd, evmAddr, marketId, txId, primarySecondary ? 0xf1 : 0xf0);
    }

    function exposedPrefixMessageFixed(string memory messageHashBase64) external pure returns (bytes memory) {
        return prefixMessageFixed(messageHashBase64);
    }

    /// @dev Test-only: directly set position token balances without going through posColToksOnBehalfAtomic.
    function setTokensForTest(uint128 marketId, address user, uint256 yesAmt, uint256 noAmt) external {
        yesTokens[marketId][user] = yesAmt;
        noTokens[marketId][user]  = noAmt;
    }

    /// @dev Test-only: directly set totalCollateralUsd without going through posColToksOnBehalfAtomic.
    function setTotalCollateralForTest(uint128 marketId, uint256 amount) external {
        totalCollateralUsd[marketId] = amount;
    }

    /// @dev Test-only: directly set market outcome to exercise guard branches.
    function setOutcomeForTest(uint128 marketId, uint8 outcome) external {
        outcomes[marketId] = outcome;
    }

    /// @dev Test-only: expose private rakePercentScaled100 for assertions.
    function getRakePercentScaled100() external view returns (uint256) {
        return rakePercentScaled100;
    }
}
