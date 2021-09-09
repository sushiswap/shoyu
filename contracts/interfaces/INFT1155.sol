// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFT1155.sol";
import "./IBaseExchange.sol";

interface INFT1155 is IBaseNFT1155, IBaseExchange {
    event SetRoyaltyFeeRecipient(address recipient);
    event SetRoyaltyFee(uint8 fee);

    function initialize(
        address _owner,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external;

    function DOMAIN_SEPARATOR() external view override(IBaseNFT1155, IBaseExchange) returns (bytes32);

    function factory() external view override(IBaseNFT1155, IBaseExchange) returns (address);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;
}
