// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./DividendPayingERC20.sol";

contract SocialToken is DividendPayingERC20, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    function initialize(
        string memory _name,
        string memory _symbol,
        address _owner,
        address _dividendToken
    ) external initializer {
        __DividendPayingERC20_init(_name, _symbol, _dividendToken);
        __Ownable_init();
        transferOwnership(_owner);
    }

    function mint(address account, uint256 value) external onlyOwner {
        _mint(account, value);
    }
}
