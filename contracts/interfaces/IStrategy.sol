// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface IStrategy {
    function canExecute(
        uint256 deadline,
        bytes memory params,
        address bidder,
        uint256 bidPrice
    ) external view returns (bool);

    function canBid(
        uint256 deadline,
        bytes memory params,
        address bidder,
        uint256 bidPrice,
        uint256 bestBidPrice,
        uint256 bestBidBlock
    ) external view returns (bool);
}
