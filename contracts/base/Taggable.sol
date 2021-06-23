// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

abstract contract Taggable {
    event Tag(string indexed tag, uint256 indexed tokenId, uint256 indexed tagNonce);

    mapping(uint256 => uint256) public tagNonces;

    function _setTags(uint256 tokenId, string[] memory tags) internal {
        uint256 nonce = tagNonces[tokenId]++;

        for (uint256 i; i < tags.length; i++) {
            emit Tag(tags[i], tokenId, nonce);
        }
    }
}
