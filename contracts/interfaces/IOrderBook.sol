// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IOrderBook {
    event SubmitOrder(bytes32 indexed hash);

    function orders(bytes32 hash)
        external
        view
        returns (
            address signer,
            address nft,
            uint256 tokenId,
            uint256 amount,
            address strategy,
            address currency,
            address recipient,
            uint256 deadline,
            bytes memory params,
            uint8 v,
            bytes32 r,
            bytes32 s
        );

    function submitOrder(
        address nft,
        uint256 tokenId,
        uint256 amount,
        address strategy,
        address currency,
        address recipient,
        uint256 deadline,
        bytes memory params
    ) external returns (bytes32 hash);
}
