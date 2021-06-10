// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./ITaggable.sol";

interface INFT1155 is IERC1155, ITaggable {
    function factory() external view returns (address);

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data,
        string[] memory tags
    ) external;

    function mintBatch(
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes memory data,
        string[][] memory tags
    ) external;

    function burn(
        address account,
        uint256 tokenId,
        uint256 amount
    ) external;

    function burnBatch(
        address account,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external;

    function createSale(
        uint256 tokenId,
        uint256 amount,
        address strategy,
        bytes calldata initData
    ) external returns (address sale);

    function closeSale(address account, uint256 tokenId) external;
}
