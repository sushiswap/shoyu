// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./ITaggable.sol";

interface INFT is ITaggable {
    function factory() external view returns (address);

    function closeSale(uint256 tokenId, uint256 amount) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external;
}
