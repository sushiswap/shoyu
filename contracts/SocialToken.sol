// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base/DividendPayingERC20.sol";
import "./base/BaseExchange.sol";
import "./base/OwnableInitializable.sol";
import "./interfaces/ISocialToken.sol";

contract SocialToken is DividendPayingERC20, BaseExchange, OwnableInitializable, ISocialToken {
    event Mint(address indexed account, uint256 indexed value);
    event Burn(address indexed account, uint256 indexed value, bytes32 data);

    bytes32 internal _DOMAIN_SEPARATOR;
    address internal _factory;

    function initialize(
        string memory _name,
        string memory _symbol,
        address _dividendToken,
        address _owner
    ) external override initializer {
        __DividendPayingERC20_init(_name, _symbol, _dividendToken);
        __Ownable_init(_owner);
        _factory = msg.sender;

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

    function DOMAIN_SEPARATOR() public view override(BaseExchange, IBaseExchange) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
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

        emit Mint(account, value);
    }

    function burn(uint256 value, bytes32 data) external override {
        _burn(msg.sender, value);

        emit Burn(msg.sender, value, data);
    }
}
