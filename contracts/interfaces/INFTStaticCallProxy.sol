// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFTStaticCallProxy {
    event SetTarget(address indexed target);

    function target() external view returns (address);

    function setTarget(address _target) external;
}
