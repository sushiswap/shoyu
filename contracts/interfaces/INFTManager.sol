// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./INFTExchange.sol";

interface INFTManager is INFTExchange {
    event CreateNFT721(address indexed nft, string name, string symbol, address indexed owner);
    event CreateNFT1155(address indexed nft, address indexed owner);
    event Tag(address indexed nft, uint256 indexed tokenId, string indexed tag, uint256 tagNonce);

    function createNFT721(
        string calldata name,
        string calldata symbol,
        address owner,
        uint8 royaltyFee
    ) external returns (address nft);

    function isNFT721(address query) external view returns (bool result);

    function createNFT1155(address owner, uint8 royaltyFee) external returns (address nft);

    function isNFT1155(address query) external view returns (bool result);
}
