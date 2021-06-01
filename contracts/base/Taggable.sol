// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/ITaggable.sol";

contract Taggable is ITaggable {
    event SetTags(string[] tags, uint256 indexed tokenId);

    mapping(uint256 => string[]) private _tags;

    function tagsOf(uint256 tokenId) public view override returns (string[] memory) {
        return _tags[tokenId];
    }

    function setTags(uint256 tokenId, string[] memory tags) public override {
        _tags[tokenId] = tags;

        emit SetTags(tags, tokenId);
    }
}
