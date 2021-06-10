// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./ITaggable.sol";

interface INFT721 is IERC721, ITaggable {
    function factory() external view returns (address);

    function mint(
        address to,
        uint256 tokenId,
        bytes calldata data,
        string[] memory tags
    ) external;

    function burn(uint256 tokenId) external;

    function createSale(
        uint256 tokenId,
        address strategy,
        bytes calldata initData
    ) external returns (address sale);

    function closeSale(uint256 tokenId) external;
}
