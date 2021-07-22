// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";

import "../interfaces/IBaseNFT1155.sol";
import "../interfaces/IERC1271.sol";
import "../interfaces/ITokenFactory.sol";
import "../base/ERC1155Initializable.sol";
import "../base/OwnableInitializable.sol";

abstract contract BaseNFT1155 is ERC1155Initializable, OwnableInitializable, IBaseNFT1155 {
    using Strings for uint256;

    // keccak256("Permit(address owner,address spender,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_TYPEHASH =
        0xdaab21af31ece73a508939fedd476a5ee5129a5ed4bb091f3236ffb45394df62;
    bytes32 internal _DOMAIN_SEPARATOR;

    address internal _factory;
    string internal _baseURI;

    mapping(address => uint256) public override nonces;

    function initialize(address _owner) public override initializer {
        __ERC1155_init("");
        __Ownable_init(_owner);
        _factory = msg.sender;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(Strings.toHexString(uint160(address(this))))),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view virtual override returns (address) {
        return _factory;
    }

    function uri(uint256) public view virtual override returns (string memory) {
        string memory baseURI;
        if (bytes(_baseURI).length > 0) {
            baseURI = _baseURI;
        } else {
            string memory baseURI_ = ITokenFactory(_factory).baseURI1155();
            string memory addy = Strings.toHexString(uint160(address(this)), 20);
            baseURI = string(abi.encodePacked(baseURI_, addy, "/"));
        }
        return string(abi.encodePacked(baseURI, "/{id}"));
    }

    function setBaseURI(string memory baseURI) external override onlyOwner {
        _baseURI = baseURI;
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) external override {
        require(_factory == msg.sender || owner() == msg.sender, "SHOYU: FORBIDDEN");

        _mint(to, tokenId, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        bytes memory data
    ) external override {
        require(owner() == msg.sender, "SHOYU: FORBIDDEN");

        _mintBatch(to, tokenIds, amounts, data);
    }

    function burn(uint256 tokenId, uint256 amount) external override {
        _burn(msg.sender, tokenId, amount);
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
        require(block.timestamp <= deadline);

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    _DOMAIN_SEPARATOR,
                    keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, nonces[owner], deadline))
                )
            );
        nonces[owner] += 1;

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
