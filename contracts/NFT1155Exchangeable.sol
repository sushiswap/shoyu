// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./base/NFTExchangeable.sol";
import "./NFT1155.sol";

contract NFT1155Exchangeable is NFT1155, NFTExchangeable {
    function initialize(
        string memory _uri,
        address _owner,
        address _royaltyFeeRecipient,
        uint8 _royaltyFee,
        uint8 _charityDenominator
    ) external initializer {
        initialize(_uri, _owner);

        _setRoyaltyFeeRecipient(_royaltyFeeRecipient);
        _setRoyaltyFee(_royaltyFee);
        _setCharityDenominator(_charityDenominator);
    }

    function DOMAIN_SEPARATOR() public view override(NFT1155, NFTExchangeable) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(NFT1155, NFTExchangeable) returns (address) {
        return _factory;
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal override {
        safeTransferFrom(from, to, tokenId, amount, "");
    }

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) external override onlyOwner {
        _setRoyaltyFeeRecipient(_royaltyFeeRecipient);
    }

    function setRoyaltyFee(uint8 _royaltyFee) external override onlyOwner {
        _setRoyaltyFee(_royaltyFee);
    }

    function setCharityDenominator(uint8 _charityDenominator) external override onlyOwner {
        _setCharityDenominator(_charityDenominator);
    }
}
