// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";

import "./base/DividendPayingERC20.sol";
import "./base/OwnableInitializable.sol";
import "./interfaces/ISocialToken.sol";
import "./libraries/Signature.sol";

contract SocialTokenV0 is DividendPayingERC20, OwnableInitializable, ISocialToken {
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    bytes32 internal _DOMAIN_SEPARATOR;
    uint256 internal _CACHED_CHAIN_ID;
    address internal _factory;

    mapping(address => uint256) public override nonces;

    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        address _dividendToken,
        uint256 initialSupply
    ) external override initializer {
        __Ownable_init(_owner);
        __DividendPayingERC20_init(_name, _symbol, _dividendToken);
        _factory = msg.sender;
        _mint(_owner, initialSupply);

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

    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
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

    function factory() public view override returns (address) {
        return _factory;
    }

    function mint(address account, uint256 value) external override {
        require(owner() == msg.sender || _factory == msg.sender, "SHOYU: FORBIDDEN");

        _mint(account, value);
    }

    function burn(
        uint256 value,
        uint256 label,
        bytes32 data
    ) external override {
        _burn(msg.sender, value);

        emit Burn(value, label, data);
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        require(block.timestamp <= deadline, "SHOYU: EXPIRED");
        require(owner != address(0), "SHOYU: INVALID_ADDRESS");
        require(spender != owner, "SHOYU: NOT_NECESSARY");

        bytes32 hash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());

        _approve(owner, spender, value);
    }
}
