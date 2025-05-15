// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private tokenDecimals;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 _tokenDecimals
    ) ERC20(name, symbol) {
        tokenDecimals = _tokenDecimals;
        _mint(msg.sender, initialSupply);
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }
}
