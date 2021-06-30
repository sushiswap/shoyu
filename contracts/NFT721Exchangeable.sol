// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./base/NFTExchangeable.sol";
import "./NFT721.sol";

contract NFT721Exchangeable is NFT721, NFTExchangeable {
    function initialize(
        string memory _baseURI_,
        string memory _name,
        string memory _symbol,
        address _owner,
        address _royaltyFeeRecipient,
        uint8 _royaltyFee,
        uint8 _charityDenominator
    ) external initializer {
        initialize(_baseURI_, _name, _symbol, _owner);

        _setRoyaltyFeeRecipient(_royaltyFeeRecipient);
        _setRoyaltyFee(_royaltyFee);
        _setCharityDenominator(_charityDenominator);
    }

    function DOMAIN_SEPARATOR() public view override(NFT721, NFTExchangeable) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(NFT721, NFTExchangeable) returns (address) {
        return _factory;
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override {
        safeTransferFrom(from, to, tokenId);
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
