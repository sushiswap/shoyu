// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IDividendPayingERC20 is IERC20, IERC20Metadata {
    /// @dev This event MUST emit when erc20/ether dividend is synced.
    /// @param increased The amount of increased erc20/ether in wei.
    event Sync(uint256 increased);

    /// @dev This event MUST emit when an address withdraws their dividend.
    /// @param to The address which withdraws erc20/ether from this contract.
    /// @param amount The amount of withdrawn erc20/ether in wei.
    event DividendWithdrawn(address indexed to, uint256 amount);

    function MAGNITUDE() external view returns (uint256);

    function dividendToken() external view returns (address);

    function totalDividend() external view returns (uint256);

    function sync() external payable returns (uint256 increased);

    function withdrawDividend() external;

    /// @notice View the amount of dividend in wei that an address can withdraw.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` can withdraw.
    function dividendOf(address account) external view returns (uint256);

    /// @notice View the amount of dividend in wei that an address can withdraw.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` can withdraw.
    function withdrawableDividendOf(address account) external view returns (uint256);

    /// @notice View the amount of dividend in wei that an address has withdrawn.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` has withdrawn.
    function withdrawnDividendOf(address account) external view returns (uint256);

    /// @notice View the amount of dividend in wei that an address has earned in total.
    /// @dev accumulativeDividendOf(account) = withdrawableDividendOf(account) + withdrawnDividendOf(account)
    /// = (magnifiedDividendPerShare * balanceOf(account) + magnifiedDividendCorrections[account]) / magnitude
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` has earned in total.
    function accumulativeDividendOf(address account) external view returns (uint256);
}
