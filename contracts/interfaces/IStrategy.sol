// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IStrategy {
    function validateParams(bytes calldata params) external view;

    function validatePurchase(bytes memory params, uint256 bidPrice) external view;
}
