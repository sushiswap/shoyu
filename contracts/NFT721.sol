// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./ProxyFactory.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IStrategy.sol";

contract Shoyu721 is ERC721Upgradeable, ProxyFactory {
    string public uid;
    address public factory;
    mapping(uint256 => address) public openSaleOf;

    event CreateSale(address sale, uint256 indexed tokenId, address indexed strategy, bytes initData);
    event CancelSale(address sale, uint256 indexed tokenId);

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _uid
    ) external initializer {
        __ERC721_init(_name, _symbol);
        uid = _uid;
        factory = msg.sender;
    }

    function _baseURI() internal view override returns (string memory) {
        return string(abi.encodePacked("https://erc721meta.sushi.com/", uid));
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        if (openSaleOf[tokenId] != address(0)) {
            cancelSale(tokenId);
        }
    }

    function createSale(
        uint256 tokenId,
        address strategy,
        bytes calldata initData
    ) external returns (address sale) {
        require(ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        require(openSaleOf[tokenId] == address(0), "SHOYU: SALE_EXISTS");
        require(INFTFactory(factory).isStrategyWhitelisted(strategy), "SHOYU: STRATEGY_NOT_ALLOWED");

        sale = _createProxy(strategy, initData);
        openSaleOf[tokenId] = sale;

        emit CreateSale(sale, tokenId, strategy, initData);
    }

    function cancelSale(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        address sale = openSaleOf[tokenId];
        require(sale != address(0), "SHOYU: NO_OPEN_SALE");
        openSaleOf[tokenId] = address(0);

        IStrategy(sale).cancel();

        emit CancelSale(sale, tokenId);
    }
}
