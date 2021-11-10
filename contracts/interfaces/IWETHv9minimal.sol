// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IWETHv9minimal {
    function deposit() external payable;
    function withdraw(uint wad) external;
}
