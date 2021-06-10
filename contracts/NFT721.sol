// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./base/ERC721Initializable.sol";
import "./base/OwnableInitializable.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IStrategy.sol";
import "./factories/ProxyFactory.sol";
import "./base/Taggable.sol";
import "./interfaces/INFT721.sol";

contract NFT721 is ERC721Initializable, OwnableInitializable, ProxyFactory, Taggable, INFT721 {
    using Strings for uint256;

    address public override factory;
    mapping(uint256 => address) public override openSaleOf;

    event Mint(address to, uint256 indexed tokenId);
    event CreateSale(address sale, uint256 indexed tokenId, address indexed strategy, bytes initData);
    event CloseSale(address sale, uint256 indexed tokenId);

    modifier onlyOwnerOf(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _;
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address _owner
    ) external initializer {
        __ERC721_init(_name, _symbol);
        __Ownable_init(_owner);
        factory = msg.sender;
    }

    function _baseURI() internal view override returns (string memory) {
        return string(abi.encodePacked("https://erc721meta.sushi.com/", uint256(uint160(address(this))).toHexString()));
    }

    function _beforeTokenTransfer(
        address,
        address,
        uint256 tokenId
    ) internal override {
        address sale = openSaleOf[tokenId];
        require(sale == address(0) || sale == msg.sender, "SHOYU: OPEN_SALE");
    }

    function mint(
        address to,
        uint256 tokenId,
        bytes calldata data,
        string[] calldata tags
    ) external override onlyOwner {
        _safeMint(to, tokenId, data);
        setTags(tokenId, tags);

        emit Mint(to, tokenId);
    }

    function burn(uint256 tokenId) external override onlyOwnerOf(tokenId) {
        _burn(tokenId);
    }

    function createSale(
        uint256 tokenId,
        address strategy,
        bytes calldata initData
    ) external override onlyOwnerOf(tokenId) returns (address sale) {
        require(openSaleOf[tokenId] == address(0), "SHOYU: SALE_EXISTS");
        require(INFTFactory(factory).isStrategyWhitelisted721(strategy), "SHOYU: STRATEGY_NOT_ALLOWED");

        sale = _createProxy(strategy, initData);
        _approve(sale, tokenId);
        openSaleOf[tokenId] = sale;

        emit CreateSale(sale, tokenId, strategy, initData);
    }

    function closeSale(uint256 tokenId) public override onlyOwnerOf(tokenId) {
        address sale = openSaleOf[tokenId];
        IStrategy(sale).cancel();
        openSaleOf[tokenId] = address(0);

        emit CloseSale(sale, tokenId);
    }
}
