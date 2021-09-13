// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../interfaces/IERC2981.sol";

contract ERC721RoyaltyMock is ERC721("Mock", "MOCK") {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function safeMint(
        address to,
        uint256 tokenId,
        bytes memory data
    ) external {
        _safeMint(to, tokenId, data);
    }

    function safeMintBatch0(
        address[] calldata to,
        uint256[] calldata tokenId,
        bytes memory data
    ) external {
        require(to.length == tokenId.length);
        for (uint256 i = 0; i < to.length; i++) {
            _safeMint(to[i], tokenId[i], data);
        }
    }

    function safeMintBatch1(
        address to,
        uint256[] calldata tokenId,
        bytes memory data
    ) external {
        for (uint256 i = 0; i < tokenId.length; i++) {
            _safeMint(to, tokenId[i], data);
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == 0x2a55205a || super.supportsInterface(interfaceId);
    }

    function royaltyInfo(uint256 _tokenId, uint256 _salePrice) external view returns (address, uint256) {
        uint256 fee = 100;
        if (_tokenId < 10) fee = 10;
        return (owner, (_salePrice * fee) / 1000);
    }
}
