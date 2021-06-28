// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

library Orders {
    // keccak256("Ask(address maker,address nft,uint256 tokenId,uint256 amount,address strategy,address currency,uint256 deadline,bytes params)")
    bytes32 internal constant ASK_TYPEHASH = 0xf6b9318e52a4718870c8a1cb87663c66ada11a9457d1eda89b37c27308fa11ab;
    // keccak256("Bid(bytes32 askHash,address maker,uint256 amount,uint256 price)")
    bytes32 internal constant BID_TYPEHASH = 0xc0022d758d0524d6b82e8a475d4cf553171defd175525c65629c1719de76bc8c;

    struct Ask {
        address maker;
        address nft;
        uint256 tokenId;
        uint256 amount;
        address strategy;
        address currency;
        uint256 deadline;
        bytes params;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Bid {
        bytes32 askHash;
        address maker;
        uint256 amount;
        uint256 price;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function hash(Ask memory ask) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ASK_TYPEHASH,
                    ask.maker,
                    ask.nft,
                    ask.tokenId,
                    ask.amount,
                    ask.strategy,
                    ask.currency,
                    keccak256(ask.params)
                )
            );
    }

    function hash(Bid memory bid) internal pure returns (bytes32) {
        return keccak256(abi.encode(BID_TYPEHASH, bid.askHash, bid.maker, bid.amount, bid.price));
    }
}
