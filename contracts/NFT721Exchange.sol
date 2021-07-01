// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./interfaces/INFTExchange.sol";
import "./base/BaseNFTExchange.sol";

contract NFT721Exchange is BaseNFTExchange, INFTExchange {
    bytes32 internal immutable _DOMAIN_SEPARATOR;
    address internal immutable _factory;

    mapping(address => address) public override royaltyFeeRecipientOf;
    mapping(address => uint8) public override royaltyFeeOf; // out of 1000
    mapping(address => uint8) public override charityDenominatorOf;

    constructor(address __factory) {
        _factory = __factory;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("NFT721Exchange"),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFTExchange, IBaseNFTExchange) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(BaseNFTExchange, IBaseNFTExchange) returns (address) {
        return _factory;
    }

    function safeTransferFrom(
        address nft,
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override {
        IERC721(nft).safeTransferFrom(from, to, tokenId);
    }

    function _royaltyFeeRecipientOf(address nft) internal view override returns (address) {
        return royaltyFeeRecipientOf[nft];
    }

    function _royaltyFeeOf(address nft) internal view override returns (uint8) {
        return royaltyFeeOf[nft];
    }

    function _charityDenominatorOf(address nft) internal view override returns (uint8) {
        return charityDenominatorOf[nft];
    }

    function setRoyaltyFeeRecipientOf(address nft, address _royaltyFeeRecipient) public override {
        require(_royaltyFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        royaltyFeeRecipientOf[nft] = _royaltyFeeRecipient;
    }

    function setRoyaltyFeeOf(address nft, uint8 _royaltyFee) public override {
        require(_royaltyFee <= INFTFactory(_factory).MAX_ROYALTY_FEE(), "SHOYU: INVALID_FEE");

        royaltyFeeOf[nft] = _royaltyFee;
    }

    function setCharityDenominatorOf(address nft, uint8 _charityDenominator) public override {
        charityDenominatorOf[nft] = _charityDenominator;
    }
}
