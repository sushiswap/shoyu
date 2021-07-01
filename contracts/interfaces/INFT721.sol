// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFT721.sol";
import "./IBaseNFTExchange.sol";

interface INFT721 is IBaseNFT721, IBaseNFTExchange {
    function DOMAIN_SEPARATOR() external view override(IBaseNFT721, IBaseNFTExchange) returns (bytes32);

    function factory() external view override(IBaseNFT721, IBaseNFTExchange) returns (address);

    function royaltyFeeRecipient() external view returns (address);

    function royaltyFee() external view returns (uint8);

    function charityDenominator() external view returns (uint8);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;

    function setCharityDenominator(uint8 _charityDenominator) external;
}
