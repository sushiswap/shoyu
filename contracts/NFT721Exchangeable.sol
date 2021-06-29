// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFTFactory.sol";
import "./base/NFTExchangeable.sol";
import "./NFT721.sol";

contract NFT721Exchangeable is NFT721, NFTExchangeable {
    function initialize(
        string memory _baseURI_,
        string memory _name,
        string memory _symbol,
        address _owner,
        address _royaltyFeeRecipient,
        uint8 _royaltyFee
    ) external initializer {
        initialize(_baseURI_, _name, _symbol, _owner);

        _setRoyaltyFeeRecipient(_royaltyFeeRecipient);
        _setRoyaltyFee(_royaltyFee);
    }

    function DOMAIN_SEPARATOR() public view override(NFT721, NFTExchangeable) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function isStrategyWhitelisted(address strategy) internal view override returns (bool) {
        return INFTFactory(factory).isStrategyWhitelisted(strategy);
    }

    function protocolFeeRecipient() internal view override returns (address) {
        return INFTFactory(factory).protocolFeeRecipient();
    }

    function protocolFee() internal view override returns (uint256) {
        return INFTFactory(factory).protocolFee();
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
}
