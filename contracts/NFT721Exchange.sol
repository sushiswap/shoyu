// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./base/BaseNFTExchange.sol";

contract NFT721Exchange is BaseNFTExchange {
    bytes32 internal immutable _DOMAIN_SEPARATOR;
    address internal immutable _factory;

    constructor(address __factory) {
        _factory = __factory;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("NFT721Exchange"),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override returns (address) {
        return _factory;
    }

    function _transfer(
        address nft,
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override {
        IERC721(nft).safeTransferFrom(from, to, tokenId);
    }
}
