// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFT1155.sol";
import "./IBaseNFTExchange.sol";

interface INFT1155 is IBaseNFT1155, IBaseNFTExchange {
    function initialize(
        string calldata _uri,
        address _owner,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external;

    function DOMAIN_SEPARATOR() external view override(IBaseNFT1155, IBaseNFTExchange) returns (bytes32);

    function factory() external view override(IBaseNFT1155, IBaseNFTExchange) returns (address);

    function royaltyFeeInfo() external view override returns (address recipient, uint8 permil);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;
}
