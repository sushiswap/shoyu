// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./base/BaseExchange.sol";

contract ERC1155ExchangeV0 is BaseExchange {
    bytes32 internal immutable _DOMAIN_SEPARATOR;
    uint256 internal immutable _CACHED_CHAIN_ID;
    address internal immutable _factory;

    constructor(address factory_) {
        __BaseNFTExchange_init();
        _factory = factory_;

        _CACHED_CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                keccak256(bytes(Strings.toHexString(uint160(address(this))))),
                0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        bytes32 domainSeparator;
        if (_CACHED_CHAIN_ID == block.chainid) domainSeparator = _DOMAIN_SEPARATOR;
        else {
            domainSeparator = keccak256(
                abi.encode(
                    // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                    0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                    keccak256(bytes(Strings.toHexString(uint160(address(this))))),
                    0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                    block.chainid,
                    address(this)
                )
            );
        }
        return domainSeparator;
    }

    function factory() public view override returns (address) {
        return _factory;
    }

    function canTrade(address nft) public view override returns (bool) {
        return !ITokenFactory(_factory).isNFT1155(nft);
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
