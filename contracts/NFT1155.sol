// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./base/ERC1155Initializable.sol";
import "./base/OwnableInitializable.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IStrategy.sol";
import "./factories/ProxyFactory.sol";
import "./base/Taggable.sol";
import "./interfaces/INFT1155.sol";

contract NFT1155 is ERC1155Initializable, OwnableInitializable, ProxyFactory, Taggable, INFT1155 {
    using Strings for uint256;

    address public override factory;
    mapping(address => mapping(uint256 => mapping(address => bool))) public isOpenSale;
    mapping(address => mapping(uint256 => uint256)) public amountForSale;

    event Mint(address to, uint256 indexed tokenId, uint256 amount);
    event CreateSale(
        address sale,
        address indexed account,
        uint256 indexed tokenId,
        uint256 amount,
        address indexed strategy,
        bytes initData
    );
    event CloseSale(address sale, address indexed account, uint256 indexed tokenId);

    function initialize(address _owner) external initializer {
        __ERC1155_init("https://erc1155meta.sushi.com/{id}.json");
        __Ownable_init(_owner);
        factory = msg.sender;
    }

    function _beforeTokenTransfer(
        address,
        address from,
        address,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory
    ) internal override {
        for (uint256 i; i < ids.length; i++) {
            uint256 tokenId = ids[i];
            require(
                balanceOf(from, tokenId) >= amountForSale[from][tokenId] + amounts[i],
                "SHOYU: INSUFFICIENT_BALANCE"
            );
        }
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data,
        string[] memory tags
    ) external override onlyOwner {
        _mint(to, tokenId, amount, data);
        setTags(tokenId, tags);

        emit Mint(to, tokenId, amount);
    }

    function mintBatch(
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes memory data,
        string[][] memory tags
    ) external override onlyOwner {
        _mintBatch(to, tokenIds, amounts, data);
        for (uint256 i; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            setTags(tokenId, tags[i]);

            emit Mint(to, tokenId, amounts[i]);
        }
    }

    function burn(
        address account,
        uint256 tokenId,
        uint256 amount
    ) external override {
        _burn(account, tokenId, amount);
    }

    function burnBatch(
        address account,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external override {
        _burnBatch(account, tokenIds, amounts);
    }

    function createSale(
        uint256 tokenId,
        uint256 amount,
        address strategy,
        bytes calldata initData
    ) external override returns (address sale) {
        require(
            balanceOf(msg.sender, tokenId) >= amountForSale[msg.sender][tokenId] + amount,
            "SHOYU: INSUFFICIENT_BALANCE"
        );
        require(INFTFactory(factory).isStrategyWhitelisted1155(strategy), "SHOYU: STRATEGY_NOT_ALLOWED");

        sale = _createProxy(strategy, initData);
        setApprovalForAll(sale, true);
        isOpenSale[msg.sender][tokenId][sale] = true;
        amountForSale[msg.sender][tokenId] += amount;

        emit CreateSale(sale, msg.sender, tokenId, amount, strategy, initData);
    }

    function closeSale(address account, uint256 tokenId) public override {
        mapping(address => bool) storage sales = isOpenSale[account][tokenId];
        address sale = msg.sender;
        require(sales[sale], "SHOYU: FORBIDDEN");
        sales[sale] = false;
        // TODO: amountForSale[account][tokenId] -= amount;

        emit CloseSale(sale, account, tokenId);
    }
}
