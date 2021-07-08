// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT721.sol";
import "./base/BaseNFT721.sol";
import "./base/BaseNFTExchange.sol";

contract NFT721 is BaseNFT721, BaseNFTExchange, INFT721 {
    address internal _royaltyFeeRecipient;
    uint8 internal _royaltyFee; // out of 1000

    address internal _target;

    function initialize(
        string memory _baseURI_,
        string memory _name,
        string memory _symbol,
        address _owner,
        uint256[] memory tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override initializer {
        initialize(_baseURI_, _name, _symbol, _owner, tokenIds);

        setRoyaltyFeeRecipient(royaltyFeeRecipient);
        setRoyaltyFee(royaltyFee);
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFT721, BaseNFTExchange, INFT721) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(BaseNFT721, BaseNFTExchange, INFT721) returns (address) {
        return _factory;
    }

    function royaltyFeeInfo() public view override(BaseNFTExchange, INFT721) returns (address recipient, uint8 permil) {
        return (_royaltyFeeRecipient, _royaltyFee);
    }

    function canTrade(address nft) public view override(BaseNFTExchange, IBaseNFTExchange) returns (bool) {
        return nft == address(this);
    }

    function _transfer(
        address,
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override {
        if (from == owner() && !_exists(tokenId)) {
            _mint(to, tokenId);
        } else {
            _transfer(from, to, tokenId);
        }
    }

    function setRoyaltyFeeRecipient(address royaltyFeeRecipient) public override onlyOwner {
        require(royaltyFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        _royaltyFeeRecipient = royaltyFeeRecipient;
    }

    function setRoyaltyFee(uint8 royaltyFee) public override onlyOwner {
        require(royaltyFee <= INFTFactory(_factory).MAX_ROYALTY_FEE(), "SHOYU: INVALID_FEE");

        _royaltyFee = royaltyFee;
    }
}
