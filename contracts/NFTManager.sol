// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFTManager.sol";
import "./factories/ProxyFactory.sol";
import "./base/NFTExchange.sol";
import "./NFT721.sol";
import "./NFT1155.sol";

contract NFTManager is ProxyFactory, NFTExchange, INFTManager {
    address internal immutable target721;
    address internal immutable target1155;

    mapping(address => mapping(uint256 => uint256)) public tagNonces;

    constructor(address _protocolFeeRecipient, uint8 _protocolFee) NFTExchange(_protocolFeeRecipient, _protocolFee) {
        NFT721 nft721 = new NFT721();
        nft721.initialize("", "", "", address(0));
        target721 = address(nft721);

        NFT1155 nft1155 = new NFT1155();
        nft1155.initialize("", address(0));
        target1155 = address(nft1155);
    }

    function createNFT721(
        string calldata name,
        string calldata symbol,
        address owner,
        uint8 royaltyFee
    ) external override returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");
        require(owner != address(0), "SHOYU: INVALID_OWNER");

        nft = _createProxy(
            target721,
            abi.encodeWithSignature("initialize(string,string,address)", name, symbol, owner)
        );

        royaltyFeeRecipientOf[nft] = owner;
        _setRoyaltyFee(nft, royaltyFee);

        emit CreateNFT721(nft, name, symbol, owner);
    }

    function isNFT721(address query) external view override returns (bool result) {
        return _isProxy(target721, query);
    }

    function createNFT1155(address owner, uint8 royaltyFee) external override returns (address nft) {
        require(owner != address(0), "SHOYU: INVALID_OWNER");

        nft = _createProxy(target1155, abi.encodeWithSignature("initialize(address)", owner));

        royaltyFeeRecipientOf[nft] = owner;
        _setRoyaltyFee(nft, royaltyFee);

        emit CreateNFT1155(nft, owner);
    }

    function isNFT1155(address query) external view override returns (bool result) {
        return _isProxy(target1155, query);
    }

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external {
        INFT721(nft).mint(to, tokenId);
        _setTags(nft, tokenId, tags);
    }

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        string[] memory tags
    ) external {
        INFT1155(nft).mint(to, tokenId, amount);
        _setTags(nft, tokenId, tags);
    }

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external {
        require(INFT721(nft).ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external {
        require(INFT1155(nft).balanceOf(msg.sender, tokenId) > 0, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function _setTags(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) internal {
        uint256 nonce = tagNonces[nft][tokenId]++;

        for (uint256 i; i < tags.length; i++) {
            emit Tag(nft, tokenId, tags[i], nonce);
        }
    }
}
