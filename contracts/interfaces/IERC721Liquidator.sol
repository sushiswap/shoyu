// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IERC721Liquidator {
    event Liquidate(address indexed proxy, address indexed nft, uint256 indexed tokenId, uint8 minimumQuorum);

    function liquidate(
        address nft,
        uint256 tokenId,
        uint8 minimumQuorum
    ) external returns (address proxy);
}
