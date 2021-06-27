// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface INFTExchange {
    event Cancel(bytes32 indexed hash);
    event Bid(
        bytes32 indexed hash,
        address maker,
        address taker,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 amount,
        address currency,
        address recipient,
        uint256 price
    );

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function MAX_PROTOCOL_FEE() external view returns (uint8);

    function MAX_ROYALTY_FEE() external view returns (uint8);

    function protocolFeeRecipient() external view returns (address);

    function protocolFee() external view returns (uint8);

    function royaltyFeeRecipientOf(address account) external view returns (address);

    function royaltyFeeOf(address account) external view returns (uint8);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function isCancelledOrFinished(address maker, bytes32 hash) external view returns (bool);

    function setProtocolFeeRecipient(address _protocolFeeRecipient) external;

    function setProtocolFee(uint8 _protocolFee) external;

    function setStrategyWhitelisted(address sale, bool whitelisted) external;

    function setRoyaltyFeeRecipient(address nft, address royaltyFeeRecipient) external;

    function setRoyaltyFee(address nft, uint8 royaltyFee) external;

    function cancel(bytes32 hash) external;

    function bid721(Orders.Order memory ask, Orders.Order memory bid) external;

    function bid721(
        Orders.Order memory ask,
        address recipient,
        uint256 bidPrice
    ) external;

    function bid1155(Orders.Order memory ask, Orders.Order memory bid) external;

    function bid1155(
        Orders.Order memory ask,
        uint256 amount,
        address recipient,
        uint256 bidPrice
    ) external;
}
