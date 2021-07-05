// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface IBaseNFTExchange {
    event Cancel(bytes32 indexed hash);
    event Execute(bytes32 indexed hash, address buyer, uint256 amount, uint256 price);
    event Bid(bytes32 indexed hash, address bidder, uint256 bidAmount, uint256 bidPrice);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function factory() external view returns (address);

    function royaltyFeeInfo() external view returns (address recipient, uint8 permil);

    function bestBidder(bytes32 hash) external view returns (address);

    function bestBidPrice(bytes32 hash) external view returns (uint256);

    function isCancelled(bytes32 hash) external view returns (bool);

    function amountFilled(bytes32 hash) external view returns (uint256);

    function orders(bytes32 hash)
        external
        view
        returns (
            address maker,
            address nft,
            uint256 tokenId,
            uint256 amount,
            address strategy,
            address currency,
            uint256 deadline,
            bytes memory params,
            uint8 v,
            bytes32 r,
            bytes32 s
        );

    function orderHashes(
        address nft,
        uint256 tokenId,
        uint256 index
    ) external view returns (bytes32);

    function orderHashesLength(address nft, uint256 tokenId) external view returns (uint256);

    function cancel(Orders.Ask memory order) external;

    function bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder) external returns (bool executed);

    function bid(bytes32 askHash, Orders.Bid memory bidOrder) external returns (bool executed);

    function bid(
        Orders.Ask memory askOrder,
        uint256 bidAmount,
        uint256 bidPrice
    ) external returns (bool executed);

    function bid(
        bytes32 askHash,
        uint256 bidAmount,
        uint256 bidPrice
    ) external returns (bool executed);
}
