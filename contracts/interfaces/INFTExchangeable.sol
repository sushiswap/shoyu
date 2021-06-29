// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../libraries/Orders.sol";

interface INFTExchangeable {
    event Cancel(bytes32 indexed hash);
    event Execute(bytes32 indexed hash, address buyer, uint256 amount, uint256 price);
    event Bid(bytes32 indexed hash, address bidder, uint256 bidAmount, uint256 bidPrice);

    function MAX_ROYALTY_FEE() external view returns (uint8);

    function royaltyFeeRecipient() external view returns (address);

    function royaltyFee() external view returns (uint8);

    function charityDenominator() external view returns (uint8);

    function bestBidder(bytes32 hash) external view returns (address);

    function bestBidPrice(bytes32 hash) external view returns (uint256);

    function isCancelled(bytes32 hash) external view returns (bool);

    function amountFilled(bytes32 hash) external view returns (uint256);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;

    function setCharityDenominator(uint8 _charityDenominator) external;

    function cancel(Orders.Ask memory order) external;

    function bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder) external returns (bool executed);

    function bid(
        Orders.Ask memory askOrder,
        uint256 bidAmount,
        uint256 bidPrice
    ) external returns (bool executed);
}
