// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./base/ERC1155Initializable.sol";
import "./base/OwnableInitializable.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IStrategy.sol";
import "./factories/ProxyFactory.sol";
import "./base/Taggable.sol";
import "./interfaces/INFT.sol";

contract NFT1155 is ERC1155Initializable, OwnableInitializable, ProxyFactory, Taggable, INFT {
    using Strings for uint256;

    address public override factory;
    mapping(address => bool) public isOpenSale;
    mapping(address => mapping(uint256 => uint256)) public amountForSale;

    event Mint(address to, uint256 indexed tokenId, uint256 amount);
    event CreateSale(
        address sale,
        address indexed account,
        uint256 indexed tokenId,
        uint256 amount,
        address indexed strategy,
        bytes config
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
    ) external onlyOwner {
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
    ) external onlyOwner {
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
    ) external {
        _burn(account, tokenId, amount);
    }

    function burnBatch(
        address account,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external {
        _burnBatch(account, tokenIds, amounts);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external override {
        safeTransferFrom(from, to, tokenId, amount, new bytes(0));
    }

    function createSale(
        uint256 tokenId,
        uint256 amount,
        address strategy,
        bytes calldata config
    ) external returns (address sale) {
        require(
            balanceOf(msg.sender, tokenId) >= amountForSale[msg.sender][tokenId] + amount,
            "SHOYU: INSUFFICIENT_BALANCE"
        );
        require(INFTFactory(factory).isStrategyWhitelisted(strategy), "SHOYU: STRATEGY_NOT_ALLOWED");

        sale = _createProxy(strategy, new bytes(0));
        IStrategy(sale).initialize(msg.sender, tokenId, amount, config);
        setApprovalForAll(sale, true);
        isOpenSale[sale] = true;
        amountForSale[msg.sender][tokenId] += amount;

        emit CreateSale(sale, msg.sender, tokenId, amount, strategy, config);
    }

    function closeSale(uint256 tokenId, uint256 amount) public override {
        require(isOpenSale[msg.sender], "SHOYU: FORBIDDEN");
        isOpenSale[msg.sender] = false;

        address account = IStrategy(msg.sender).owner();
        amountForSale[account][tokenId] -= amount;

        emit CloseSale(msg.sender, account, tokenId);
    }
}
