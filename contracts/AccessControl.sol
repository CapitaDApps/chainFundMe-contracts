// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

contract AccessControl {
    error AccessControl__NotOwner();
    error AccessControl__InvalidAddress();

    address public owner;

    event OwnershipTransfer(address indexed newOwner);

    constructor(address _owner) {
        owner = _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert AccessControl__NotOwner();
        _;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert AccessControl__InvalidAddress();

        owner = _newOwner;
        emit OwnershipTransfer(_newOwner);
    }
}
