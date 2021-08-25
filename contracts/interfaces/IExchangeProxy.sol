// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface IExchangeProxy {
    event Claim(
        address exchange,
        bytes32 indexed hash,
        address bidder,
        uint256 amount,
        uint256 price,
        address recipient,
        address referrer
    );

    function claim(
        address exchange,
        Orders.Ask memory askOrder,
        Orders.Bid memory bidOrder
    ) external;
}
