// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFTExchange.sol";

interface INFTExchange is IBaseNFTExchange {
    function royaltyFeeRecipientOf(address nft) external view returns (address);

    function royaltyFeeOf(address nft) external view returns (uint8);

    function charityDenominatorOf(address nft) external view returns (uint8);

    function setRoyaltyFeeRecipientOf(address nft, address _royaltyFeeRecipient) external;

    function setRoyaltyFeeOf(address nft, uint8 _royaltyFee) external;

    function setCharityDenominatorOf(address nft, uint8 _charityDenominator) external;
}
