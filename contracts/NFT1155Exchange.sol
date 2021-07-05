// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./base/BaseNFTExchange.sol";

contract NFT1155Exchange is BaseNFTExchange {
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
                keccak256("NFT1155Exchange"),
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

    function canTrade(address nft) public view override returns (bool) {
        return !INFTFactory(_factory).isNFT1155(nft);
    }

    function _transfer(
        address nft,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal override {
        IERC1155(nft).safeTransferFrom(from, to, tokenId, amount, "");
    }
}
