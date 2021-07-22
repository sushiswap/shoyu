// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721Mock is ERC721("Mock", "MOCK") {
    function safeMint(
        address to,
        uint256 tokenId,
        bytes memory data
    ) external {
        _safeMint(to, tokenId, data);
    }
}
