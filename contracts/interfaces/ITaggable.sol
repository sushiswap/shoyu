// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface ITaggable {
    function tagsOf(uint256 tokenId) external view returns (string[] memory);

    function setTags(uint256 tokenId, string[] memory tags) external;
}
