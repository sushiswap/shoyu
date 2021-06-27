// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/INFTFactory.sol";
import "../factories/ProxyFactory.sol";
import "../base/NFTExchange.sol";
import "../NFT721.sol";
import "../NFT1155.sol";

contract NFTFactory is ProxyFactory, NFTExchange, INFTFactory {
    address internal immutable target721;
    address internal immutable target1155;

    constructor(address _protocolFeeRecipient, uint8 _protocolFee) NFTExchange(_protocolFeeRecipient, _protocolFee) {
        NFT721 nft721 = new NFT721();
        nft721.initialize("", "", "", address(0));
        target721 = address(nft721);

        NFT1155 nft1155 = new NFT1155();
        nft1155.initialize("", address(0));
        target1155 = address(nft1155);
    }

    function createNFT721(
        string calldata name,
        string calldata symbol,
        address owner,
        uint8 royaltyFee
    ) external override returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");
        require(owner != address(0), "SHOYU: INVALID_OWNER");

        nft = _createProxy(
            target721,
            abi.encodeWithSignature("initialize(string,string,address)", name, symbol, owner)
        );

        royaltyFeeRecipientOf[nft] = owner;
        _setRoyaltyFee(nft, royaltyFee);

        emit CreateNFT721(nft, name, symbol, owner);
    }

    function isNFT721(address query) external view override returns (bool result) {
        return _isProxy(target721, query);
    }

    function createNFT1155(address owner, uint8 royaltyFee) external override returns (address nft) {
        require(owner != address(0), "SHOYU: INVALID_OWNER");

        nft = _createProxy(target1155, abi.encodeWithSignature("initialize(address)", owner));

        royaltyFeeRecipientOf[nft] = owner;
        _setRoyaltyFee(nft, royaltyFee);

        emit CreateNFT1155(nft, owner);
    }

    function isNFT1155(address query) external view override returns (bool result) {
        return _isProxy(target1155, query);
    }
}
