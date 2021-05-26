// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library TransferHelper {
    using SafeERC20 for IERC20;

    address public constant ETH = 0x0000000000000000000000000000000000000000;

    function safeTransfer(
        address currency,
        address to,
        uint256 amount
    ) internal {
        if (currency == ETH) {
            payable(to).transfer(amount);
        } else {
            IERC20(currency).safeTransfer(to, amount);
        }
    }

    function safeTransferFromSender(address currency, uint256 amount) internal {
        if (currency == ETH) {
            require(msg.value == amount, "SHOYU: INVALID_MSG_VALUE");
        } else {
            IERC20(currency).safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    function safeTransferFromSender(
        address currency,
        address to,
        uint256 amount
    ) internal {
        if (currency == ETH) {
            require(msg.value == amount, "SHOYU: INVALID_MSG_VALUE");
            payable(to).transfer(amount);
        } else {
            IERC20(currency).safeTransferFrom(msg.sender, to, amount);
        }
    }
}
