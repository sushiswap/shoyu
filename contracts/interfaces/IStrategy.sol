// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IStrategy {
    function token() external view returns (address);

    function tokenId() external view returns (uint256);

    function recipient() external view returns (address);

    function currency() external view returns (address);

    function cancel() external;
}
