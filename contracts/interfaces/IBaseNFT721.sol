// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IBaseNFT721 is IERC721 {
    event ParkTokenIds(uint256 toTokenId);

    function PERMIT_TYPEHASH() external view returns (bytes32);

    function PERMIT_ALL_TYPEHASH() external view returns (bytes32);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function factory() external view returns (address);

    function nonces(uint256 tokenId) external view returns (uint256);

    function noncesForAll(address account) external view returns (uint256);

    function parked(uint256 tokenId) external view returns (bool);

    function initialize(
        string calldata baseURI_,
        string calldata name,
        string calldata symbol,
        address _owner
    ) external;

    function parkTokenIds(uint256 toTokenId) external;

    function mint(address to, uint256 tokenId) external;

    function mintBatch(address to, uint256[] calldata tokenIds) external;

    function burn(uint256 tokenId) external;

    function burnBatch(uint256[] calldata tokenIds) external;

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
