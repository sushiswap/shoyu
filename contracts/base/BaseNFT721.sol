// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";

import "../interfaces/IBaseNFT721.sol";
import "../interfaces/IERC1271.sol";
import "../interfaces/ITokenFactory.sol";
import "../base/ERC721Initializable.sol";
import "../base/OwnableInitializable.sol";
import "../libraries/Signature.sol";

abstract contract BaseNFT721 is ERC721Initializable, OwnableInitializable, IBaseNFT721 {
    // keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_TYPEHASH =
        0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;
    // keccak256("Permit(address owner,address spender,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_ALL_TYPEHASH =
        0xdaab21af31ece73a508939fedd476a5ee5129a5ed4bb091f3236ffb45394df62;
    bytes32 internal _DOMAIN_SEPARATOR;
    uint256 internal _CACHED_CHAIN_ID;

    address internal _factory;
    string internal __baseURI;
    mapping(uint256 => string) internal _uris;

    mapping(uint256 => uint256) public override nonces;
    mapping(address => uint256) public override noncesForAll;

    function initialize(
        string memory _name,
        string memory _symbol,
        address _owner
    ) public override initializer {
        __ERC721_init(_name, _symbol);
        __Ownable_init(_owner);
        _factory = msg.sender;

        _CACHED_CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                keccak256(bytes(Strings.toHexString(uint160(address(this))))),
                0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32) {
        bytes32 domainSeparator;
        if (_CACHED_CHAIN_ID == block.chainid) domainSeparator = _DOMAIN_SEPARATOR;
        else {
            domainSeparator = keccak256(
                abi.encode(
                    // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                    0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                    keccak256(bytes(Strings.toHexString(uint160(address(this))))),
                    0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                    block.chainid,
                    address(this)
                )
            );
        }
        return domainSeparator;
    }

    function factory() public view virtual override returns (address) {
        return _factory;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Initializable, IERC721Metadata)
        returns (string memory)
    {
        require(_exists(tokenId) || _parked(tokenId), "SHOYU: INVALID_TOKEN_ID");

        string memory _uri = _uris[tokenId];
        if (bytes(_uri).length > 0) {
            return _uri;
        } else {
            string memory baseURI = __baseURI;
            if (bytes(baseURI).length > 0) {
                return string(abi.encodePacked(baseURI, Strings.toString(tokenId), ".json"));
            } else {
                baseURI = ITokenFactory(_factory).baseURI721();
                string memory addy = Strings.toHexString(uint160(address(this)), 20);
                return string(abi.encodePacked(baseURI, addy, "/", Strings.toString(tokenId), ".json"));
            }
        }
    }

    function parked(uint256 tokenId) external view override returns (bool) {
        return _parked(tokenId);
    }

    function setTokenURI(uint256 id, string memory newURI) external override onlyOwner {
        _uris[id] = newURI;

        emit SetTokenURI(id, newURI);
    }

    function setBaseURI(string memory uri) external override onlyOwner {
        __baseURI = uri;

        emit SetBaseURI(uri);
    }

    function parkTokenIds(uint256 toTokenId) external override {
        require(owner() == msg.sender || _factory == msg.sender, "SHOYU: FORBIDDEN");

        _parkTokenIds(toTokenId);

        emit ParkTokenIds(toTokenId);
    }

    function mint(
        address to,
        uint256 tokenId,
        bytes memory data
    ) external override {
        require(owner() == msg.sender || _factory == msg.sender, "SHOYU: FORBIDDEN");

        _safeMint(to, tokenId, data);
    }

    function mintBatch(
        address to,
        uint256[] memory tokenIds,
        bytes memory data
    ) external override {
        require(owner() == msg.sender || _factory == msg.sender, "SHOYU: FORBIDDEN");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _safeMint(to, tokenIds[i], data);
        }
    }

    function burn(
        uint256 tokenId,
        uint256 label,
        bytes32 data
    ) external override {
        require(ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");

        _burn(tokenId);

        emit Burn(tokenId, label, data);
    }

    function burnBatch(uint256[] memory tokenIds) external override {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");

            _burn(tokenId);
        }
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

        address owner = ownerOf(tokenId);
        require(owner != address(0), "SHOYU: INVALID_TOKENID");
        require(spender != owner, "SHOYU: NOT_NECESSARY");

        bytes32 hash = keccak256(abi.encode(PERMIT_TYPEHASH, spender, tokenId, nonces[tokenId]++, deadline));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());

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
        require(owner != address(0), "SHOYU: INVALID_ADDRESS");
        require(spender != owner, "SHOYU: NOT_NECESSARY");

        bytes32 hash = keccak256(abi.encode(PERMIT_ALL_TYPEHASH, owner, spender, noncesForAll[owner]++, deadline));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());

        _setApprovalForAll(owner, spender, true);
    }
}
