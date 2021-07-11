// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFT721.sol";
import "./IBaseExchange.sol";

interface INFT721 is IBaseNFT721, IBaseExchange {
    event SetRoyaltyFeeRecipient(address recipient);
    event SetRoyaltyFee(uint8 fee);

    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _owner,
        uint256[] calldata tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external;

    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _owner,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external;

    function DOMAIN_SEPARATOR() external view override(IBaseNFT721, IBaseExchange) returns (bytes32);

    function factory() external view override(IBaseNFT721, IBaseExchange) returns (address);

    function royaltyFeeInfo() external view override returns (address recipient, uint8 permil);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;
}
