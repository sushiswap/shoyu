// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IBaseNFT721 is IERC721 {
    event Mint(address to, uint256 indexed tokenId);

    function PERMIT_TYPEHASH() external view returns (bytes32);

    function PERMIT_ALL_TYPEHASH() external view returns (bytes32);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function factory() external view returns (address);

    function nonces(uint256 tokenId) external view returns (uint256);

    function noncesForAll(address account) external view returns (uint256);

    function initialize(
        string memory baseURI_,
        string memory name,
        string memory symbol,
        address owner
    ) external;

    function mint(address to, uint256 tokenId) external;

    function burn(uint256 tokenId) external;

    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function permitAll(
        address owner,
        address spender,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
