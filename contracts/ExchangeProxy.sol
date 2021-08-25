// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IExchangeProxy.sol";
import "./interfaces/IBaseExchange.sol";

contract ExchangeProxy is IExchangeProxy {
    using Orders for Orders.Ask;

    function claim(
        address exchange,
        Orders.Ask memory askOrder,
        Orders.Bid memory bidOrder
    ) external override {
        IERC20(askOrder.currency).transferFrom(bidOrder.signer, address(this), bidOrder.amount * bidOrder.price);
        IBaseExchange(exchange).bid(askOrder, bidOrder.amount, bidOrder.price, bidOrder.recipient, bidOrder.referrer);

        emit Claim(
            exchange,
            askOrder.hash(),
            bidOrder.signer,
            bidOrder.amount,
            bidOrder.price,
            bidOrder.recipient,
            bidOrder.referrer
        );
    }
}
