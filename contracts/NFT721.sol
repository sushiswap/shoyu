// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT721.sol";
import "./interfaces/IERC1271.sol";
import "./base/ERC721Initializable.sol";
import "./base/OwnableInitializable.sol";
import "./factories/ProxyFactory.sol";

contract NFT721 is ERC721Initializable, OwnableInitializable, ProxyFactory, INFT721 {
    // keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_TYPEHASH =
        0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;
    // keccak256("Permit(address owner,address spender,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_ALL_TYPEHASH =
        0xdaab21af31ece73a508939fedd476a5ee5129a5ed4bb091f3236ffb45394df62;
    bytes32 internal _DOMAIN_SEPARATOR;

    address public override factory;

    mapping(uint256 => uint256) public override nonces;
    mapping(address => uint256) public override noncesForAll;

    string internal __baseURI;

    modifier onlyOwnerOf(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _;
    }

    function initialize(
        string memory _baseURI_,
        string memory _name,
        string memory _symbol,
        address _owner
    ) public override initializer {
        __ERC721_init(_name, _symbol);
        __Ownable_init(_owner);
        __baseURI = _baseURI_;
        factory = msg.sender;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        _DOMAIN_SEPARATOR = keccak256(
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

    function DOMAIN_SEPARATOR() external view virtual override returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function _baseURI() internal view override returns (string memory) {
        return __baseURI;
    }

    function mint(address to, uint256 tokenId) external override {
        require(factory == msg.sender || owner() == msg.sender, "SHOYU: FORBIDDEN");

        _mint(to, tokenId);

        emit Mint(to, tokenId);
    }

    function burn(uint256 tokenId) external override onlyOwnerOf(tokenId) {
        _burn(tokenId);
    }

    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        require(block.timestamp <= deadline, "SHOYU: EXPIRED");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    _DOMAIN_SEPARATOR,
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
    ) external override {
        require(block.timestamp <= deadline, "SHOYU: EXPIRED");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    _DOMAIN_SEPARATOR,
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
