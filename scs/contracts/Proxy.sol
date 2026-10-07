// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title PrismProxy
/// @notice Minimal ERC-1967 proxy. Upgrade authorization lives only in PrismV2's UUPS logic.
/// @dev `initializationData` must be nonempty. This closes the
///      uninitialized-proxy takeover described in the v1 assessment.
contract PrismProxy is ERC1967Proxy {
    error EmptyInitializationData();

    constructor(address implementationAddress, bytes memory initializationData)
        payable
        ERC1967Proxy(implementationAddress, initializationData)
    {
        if (initializationData.length == 0) revert EmptyInitializationData();
    }
}
