// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./base/ERC721Initializable.sol";
import "./base/OwnableInitializable.sol";
import "./interfaces/INFT.sol";
import "./interfaces/INFTFactory.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IERC1271.sol";
import "./factories/ProxyFactory.sol";
import "./base/Taggable.sol";

contract NFT721 is ERC721Initializable, OwnableInitializable, ProxyFactory, Taggable, INFT {
    using Strings for uint256;

    // keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH = 0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;
    // keccak256("Permit(address owner,address spender,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_ALL_TYPEHASH = 0xdaab21af31ece73a508939fedd476a5ee5129a5ed4bb091f3236ffb45394df62;
    bytes32 public DOMAIN_SEPARATOR;

    string public baseURI;
    address public override factory;
    mapping(uint256 => address) public openSaleOf;
    mapping(uint256 => uint256) public nonces;
    mapping(address => uint256) public noncesForAll;

    event Mint(address to, uint256 indexed tokenId);
    event CreateSale(address sale, uint256 indexed tokenId, address indexed strategy, bytes config);
    event CloseSale(address sale, uint256 indexed tokenId);

    modifier onlyOwnerOf(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _;
    }

    function initialize(
        string memory __baseURI,
        string memory _name,
        string memory _symbol,
        address _owner
    ) external initializer {
        __ERC721_init(_name, _symbol);
        __Ownable_init(_owner);
        baseURI = __baseURI;
        factory = msg.sender;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                bytes(_name),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function _beforeTokenTransfer(
        address,
        address,
        uint256 tokenId
    ) internal override {
        require(openSaleOf[tokenId] == address(0), "SHOYU: OPEN_SALE");
    }

    function setTags(uint256 tokenId, string[] memory tags) external onlyOwnerOf(tokenId) {
        _setTags(tokenId, tags);
    }

    function mint(
        address to,
        uint256 tokenId,
        bytes calldata data,
        string[] calldata tags
    ) external onlyOwner {
        _safeMint(to, tokenId, data);
        _setTags(tokenId, tags);

        emit Mint(to, tokenId);
    }

    function burn(uint256 tokenId) external onlyOwnerOf(tokenId) {
        _burn(tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) external override {
        safeTransferFrom(from, to, tokenId);
    }

    function createSale(
        uint256 tokenId,
        address strategy,
        bytes calldata config
    ) external onlyOwnerOf(tokenId) returns (address sale) {
        require(openSaleOf[tokenId] == address(0), "SHOYU: SALE_EXISTS");
        require(INFTFactory(factory).isStrategyWhitelisted(strategy), "SHOYU: STRATEGY_NOT_ALLOWED");

        sale = _createProxy(strategy, new bytes(0));
        IStrategy(sale).initialize(msg.sender, tokenId, 1, config);
        _approve(sale, tokenId);
        openSaleOf[tokenId] = sale;

        emit CreateSale(sale, tokenId, strategy, config);
    }

    function closeSale(uint256 tokenId, uint256) public override {
        address sale = openSaleOf[tokenId];
        require(sale == msg.sender, "SHOYU: FORBIDDEN");
        openSaleOf[tokenId] = address(0);

        emit CloseSale(sale, tokenId);
    }

    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, "SHOYU: EXPIRED");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(abi.encode(PERMIT_TYPEHASH, spender, tokenId, nonces[tokenId], deadline))
                )
            );
        nonces[tokenId] += 1;

        address owner = ownerOf(tokenId);
        require(spender != owner, "SHOYU: NOT_NECESSARY");

        if (Address.isContract(owner)) {
            require(
                IERC1271(owner).isValidSignature(digest, abi.encodePacked(r, s, v)) == 0x1626ba7e,
                "SHOYU: UNAUTHORIZED"
            );
        } else {
            address recoveredAddress = ecrecover(digest, v, r, s);
            require(recoveredAddress != address(0), "SHOYU: INVALID_SIGNATURE");
            require(recoveredAddress == owner, "SHOYU: UNAUTHORIZED");
        }

        _approve(spender, tokenId);
    }

    function permitAll(
        address owner,
        address spender,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, "SHOYU: EXPIRED");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(abi.encode(PERMIT_ALL_TYPEHASH, owner, spender, noncesForAll[owner], deadline))
                )
            );
        noncesForAll[owner] += 1;

        if (Address.isContract(owner)) {
            require(
                IERC1271(owner).isValidSignature(digest, abi.encodePacked(r, s, v)) == 0x1626ba7e,
                "SHOYU: UNAUTHORIZED"
            );
        } else {
            address recoveredAddress = ecrecover(digest, v, r, s);
            require(recoveredAddress != address(0), "SHOYU: INVALID_SIGNATURE");
            require(recoveredAddress == owner, "SHOYU: UNAUTHORIZED");
        }

        _setApprovalForAll(owner, spender, true);
    }
}
