// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT721.sol";
import "./base/BaseNFT721.sol";
import "./base/BaseExchange.sol";

contract NFT721V0 is BaseNFT721, BaseExchange, IERC2981, INFT721 {
    uint8 internal _MAX_ROYALTY_FEE;

    address internal _royaltyFeeRecipient;
    uint8 internal _royaltyFee; // out of 1000

    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        uint256[] memory tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override initializer {
        __BaseNFTExchange_init();
        initialize(_name, _symbol, _owner);
        _MAX_ROYALTY_FEE = ITokenFactory(_factory).MAX_ROYALTY_FEE();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _safeMint(_owner, tokenIds[i]);
        }

        _setRoyaltyFeeRecipient(royaltyFeeRecipient);
        _royaltyFee = type(uint8).max;
        if (royaltyFee != 0) _setRoyaltyFee(royaltyFee);
    }

    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override initializer {
        __BaseNFTExchange_init();
        initialize(_name, _symbol, _owner);
        _MAX_ROYALTY_FEE = ITokenFactory(_factory).MAX_ROYALTY_FEE();

        _parkTokenIds(toTokenId);

        emit ParkTokenIds(toTokenId);

        _setRoyaltyFeeRecipient(royaltyFeeRecipient);
        _royaltyFee = type(uint8).max;
        if (royaltyFee != 0) _setRoyaltyFee(royaltyFee);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Initializable, IERC165)
        returns (bool)
    {
        return interfaceId == 0x2a55205a || super.supportsInterface(interfaceId);
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFT721, BaseExchange, INFT721) returns (bytes32) {
        return BaseNFT721.DOMAIN_SEPARATOR();
    }

    function factory() public view virtual override(BaseNFT721, BaseExchange, INFT721) returns (address) {
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
        uint256
    ) internal override {
        if (from == owner() && _parked(tokenId)) {
            _safeMint(to, tokenId);
        } else {
            _transfer(from, to, tokenId);
        }
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
