// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface INFT1155 is IERC1155 {
    event Mint(address to, uint256 indexed tokenId, uint256 amount);

    function PERMIT_TYPEHASH() external view returns (bytes32);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function factory() external view returns (address);

    function nonces(address account) external view returns (uint256);

    function initialize(string memory _uri, address _owner) external;

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) external;

    function mintBatch(
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external;

    function burn(uint256 tokenId, uint256 amount) external;

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
