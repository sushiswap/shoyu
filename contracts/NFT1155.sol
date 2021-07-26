// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT1155.sol";
import "./base/BaseNFT1155.sol";
import "./base/BaseExchange.sol";

contract NFT1155 is BaseNFT1155, BaseExchange, INFT1155 {
    address internal _royaltyFeeRecipient;
    uint8 internal _royaltyFee; // out of 1000

    function initialize(
        address _owner,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override initializer {
        __BaseNFTExchange_init();
        initialize(_owner);

        if (tokenIds.length > 0) {
            _mintBatch(_owner, tokenIds, amounts, "");
        }

        setRoyaltyFeeRecipient(royaltyFeeRecipient);
        _royaltyFee = type(uint8).max;
        if (royaltyFee != 0) setRoyaltyFee(royaltyFee);
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFT1155, BaseExchange, INFT1155) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(BaseNFT1155, BaseExchange, INFT1155) returns (address) {
        return _factory;
    }

    function royaltyFeeInfo() public view override(BaseExchange, INFT1155) returns (address recipient, uint8 permil) {
        return (_royaltyFeeRecipient, _royaltyFee);
    }

    function _transfer(
        address,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal override {
        _transfer(from, to, tokenId, amount);
        emit TransferSingle(msg.sender, from, to, tokenId, amount);
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
