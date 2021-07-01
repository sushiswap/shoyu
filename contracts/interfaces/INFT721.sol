// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFT721.sol";
import "./IBaseNFTExchange.sol";

interface INFT721 is IBaseNFT721, IBaseNFTExchange {
    event SubmitOrder(bytes32 hash);

    function DOMAIN_SEPARATOR() external view override(IBaseNFT721, IBaseNFTExchange) returns (bytes32);

    function factory() external view override(IBaseNFT721, IBaseNFTExchange) returns (address);

    function submitOrder(
        uint256 tokenId,
        uint256 amount,
        address strategy,
        address currency,
        uint256 deadline,
        bytes memory params
    ) external;

    function royaltyFeeRecipient() external view returns (address);

    function royaltyFee() external view returns (uint8);

    function charityDenominator() external view returns (uint8);

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external;

    function setRoyaltyFee(uint8 _royaltyFee) external;

    function setCharityDenominator(uint8 _charityDenominator) external;

    function liquidate(uint256 tokenId, uint8 _minimumQuorum) external returns (address proxy);
}
