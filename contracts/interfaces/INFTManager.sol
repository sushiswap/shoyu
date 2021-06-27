// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./INFTFactory.sol";

interface INFTManager is INFTFactory {
    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external;

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        string[] memory tags
    ) external;

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external;

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external;
}
