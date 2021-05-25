// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFT {
    function uid() external view returns (string memory);

    function factory() external view returns (address);

    function openSaleOf(uint256 tokenId) external view returns (address);

    function ownerOf(uint256 tokenId) external view returns (address);

    function createSale(
        uint256 tokenId,
        address strategy,
        bytes calldata initData
    ) external returns (address sale);

    function closeSale(uint256 tokenId) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}
