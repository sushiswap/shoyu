// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFTExchange.sol";

interface INFTExchange is IBaseNFTExchange {
    event SubmitOrder(bytes32 indexed hash);

    function submitOrder(
        address nft,
        uint256 tokenId,
        uint256 amount,
        address strategy,
        address currency,
        uint256 deadline,
        bytes memory params
    ) external;

    function royaltyFeeRecipientOf(address nft) external view returns (address);

    function royaltyFeeOf(address nft) external view returns (uint8);

    function charityDenominatorOf(address nft) external view returns (uint8);

    function setRoyaltyFeeRecipientOf(address nft, address _royaltyFeeRecipient) external;

    function setRoyaltyFeeOf(address nft, uint8 _royaltyFee) external;

    function setCharityDenominatorOf(address nft, uint8 _charityDenominator) external;
}
