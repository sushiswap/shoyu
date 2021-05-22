// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./DividendPayingERC20.sol";

contract SocialToken is DividendPayingERC20, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function initialize(
        string memory _name,
        string memory _symbol,
        address _dividendToken
    ) external {
        __DividendPayingERC20_init(_name, _symbol, _dividendToken);
    }

    function mint(address account, uint256 value) external onlyOwner {
        _mint(account, value);
    }
}
