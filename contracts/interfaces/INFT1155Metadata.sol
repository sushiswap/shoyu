// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFT1155Metadata {
    event SetName(string name);

    function name() external view returns (string memory);

    function setName(string calldata _name) external;
}
