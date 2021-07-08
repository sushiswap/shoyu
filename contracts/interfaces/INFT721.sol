// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFT721.sol";
import "./IBaseNFTExchange.sol";

interface INFT721 is IBaseNFT721, IBaseNFTExchange {
    function initialize(
        string calldata _baseURI_,
        string calldata _name,
        string calldata _symbol,
        address _owner,
        uint256[] calldata tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external;

    function DOMAIN_SEPARATOR() external view override(IBaseNFT721, IBaseNFTExchange) returns (bytes32);

    function factory() external view override(IBaseNFT721, IBaseNFTExchange) returns (address);

    function royaltyFeeInfo() external view override returns (address recipient, uint8 permil);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;
}
