// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface INFTExchange {
    event Cancel(bytes32 indexed hash);
    event Purchase(bytes32 indexed hash, address buyer, uint256 amount, uint256 price);
    event Bid(bytes32 indexed hash, address bidder, uint256 bidAmount, uint256 bidPrice);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function MAX_PROTOCOL_FEE() external view returns (uint8);

    function MAX_ROYALTY_FEE() external view returns (uint8);

    function protocolFeeRecipient() external view returns (address);

    function protocolFee() external view returns (uint8);

    function royaltyFeeRecipientOf(address account) external view returns (address);

    function royaltyFeeOf(address account) external view returns (uint8);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function isCancelledOrFinished(address maker, bytes32 hash) external view returns (bool);

    function bestBidder(bytes32 askHash) external view returns (address);

    function bestBidPrice(bytes32 askHash) external view returns (uint256);

    function setProtocolFeeRecipient(address _protocolFeeRecipient) external;

    function setProtocolFee(uint8 _protocolFee) external;

    function setStrategyWhitelisted(address sale, bool whitelisted) external;

    function setRoyaltyFeeRecipient(address nft, address royaltyFeeRecipient) external;

    function setRoyaltyFee(address nft, uint8 royaltyFee) external;

    function cancel(bytes32 hash) external;

    function bid721(Orders.Ask memory ask, Orders.Bid memory bid) external;

    function bid721(Orders.Ask memory ask, uint256 bidPrice) external;

    function bid1155(Orders.Ask memory ask, Orders.Bid memory bid) external;

    function bid1155(
        Orders.Ask memory ask,
        uint256 bidAmount,
        uint256 bidPrice
    ) external;
}
