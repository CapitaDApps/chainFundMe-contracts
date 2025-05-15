// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFailingERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        return false; // Always fail
    }
}
