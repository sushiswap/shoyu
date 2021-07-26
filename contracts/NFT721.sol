// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT721.sol";
import "./base/BaseNFT721.sol";
import "./base/BaseExchange.sol";

contract NFT721 is BaseNFT721, BaseExchange, INFT721 {
    address internal _royaltyFeeRecipient;
    uint8 internal _royaltyFee; // out of 1000

    function initialize(
        string memory _name,
        string memory _symbol,
        address _owner,
        uint256[] memory tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override initializer {
        __BaseNFTExchange_init();
        initialize(_name, _symbol, _owner);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _safeMint(_owner, tokenIds[i]);
        }

        setRoyaltyFeeRecipient(royaltyFeeRecipient);
        _royaltyFee = type(uint8).max;
        if (royaltyFee != 0) setRoyaltyFee(royaltyFee);
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address _owner,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override initializer {
        __BaseNFTExchange_init();
        initialize(_name, _symbol, _owner);

        _parkTokenIds(toTokenId);

        emit ParkTokenIds(toTokenId);

        setRoyaltyFeeRecipient(royaltyFeeRecipient);
        setRoyaltyFee(royaltyFee);
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFT721, BaseExchange, INFT721) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(BaseNFT721, BaseExchange, INFT721) returns (address) {
        return _factory;
    }

    function royaltyFeeInfo() public view override(BaseExchange, INFT721) returns (address recipient, uint8 permil) {
        return (_royaltyFeeRecipient, _royaltyFee);
    }

    function _transfer(
        address,
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override {
        if (from == owner() && _parked(tokenId)) {
            _safeMint(to, tokenId);
        } else {
            _transfer(from, to, tokenId);
        }
    }

    function setRoyaltyFeeRecipient(address royaltyFeeRecipient) public override onlyOwner {
        require(royaltyFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        _royaltyFeeRecipient = royaltyFeeRecipient;

        emit SetRoyaltyFeeRecipient(royaltyFeeRecipient);
    }
    
    function setRoyaltyFee(uint8 royaltyFee) public override onlyOwner {
        if (_royaltyFee == type(uint8).max) {
            require(royaltyFee <= ITokenFactory(_factory).MAX_ROYALTY_FEE(), "SHOYU: INVALID_FEE");
        } else {
            require(royaltyFee < _royaltyFee, "SHOYU: INVALID_FEE");
        }

        _royaltyFee = royaltyFee;

        emit SetRoyaltyFee(royaltyFee);
    }
}
