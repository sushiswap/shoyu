// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT721.sol";
import "./base/BaseNFT721.sol";
import "./base/BaseNFTExchange.sol";

contract NFT721 is BaseNFT721, BaseNFTExchange, INFT721 {
    address public override royaltyFeeRecipient;
    uint8 public override royaltyFee; // out of 1000
    uint8 public override charityDenominator;

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

        setRoyaltyFeeRecipient(_royaltyFeeRecipient);
        setRoyaltyFee(_royaltyFee);
        setCharityDenominator(_charityDenominator);
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFT721, BaseNFTExchange, INFT721) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(BaseNFT721, BaseNFTExchange, INFT721) returns (address) {
        return _factory;
    }

    function _royaltyFeeRecipientOf(address) internal view override returns (address) {
        return royaltyFeeRecipient;
    }

    function _royaltyFeeOf(address) internal view override returns (uint8) {
        return royaltyFee;
    }

    function _charityDenominatorOf(address) internal view override returns (uint8) {
        return charityDenominator;
    }

    function safeTransferFrom(
        address,
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override {
        safeTransferFrom(from, to, tokenId);
    }

    function setRoyaltyFeeRecipient(address _royaltyFeeRecipient) public override onlyOwner {
        require(_royaltyFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        royaltyFeeRecipient = _royaltyFeeRecipient;
    }

    function setRoyaltyFee(uint8 _royaltyFee) public override onlyOwner {
        require(_royaltyFee <= INFTFactory(_factory).MAX_ROYALTY_FEE(), "SHOYU: INVALID_FEE");

        royaltyFee = _royaltyFee;
    }

    function setCharityDenominator(uint8 _charityDenominator) public override onlyOwner {
        charityDenominator = _charityDenominator;
    }
}
