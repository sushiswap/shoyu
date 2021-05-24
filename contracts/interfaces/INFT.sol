// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFT {
    function uid() external view returns (string memory);

    function factory() external view returns (address);

    function openSaleOf(uint256 tokenId) external view returns (address);

    function ownerOf(uint256 tokenId) external view returns (address);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}
