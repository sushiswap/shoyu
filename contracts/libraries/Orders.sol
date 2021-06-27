// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

library Orders {
    // keccak256("Order(address maker,address taker,address nft,address strategy,uint256 tokenId,uint256 amount,address currency,address recipient,bytes params)")
    bytes32 internal constant ORDER_TYPEHASH = 0x920c8fe8f90bae4eb906a3bcfaf17c9ed94da7a76ed40a8262f1db2713ec8ea0;

    struct Order {
        address maker;
        address taker;
        address nft;
        uint256 tokenId;
        uint256 amount;
        address strategy;
        address currency;
        address recipient;
        bytes params;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function hash(Order memory order) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.maker,
                    order.taker,
                    order.nft,
                    order.tokenId,
                    order.amount,
                    order.strategy,
                    order.currency,
                    order.recipient,
                    keccak256(order.params)
                )
            );
    }
}
