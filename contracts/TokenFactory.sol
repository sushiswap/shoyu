// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/ITokenFactory.sol";
import "./base/ProxyFactory.sol";
import "./ERC721Exchange.sol";
import "./ERC1155Exchange.sol";
import "./NFT721.sol";
import "./NFT1155.sol";
import "./SocialToken.sol";

contract TokenFactory is ProxyFactory, Ownable, ITokenFactory {
    uint8 public constant override MAX_ROYALTY_FEE = 250; // 25%
    uint8 public constant override MAX_OPERATIONAL_FEE = 50; // 5%

    address internal immutable _target721;
    address internal immutable _target1155;
    address internal immutable _targetSocialToken;

    address internal _protocolFeeRecipient;
    uint8 internal _protocolFee; // out of 1000
    address internal _operationalFeeRecipient;
    uint8 internal _operationalFee; // out of 1000

    string public override baseURI721;
    string public override baseURI1155;

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
        uint8 operationalFee,
        string memory _baseURI721,
        string memory _baseURI1155
    ) {
        orderBook = _orderBook;
        _protocolFeeRecipient = protocolFeeRecipient;
        _protocolFee = protocolFee;
        _operationalFeeRecipient = operationalFeeRecipient;
        _operationalFee = operationalFee;

        baseURI721 = _baseURI721;
        baseURI1155 = _baseURI1155;

        erc721Exchange = address(new ERC721Exchange());
        erc1155Exchange = address(new ERC1155Exchange());

        NFT721 nft721 = new NFT721();
        nft721.initialize("", "", address(0));
        _target721 = address(nft721);

        NFT1155 nft1155 = new NFT1155();
        nft1155.initialize(address(0));
        _target1155 = address(nft1155);

        SocialToken token = new SocialToken();
        token.initialize("", "", address(0), address(0));
        _targetSocialToken = address(token);
    }

    function protocolFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_protocolFeeRecipient, _protocolFee);
    }

    function operationalFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_operationalFeeRecipient, _operationalFee);
    }

    function setBaseURI721(string memory uri) external override onlyOwner {
        baseURI721 = uri;
    }

    function setBaseURI1155(string memory uri) external override onlyOwner {
        baseURI1155 = uri;
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

    function setOperationalFee(uint8 operationalFee) external override onlyOwner {
        require(operationalFee <= MAX_OPERATIONAL_FEE, "SHOYU: INVALID_FEE");

        _operationalFee = operationalFee;
    }

    function setStrategyWhitelisted(address ask, bool whitelisted) external override onlyOwner {
        require(ask != address(0), "SHOYU: INVALID_SALE");

        isStrategyWhitelisted[ask] = whitelisted;
    }

    function createNFT721(
        string calldata name,
        string calldata symbol,
        uint256[] memory tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");

        nft = _createProxy(
            _target721,
            abi.encodeWithSignature(
                "initialize(string,string,address,uint256[],address,uint8)",
                name,
                symbol,
                msg.sender,
                tokenIds,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit CreateNFT721(nft, name, symbol, msg.sender, tokenIds, royaltyFeeRecipient, royaltyFee);
    }

    function createNFT721(
        string calldata name,
        string calldata symbol,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");

        nft = _createProxy(
            _target721,
            abi.encodeWithSignature(
                "initialize(string,string,address,uint256,address,uint8)",
                name,
                symbol,
                msg.sender,
                toTokenId,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit CreateNFT721(nft, name, symbol, msg.sender, toTokenId, royaltyFeeRecipient, royaltyFee);
    }

    function isNFT721(address query) external view override returns (bool result) {
        return _isProxy(_target721, query);
    }

    function createNFT1155(
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override returns (address nft) {
        nft = _createProxy(
            _target1155,
            abi.encodeWithSignature(
                "initialize(address,uint256[],uint256[],address,uint8)",
                msg.sender,
                tokenIds,
                amounts,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit CreateNFT1155(nft, msg.sender, tokenIds, amounts, royaltyFeeRecipient, royaltyFee);
    }

    function isNFT1155(address query) external view override returns (bool result) {
        return _isProxy(_target1155, query);
    }

    function createSocialToken(
        string memory name,
        string memory symbol,
        address dividendToken
    ) external override returns (address proxy) {
        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(string,string,address,address)",
                name,
                symbol,
                dividendToken,
                msg.sender
            );
        proxy = _createProxy(_targetSocialToken, initData);

        emit CreateSocialToken(proxy, name, symbol, msg.sender, dividendToken);
    }

    function isSocialToken(address query) external view override returns (bool result) {
        return _isProxy(_targetSocialToken, query);
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
