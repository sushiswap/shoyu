// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library TokenHelper {
    using SafeERC20 for IERC20;

    address public constant ETH = 0x0000000000000000000000000000000000000000;

    function balanceOf(address token, address account) internal view returns (uint256) {
        if (token == ETH) {
            return account.balance;
        } else {
            return IERC20(token).balanceOf(account);
        }
    }

    function safeTransfer(
        address token,
        address to,
        uint256 amount
    ) internal {
        if (token == ETH) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "SHOYU: TRANSFER_FAILURE");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
