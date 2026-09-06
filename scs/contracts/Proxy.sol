// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

/// @title Proxy
/// @notice ERC-1967 proxy used as the stable address for your users.
/// @dev `_data` must contain the implementation's initialization call. The
///      implementation must be designed for delegate-call based initialization.
contract Proxy is ERC1967Proxy {
    error ProxyUnauthorized();

    constructor(address implementationAddress, bytes memory initializationData) payable ERC1967Proxy(implementationAddress, initializationData) {
        ERC1967Utils.changeAdmin(msg.sender);
    }

    receive() external payable {}

    function _unsafeAllowUninitialized() internal pure override returns (bool) {
        return true;
    }

    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable onlyAdmin {
        ERC1967Utils.upgradeToAndCall(newImplementation, data);
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        ERC1967Utils.changeAdmin(newAdmin);
    }

    /////
    // getters
    /////
    function getAdmin() external view returns (address) {
        return ERC1967Utils.getAdmin();
    }

    function getImplementation() external view returns (address) {
        return ERC1967Utils.getImplementation();
    }

    /////
    // modifiers
    /////
     modifier onlyAdmin() {
        if (msg.sender != ERC1967Utils.getAdmin()) revert ProxyUnauthorized();
        _;
    }
}