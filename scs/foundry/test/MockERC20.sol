// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals_, uint256 initialSupply) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
        _setupDecimals(decimals_);
    }

    function _setupDecimals(uint8 decimals_) internal {
        // This is only for testing, not for production
        assembly {
            sstore(0x0, decimals_)
        }
    }
}
