// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT1155.sol";
import "./interfaces/IERC2981.sol";
import "./base/BaseNFT1155.sol";
import "./base/BaseExchange.sol";

contract NFT1155V0 is BaseNFT1155, BaseExchange, IERC2981, INFT1155 {
    uint8 internal _MAX_ROYALTY_FEE;

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
        _MAX_ROYALTY_FEE = ITokenFactory(_factory).MAX_ROYALTY_FEE();

        if (tokenIds.length > 0) {
            _mintBatch(_owner, tokenIds, amounts, "");
        }

        _setRoyaltyFeeRecipient(royaltyFeeRecipient);
        _royaltyFee = type(uint8).max;
        if (royaltyFee != 0) _setRoyaltyFee(royaltyFee);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Initializable, IERC165)
        returns (bool)
    {
        return interfaceId == 0x2a55205a || super.supportsInterface(interfaceId);
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFT1155, BaseExchange, INFT1155) returns (bytes32) {
        return BaseNFT1155.DOMAIN_SEPARATOR();
    }

    function factory() public view virtual override(BaseNFT1155, BaseExchange, INFT1155) returns (address) {
        return _factory;
    }

    function royaltyInfo(uint256, uint256 _salePrice) external view override returns (address, uint256) {
        uint256 royaltyAmount;
        if (_royaltyFee != type(uint8).max) royaltyAmount = (_salePrice * _royaltyFee) / 1000;
        return (_royaltyFeeRecipient, royaltyAmount);
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
        _setRoyaltyFeeRecipient(royaltyFeeRecipient);
    }

    function setRoyaltyFee(uint8 royaltyFee) public override onlyOwner {
        _setRoyaltyFee(royaltyFee);
    }

    function _setRoyaltyFeeRecipient(address royaltyFeeRecipient) internal {
        require(royaltyFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        _royaltyFeeRecipient = royaltyFeeRecipient;

        emit SetRoyaltyFeeRecipient(royaltyFeeRecipient);
    }

    function _setRoyaltyFee(uint8 royaltyFee) internal {
        if (_royaltyFee == type(uint8).max) {
            require(royaltyFee <= _MAX_ROYALTY_FEE, "SHOYU: INVALID_FEE");
        } else {
            require(royaltyFee < _royaltyFee, "SHOYU: INVALID_FEE");
        }

        _royaltyFee = royaltyFee;

        emit SetRoyaltyFee(royaltyFee);
    }
}
