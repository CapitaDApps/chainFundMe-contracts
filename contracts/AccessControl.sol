// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

contract AccessControl {
    error Capita__NotOwner();

    address public owner;

    event OwnershipTransfer(address indexed newOwner);

    constructor(address _owner) {
        owner = _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Capita__NotOwner();
        _;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
        emit OwnershipTransfer(_newOwner);
    }
}
