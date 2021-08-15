// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IOwnable {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function owner() external view returns (address);

    function renounceOwnership() external;

    function transferOwnership(address newOwner) external;
}
