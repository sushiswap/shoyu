// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/// @dev A mintable ERC20 token that allows anyone to pay and distribute ether/erc20
///  to token holders as dividends and allows token holders to withdraw their dividends.
///  Reference: https://github.com/Roger-Wu/erc1726-dividend-paying-token/blob/master/contracts/DividendPayingToken.sol
abstract contract DividendPayingERC20 is ERC20Upgradeable {
    using SafeCast for uint256;
    using SafeCast for int256;
    using SafeERC20 for IERC20;

    /// @dev This event MUST emit when ether is distributed to token holders.
    /// @param from The address which sends ether to this contract.
    /// @param amount The amount of distributed ether in wei.
    event DividendsDistributed(address indexed from, uint256 amount);

    /// @dev This event MUST emit when an address withdraws their dividend.
    /// @param to The address which withdraws ether from this contract.
    /// @param amount The amount of withdrawn ether in wei.
    event DividendWithdrawn(address indexed to, uint256 amount);

    address public constant ETH = 0x0000000000000000000000000000000000000000;
    // For more discussion about choosing the value of `magnitude`,
    //  see https://github.com/ethereum/EIPs/issues/1726#issuecomment-472352728
    uint256 public constant MAGNITUDE = 2**128;

    address public dividendToken;

    uint256 internal magnifiedDividendPerShare;

    function __DividendPayingERC20_init(
        string memory _name,
        string memory _symbol,
        address _dividendToken
    ) internal initializer {
        __ERC20_init(_name, _symbol);
        dividendToken = _dividendToken;
    }

    // About dividendCorrection:
    // If the token balance of a `_user` is never changed, the dividend of `_user` can be computed with:
    //   `dividendOf(_user) = dividendPerShare * balanceOf(_user)`.
    // When `balanceOf(_user)` is changed (via minting/burning/transferring tokens),
    //   `dividendOf(_user)` should not be changed,
    //   but the computed value of `dividendPerShare * balanceOf(_user)` is changed.
    // To keep the `dividendOf(_user)` unchanged, we add a correction term:
    //   `dividendOf(_user) = dividendPerShare * balanceOf(_user) + dividendCorrectionOf(_user)`,
    //   where `dividendCorrectionOf(_user)` is updated whenever `balanceOf(_user)` is changed:
    //   `dividendCorrectionOf(_user) = dividendPerShare * (old balanceOf(_user)) - (new balanceOf(_user))`.
    // So now `dividendOf(_user)` returns the same value before and after `balanceOf(_user)` is changed.
    mapping(address => int256) internal magnifiedDividendCorrections;
    mapping(address => uint256) internal withdrawnDividends;

    /// @notice Distributes ether to token holders as dividends.
    /// @dev It reverts if the total supply of tokens is 0.
    /// It emits the `DividendsDistributed` event if the amount of received ether is greater than 0.
    /// About undistributed ether:
    ///   In each distribution, there is a small amount of ether not distributed,
    ///     the magnified amount of which is
    ///     `(msg.value * magnitude) % totalSupply()`.
    ///   With a well-chosen `magnitude`, the amount of undistributed ether
    ///     (de-magnified) in a distribution can be less than 1 wei.
    ///   We can actually keep track of the undistributed ether in a distribution
    ///     and try to distribute it in the next distribution,
    ///     but keeping track of such data on-chain costs much more than
    ///     the saved ether, so we don't do that.
    function distributeDividends(uint256 amount) public payable {
        uint256 _totalSupply = totalSupply();
        require(_totalSupply > 0, "SHOYU: NO_SUPPLY");
        require(amount > 0, "SHOYU: INVALID_AMOUNT");

        address _dividendToken = dividendToken;
        if (_dividendToken == ETH) {
            require(msg.value == amount, "SHOYU: INVALID_MSG_VALUE");
        } else {
            IERC20(_dividendToken).safeTransferFrom(msg.sender, address(this), amount);
        }
        magnifiedDividendPerShare += (amount * MAGNITUDE) / _totalSupply;
        emit DividendsDistributed(msg.sender, amount);
    }

    /// @notice Withdraws the ether distributed to the sender.
    /// @dev It emits a `DividendWithdrawn` event if the amount of withdrawn ether is greater than 0.
    function withdrawDividend() public {
        uint256 _withdrawableDividend = withdrawableDividendOf(msg.sender);
        if (_withdrawableDividend > 0) {
            withdrawnDividends[msg.sender] = withdrawnDividends[msg.sender] + _withdrawableDividend;
            emit DividendWithdrawn(msg.sender, _withdrawableDividend);
            address _dividendToken = dividendToken;
            if (_dividendToken == ETH) {
                payable(msg.sender).transfer(_withdrawableDividend);
            } else {
                IERC20(_dividendToken).safeTransfer(msg.sender, _withdrawableDividend);
            }
        }
    }

    /// @notice View the amount of dividend in wei that an address can withdraw.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` can withdraw.
    function dividendOf(address account) public view returns (uint256) {
        return withdrawableDividendOf(account);
    }

    /// @notice View the amount of dividend in wei that an address can withdraw.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` can withdraw.
    function withdrawableDividendOf(address account) public view returns (uint256) {
        return accumulativeDividendOf(account) - withdrawnDividends[account];
    }

    /// @notice View the amount of dividend in wei that an address has withdrawn.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` has withdrawn.
    function withdrawnDividendOf(address account) public view returns (uint256) {
        return withdrawnDividends[account];
    }

    /// @notice View the amount of dividend in wei that an address has earned in total.
    /// @dev accumulativeDividendOf(account) = withdrawableDividendOf(account) + withdrawnDividendOf(account)
    /// = (magnifiedDividendPerShare * balanceOf(account) + magnifiedDividendCorrections[account]) / magnitude
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` has earned in total.
    function accumulativeDividendOf(address account) public view returns (uint256) {
        return
            (magnifiedDividendPerShare *
                (balanceOf(account).toInt256() + magnifiedDividendCorrections[account]).toUint256()) / MAGNITUDE;
    }

    /// @dev Internal function that transfer tokens from one address to another.
    /// Update magnifiedDividendCorrections to keep dividends unchanged.
    /// @param from The address to transfer from.
    /// @param to The address to transfer to.
    /// @param value The amount to be transferred.
    function _transfer(
        address from,
        address to,
        uint256 value
    ) internal override {
        super._transfer(from, to, value);

        int256 _magCorrection = (magnifiedDividendPerShare * value).toInt256();
        magnifiedDividendCorrections[from] = magnifiedDividendCorrections[from] + _magCorrection;
        magnifiedDividendCorrections[to] = magnifiedDividendCorrections[to] - _magCorrection;
    }

    /// @dev Internal function that mints tokens to an account.
    /// Update magnifiedDividendCorrections to keep dividends unchanged.
    /// @param account The account that will receive the created tokens.
    /// @param value The amount that will be created.
    function _mint(address account, uint256 value) internal override {
        super._mint(account, value);

        magnifiedDividendCorrections[account] =
            magnifiedDividendCorrections[account] -
            (magnifiedDividendPerShare * value).toInt256();
    }

    /// @dev Internal function that burns an amount of the token of a given account.
    /// Update magnifiedDividendCorrections to keep dividends unchanged.
    /// @param account The account whose tokens will be burnt.
    /// @param value The amount that will be burnt.
    function _burn(address account, uint256 value) internal override {
        super._burn(account, value);

        magnifiedDividendCorrections[account] =
            magnifiedDividendCorrections[account] +
            (magnifiedDividendPerShare * value).toInt256();
    }
}
