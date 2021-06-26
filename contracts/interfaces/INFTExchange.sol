// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFTExchange {
    struct Order {
        address maker;
        address taker;
        address nft;
        address strategy;
        uint256 tokenId;
        uint256 amount;
        address currency;
        address recipient;
        bytes params;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    event Cancel(bytes32 indexed hash);
    event Bid(
        address maker,
        address taker,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 amount,
        address currency,
        address recipient,
        uint256 price
    );

    function protocolFeeRecipient() external view returns (address);

    function protocolFee() external view returns (uint8);

    function royaltyFeeRecipientOf(address account) external view returns (address);

    function royaltyFeeOf(address account) external view returns (uint8);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function isCancelledOrFinished(bytes32 hash) external view returns (bool);

    function setProtocolFeeRecipient(address _protocolFeeRecipient) external;

    function setProtocolFee(uint8 _protocolFee) external;

    function setStrategyWhitelisted(address sale, bool whitelisted) external;

    function setRoyaltyFeeRecipient(address nft, address royaltyFeeRecipient) external;

    function setRoyaltyFee(address nft, uint8 royaltyFee) external;

    function cancel(Order memory ask) external;

    function bid721(Order memory ask, Order memory bid) external;

    function bid1155(Order memory ask, Order memory bid) external;
}
