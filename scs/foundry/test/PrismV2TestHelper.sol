// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PrismV2} from "../src/PrismV2.sol";

contract PrismV2TestHelper is PrismV2 {
    function _isAuthorized(address, bytes memory, bytes calldata)
        internal
        pure
        override
        returns (bool)
    {
        return true;
    }
}

contract PrismV2UpgradeMock is PrismV2TestHelper {
    function implementationVersion() external pure returns (uint256) {
        return 3;
    }
}
