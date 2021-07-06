// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/IOrderBook.sol";
import "./libraries/Orders.sol";

contract OrderBook is IOrderBook {
    using Orders for Orders.Ask;

    mapping(bytes32 => Orders.Ask) public override orders;

    function submitOrder(
        address nft,
        uint256 tokenId,
        uint256 amount,
        address strategy,
        address currency,
        address recipient,
        uint256 deadline,
        bytes memory params
    ) external override returns (bytes32 hash) {
        Orders.Ask memory order =
            Orders.Ask(
                msg.sender,
                nft,
                tokenId,
                amount,
                strategy,
                currency,
                recipient,
                deadline,
                params,
                0,
                bytes32(0),
                bytes32(0)
            );
        hash = order.hash();
        orders[hash] = order;
    }
}
