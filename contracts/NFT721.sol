// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IStrategy.sol";
import "./factories/ProxyFactory.sol";

contract NFT721 is ERC721Upgradeable, OwnableUpgradeable, ProxyFactory {
    using Strings for uint256;

    address public factory;
    mapping(uint256 => address) public openSaleOf;

    mapping(uint256 => string[]) private _tags;

    event Mint(address to, uint256 indexed tokenId);
    event SetTags(string[] tags, uint256 indexed tokenId);
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
        __Ownable_init();
        transferOwnership(_owner);
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
        if (openSaleOf[tokenId] != address(0)) {
            closeSale(tokenId);
        }
    }

    function tagsOf(uint256 tokenId) public view returns (string[] memory) {
        return _tags[tokenId];
    }

    function mint(
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external onlyOwner {
        _mint(to, tokenId);
        setTags(tokenId, tags);

        emit Mint(to, tokenId);
    }

    function burn(uint256 tokenId) external onlyOwnerOf(tokenId) {
        _burn(tokenId);
    }

    function setTags(uint256 tokenId, string[] memory tags) public onlyOwnerOf(tokenId) {
        _tags[tokenId] = tags;

        emit SetTags(tags, tokenId);
    }

    function createSale(
        uint256 tokenId,
        address strategy,
        bytes calldata initData
    ) external onlyOwnerOf(tokenId) returns (address sale) {
        require(openSaleOf[tokenId] == address(0), "SHOYU: SALE_EXISTS");
        require(INFTFactory(factory).isStrategyWhitelisted(strategy), "SHOYU: STRATEGY_NOT_ALLOWED");

        sale = _createProxy(strategy, initData);
        _approve(sale, tokenId);
        openSaleOf[tokenId] = sale;

        emit CreateSale(sale, tokenId, strategy, initData);
    }

    function closeSale(uint256 tokenId) public onlyOwnerOf(tokenId) {
        address sale = openSaleOf[tokenId];
        require(sale == msg.sender, "SHOYU: FORBIDDEN");
        openSaleOf[tokenId] = address(0);

        emit CloseSale(sale, tokenId);
    }
}
