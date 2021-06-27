// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFTManager.sol";
import "./factories/NFTFactory.sol";

contract NFTManager is NFTFactory, INFTManager {
    mapping(address => mapping(uint256 => uint256)) public tagNonces;

    constructor(address _protocolFeeRecipient, uint8 _protocolFee) NFTFactory(_protocolFeeRecipient, _protocolFee) {
        // Empty
    }

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        INFT721(nft).mint(to, tokenId);
        _setTags(nft, tokenId, tags);
    }

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        string[] memory tags
    ) external override {
        INFT1155(nft).mint(to, tokenId, amount);
        _setTags(nft, tokenId, tags);
    }

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        require(INFT721(nft).ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
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
