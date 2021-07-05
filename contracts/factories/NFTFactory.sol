// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/INFTFactory.sol";
import "../factories/ProxyFactory.sol";
import "../ERC721Exchange.sol";
import "../ERC1155Exchange.sol";
import "../NFT721.sol";
import "../NFT1155.sol";

contract NFTFactory is ProxyFactory, Ownable, INFTFactory {
    uint8 public constant override MAX_ROYALTY_FEE = 250; // out of 1000

    address internal immutable _target721;
    address internal immutable _target1155;

    address internal _protocolFeeRecipient;
    uint8 internal _protocolFee; // out of 1000
    address internal _operationalFeeRecipient;
    uint8 internal _operationalFee; // out of 1000

    address public immutable override erc721Exchange;
    address public immutable override erc1155Exchange;
    address public override orderBook;
    mapping(address => bool) public override isStrategyWhitelisted;

    mapping(address => mapping(uint256 => uint256)) public tagNonces;

    constructor(
        address _orderBook,
        address protocolFeeRecipient,
        uint8 protocolFee,
        address operationalFeeRecipient,
        uint8 operationalFee
    ) {
        orderBook = _orderBook;
        _protocolFeeRecipient = protocolFeeRecipient;
        _protocolFee = protocolFee;
        _operationalFeeRecipient = operationalFeeRecipient;
        _operationalFee = operationalFee;

        erc721Exchange = address(new ERC721Exchange());
        erc1155Exchange = address(new ERC1155Exchange());

        NFT721 nft721 = new NFT721();
        nft721.initialize("", "", "", address(0));
        _target721 = address(nft721);

        NFT1155 nft1155 = new NFT1155();
        nft1155.initialize("", address(0));
        _target1155 = address(nft1155);
    }

    function protocolFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_protocolFeeRecipient, _protocolFee);
    }

    function operationalFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_operationalFeeRecipient, _operationalFee);
    }

    function setOrderBook(address _orderBook) external override onlyOwner {
        require(_orderBook != address(0), "SHOYU: INVALID_ORDER_BOOK");

        orderBook = _orderBook;
    }

    function setProtocolFeeRecipient(address protocolFeeRecipient) external override onlyOwner {
        require(protocolFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        _protocolFeeRecipient = protocolFeeRecipient;
    }

    function setOperationalFeeRecipient(address operationalFeeRecipient) external override onlyOwner {
        require(operationalFeeRecipient != address(0), "SHOYU: INVALID_RECIPIENT");

        _operationalFeeRecipient = operationalFeeRecipient;
    }

    function setStrategyWhitelisted(address ask, bool whitelisted) external override onlyOwner {
        require(ask != address(0), "SHOYU: INVALID_SALE");

        isStrategyWhitelisted[ask] = whitelisted;
    }

    function createNFT721(
        string calldata baseURI,
        string calldata name,
        string calldata symbol,
        uint8 royaltyFee,
        uint8 charityDenominator
    ) external override returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");

        nft = _createProxy(
            _target721,
            abi.encodeWithSignature(
                "initialize(string,string,string,address,address,uint8,uint8)",
                baseURI,
                name,
                symbol,
                msg.sender,
                msg.sender,
                royaltyFee,
                charityDenominator
            )
        );

        emit CreateNFT721(nft, baseURI, name, symbol, msg.sender, royaltyFee, charityDenominator);
    }

    function isNFT721(address query) external view override returns (bool result) {
        return _isProxy(_target721, query);
    }

    function createNFT1155(
        string calldata uri,
        uint8 royaltyFee,
        uint8 charityDenominator
    ) external override returns (address nft) {
        nft = _createProxy(
            _target1155,
            abi.encodeWithSignature(
                "initialize(string,address,address,uint8,uint8)",
                uri,
                msg.sender,
                msg.sender,
                royaltyFee,
                charityDenominator
            )
        );

        emit CreateNFT1155(nft, uri, msg.sender, royaltyFee, charityDenominator);
    }

    function isNFT1155(address query) external view override returns (bool result) {
        return _isProxy(_target1155, query);
    }

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        IBaseNFT721(nft).mint(to, tokenId);
        _setTags(nft, tokenId, tags);
    }

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        string[] memory tags
    ) external override {
        IBaseNFT1155(nft).mint(to, tokenId, amount);
        _setTags(nft, tokenId, tags);
    }

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        require(IBaseNFT721(nft).ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        require(IBaseNFT1155(nft).balanceOf(msg.sender, tokenId) > 0, "SHOYU: FORBIDDEN");
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
