// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFT1155.sol";
import "./IBaseNFTExchange.sol";

interface INFT1155 is IBaseNFT1155, IBaseNFTExchange {
    function DOMAIN_SEPARATOR() external view override(IBaseNFT1155, IBaseNFTExchange) returns (bytes32);

    function factory() external view override(IBaseNFT1155, IBaseNFTExchange) returns (address);

    function royaltyFeeRecipient() external view returns (address);

    function royaltyFee() external view returns (uint8);

    function charityDenominator() external view returns (uint8);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;

    function setCharityDenominator(uint8 _charityDenominator) external;
}
