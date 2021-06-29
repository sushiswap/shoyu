// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/INFTFactory.sol";
import "../factories/ProxyFactory.sol";
import "../NFT721.sol";
import "../NFT1155.sol";

contract NFTFactory is ProxyFactory, Ownable, INFTFactory {
    uint8 public constant override MAX_PROTOCOL_FEE = 100;

    address internal immutable target721;
    address internal immutable target1155;

    address public override protocolFeeRecipient;
    uint8 public override protocolFee; // out of 1000

    mapping(address => bool) public override isStrategyWhitelisted;

    mapping(address => mapping(uint256 => uint256)) public tagNonces;

    constructor(address _protocolFeeRecipient, uint8 _protocolFee) {
        setProtocolFeeRecipient(_protocolFeeRecipient);
        setProtocolFee(_protocolFee);

        NFT721 nft721 = new NFT721();
        nft721.initialize("", "", "", address(0));
        target721 = address(nft721);

        NFT1155 nft1155 = new NFT1155();
        nft1155.initialize("", address(0));
        target1155 = address(nft1155);
    }

    function setProtocolFeeRecipient(address _protocolFeeRecipient) public override onlyOwner {
        require(_protocolFeeRecipient != address(0), "SHOYU: INVALID_FEE_TO");

        protocolFeeRecipient = _protocolFeeRecipient;
    }

    function setProtocolFee(uint8 _protocolFee) public override onlyOwner {
        require(protocolFee <= MAX_PROTOCOL_FEE, "SHOYU: INVALID_FEE");

        protocolFee = _protocolFee;
    }

    function setStrategyWhitelisted(address ask, bool whitelisted) external override onlyOwner {
        require(ask != address(0), "SHOYU: INVALID_SALE");

        isStrategyWhitelisted[ask] = whitelisted;
    }

    function createNFT721(
        string calldata baseURI,
        string calldata name,
        string calldata symbol,
        uint8 royaltyFee
    ) external override returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");

        nft = _createProxy(
            target721,
            abi.encodeWithSignature(
                "initialize(string,string,string,address,address,uint8)",
                baseURI,
                name,
                symbol,
                msg.sender,
                msg.sender,
                royaltyFee
            )
        );

        emit CreateNFT721(nft, baseURI, name, symbol, msg.sender, royaltyFee);
    }

    function isNFT721(address query) external view override returns (bool result) {
        return _isProxy(target721, query);
    }

    function createNFT1155(string calldata uri, uint8 royaltyFee) external override returns (address nft) {
        nft = _createProxy(
            target1155,
            abi.encodeWithSignature("initialize(string,address,address,uint8)", uri, msg.sender, msg.sender, royaltyFee)
        );

        emit CreateNFT1155(nft, uri, msg.sender, royaltyFee);
    }

    function isNFT1155(address query) external view override returns (bool result) {
        return _isProxy(target1155, query);
    }

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        INFT721(nft).mint(to, tokenId);
        _setTags(nft, tokenId, tags);
    }

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        string[] memory tags
    ) external override {
        INFT1155(nft).mint(to, tokenId, amount);
        _setTags(nft, tokenId, tags);
    }

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        require(INFT721(nft).ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        require(INFT1155(nft).balanceOf(msg.sender, tokenId) > 0, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function _setTags(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) internal {
        uint256 nonce = tagNonces[nft][tokenId]++;

        for (uint256 i; i < tags.length; i++) {
            emit Tag(nft, tokenId, tags[i], nonce);
        }
    }
}
