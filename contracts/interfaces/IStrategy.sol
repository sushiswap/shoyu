// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface IStrategy {
    function canPurchase(bytes memory params, uint256 bidPrice) external view returns (bool);

    function canBid(
        bytes memory params,
        uint256 bidPrice,
        uint256 bestPrice
    ) external view returns (bool);
}
