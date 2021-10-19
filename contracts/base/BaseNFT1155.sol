// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";

import "../interfaces/IBaseNFT1155.sol";
import "../interfaces/IERC1271.sol";
import "../interfaces/ITokenFactory.sol";
import "../base/ERC1155Initializable.sol";
import "../base/OwnableInitializable.sol";
import "../libraries/Signature.sol";

abstract contract BaseNFT1155 is ERC1155Initializable, OwnableInitializable, IBaseNFT1155 {
    using Strings for uint256;

    // keccak256("Permit(address owner,address spender,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_TYPEHASH =
        0xdaab21af31ece73a508939fedd476a5ee5129a5ed4bb091f3236ffb45394df62;
    bytes32 internal _DOMAIN_SEPARATOR;
    uint256 internal _CACHED_CHAIN_ID;
    uint8 internal MAX_ROYALTY_FEE;

    address internal _factory;
    string internal _baseURI;
    mapping(uint256 => string) internal _uris;

    mapping(address => uint256) public override nonces;

    function initialize(address _owner) public override initializer {
        __ERC1155_init("");
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

    function uri(uint256 id)
        public
        view
        virtual
        override(ERC1155Initializable, IERC1155MetadataURI)
        returns (string memory)
    {
        string memory _uri = _uris[id];
        if (bytes(_uri).length > 0) {
            return _uri;
        } else {
            string memory baseURI = _baseURI;
            if (bytes(baseURI).length > 0) {
                return string(abi.encodePacked(baseURI, Strings.toString(id), ".json"));
            } else {
                baseURI = ITokenFactory(_factory).baseURI1155();
                string memory addy = Strings.toHexString(uint160(address(this)), 20);
                return string(abi.encodePacked(baseURI, addy, "/", Strings.toString(id), ".json"));
            }
        }
    }

    function setURI(uint256 id, string memory newURI) external override onlyOwner {
        _uris[id] = newURI;

        emit SetURI(id, newURI);
    }

    function setBaseURI(string memory baseURI) external override onlyOwner {
        _baseURI = baseURI;

        emit SetBaseURI(baseURI);
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) external override {
        require(owner() == msg.sender || _factory == msg.sender, "SHOYU: FORBIDDEN");

        _mint(to, tokenId, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        bytes memory data
    ) external override {
        require(owner() == msg.sender || _factory == msg.sender, "SHOYU: FORBIDDEN");

        _mintBatch(to, tokenIds, amounts, data);
    }

    function burn(
        uint256 tokenId,
        uint256 amount,
        uint256 label,
        bytes32 data
    ) external override {
        _burn(msg.sender, tokenId, amount);

        emit Burn(tokenId, amount, label, data);
    }

    function burnBatch(uint256[] calldata tokenIds, uint256[] calldata amounts) external override {
        _burnBatch(msg.sender, tokenIds, amounts);
    }

    function permit(
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

        bytes32 hash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, nonces[owner]++, deadline));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());

        _setApprovalForAll(owner, spender, true);
    }
}
