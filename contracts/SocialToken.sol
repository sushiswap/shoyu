// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./base/DividendPayingERC20.sol";
import "./interfaces/ISocialToken.sol";

contract SocialToken is DividendPayingERC20, AccessControl, ISocialToken {
    event Mint(address indexed account, uint256 indexed value);
    event Burn(address indexed account, uint256 indexed value, bytes32 data);

    bytes32 public constant override MINTER_ROLE = keccak256("MINTER_ROLE");

    function initialize(
        string memory _name,
        string memory _symbol,
        address _dividendToken,
        address _owner
    ) external override initializer {
        __DividendPayingERC20_init(_name, _symbol, _dividendToken);
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MINTER_ROLE, _owner);
    }

    function mint(address account, uint256 value) external override {
        require(hasRole(MINTER_ROLE, msg.sender), "SHOYU: FORBIDDEN");

        _mint(account, value);

        emit Mint(account, value);
    }

    function burn(uint256 value, bytes32 data) external override {
        _burn(msg.sender, value);

        emit Burn(msg.sender, value, data);
    }
}
