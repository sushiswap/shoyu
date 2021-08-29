// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";

import "./IOwnable.sol";

interface IBaseNFT1155 is IERC1155, IERC1155MetadataURI, IOwnable {
    event SetURI(uint256 indexed id, string uri);
    event SetBaseURI(string uri);
    event Burn(uint256 indexed tokenId, uint256 amount, uint256 indexed label, bytes32 data);

    function PERMIT_TYPEHASH() external view returns (bytes32);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function factory() external view returns (address);

    function nonces(address account) external view returns (uint256);

    function initialize(address _owner) external;

    function setURI(uint256 id, string memory uri) external;

    function setBaseURI(string memory baseURI) external;

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data
    ) external;

    function mintBatch(
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;

    function burn(
        uint256 tokenId,
        uint256 amount,
        uint256 label,
        bytes32 data
    ) external;

    function burnBatch(uint256[] calldata tokenIds, uint256[] calldata amounts) external;

    function permit(
        address owner,
        address spender,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
