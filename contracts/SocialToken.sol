// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DividendPayingERC20.sol";

contract SocialToken is DividendPayingERC20, Ownable {
    using SafeERC20 for IERC20;

    constructor(
        string memory _name,
        string memory _symbol,
        address _dividendToken
    ) DividendPayingERC20(_name, _symbol, _dividendToken) {}

    function mint(address account, uint256 value) external onlyOwner {
        _mint(account, value);
    }
}
