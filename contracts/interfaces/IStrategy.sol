// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface IStrategy {
    function canClaim(
        address proxy,
        uint256 deadline,
        bytes memory params,
        address bidder,
        uint256 bidPrice,
        address bestBidder,
        uint256 bestBidPrice,
        uint256 bestBidTimestamp
    ) external view returns (bool);

    function canBid(
        address proxy,
        uint256 deadline,
        bytes memory params,
        address bidder,
        uint256 bidPrice,
        address bestBidder,
        uint256 bestBidPrice,
        uint256 bestBidTimestamp
    ) external view returns (bool);
}
