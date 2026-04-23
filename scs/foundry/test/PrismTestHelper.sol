// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import { Prism } from "../src/Prism.sol";

contract PrismTestHelper is Prism {
    constructor(address _collateralToken) Prism(_collateralToken) {}

    function exposedAssemblePayload(uint8 buySell, uint256 collateralUsd, address evmAddr, uint128 marketId, uint128 txId) external pure returns (bytes memory) {
        return assemblePayload(buySell, collateralUsd, evmAddr, marketId, txId);
    }

    function exposedPrefixMessageFixed(string memory messageHashBase64) external pure returns (bytes memory) {
        return prefixMessageFixed(messageHashBase64);
    }
}
