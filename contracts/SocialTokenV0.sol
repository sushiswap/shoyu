// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./base/DividendPayingERC20.sol";
import "./base/BaseExchange.sol";
import "./base/OwnableInitializable.sol";
import "./interfaces/ISocialToken.sol";

contract SocialTokenV0 is DividendPayingERC20, BaseExchange, OwnableInitializable, ISocialToken {
    bytes32 internal _DOMAIN_SEPARATOR;
    uint256 internal _CACHED_CHAIN_ID;
    address internal _factory;

    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        address _dividendToken
    ) external override initializer {
        __Ownable_init(_owner);
        __DividendPayingERC20_init(_name, _symbol, _dividendToken);
        _factory = msg.sender;

        _CACHED_CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                keccak256(bytes(_name)),
                0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view override(BaseExchange, IBaseExchange) returns (bytes32) {
        bytes32 domainSeparator;
        if (_CACHED_CHAIN_ID == block.chainid) domainSeparator = _DOMAIN_SEPARATOR;
        else {
            domainSeparator = keccak256(
                abi.encode(
                    // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                    0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                    keccak256(bytes(name())),
                    0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                    block.chainid,
                    address(this)
                )
            );
        }
        return domainSeparator;
    }

    function factory() public view override(BaseExchange, IBaseExchange) returns (address) {
        return _factory;
    }

    function _transfer(
        address,
        address from,
        address to,
        uint256,
        uint256 amount
    ) internal override {
        _transfer(from, to, amount);
    }

    function mint(address account, uint256 value) external override onlyOwner {
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
}
