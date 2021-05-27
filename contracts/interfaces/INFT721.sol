// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface INFT721 is IERC721Upgradeable {
    function factory() external view returns (address);

    function openSaleOf(uint256 tokenId) external view returns (address);

    function tagsOf(uint256 tokenId) external view returns (string[] memory);

    function mint(
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external;

    function burn(uint256 tokenId) external;

    function setTags(uint256 tokenId, string[] memory tags) external;

    function createSale(
        uint256 tokenId,
        address strategy,
        bytes calldata initData
    ) external returns (address sale);

    function closeSale(uint256 tokenId) external;
}
