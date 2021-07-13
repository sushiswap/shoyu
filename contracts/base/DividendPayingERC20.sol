// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "./ERC20Initializable.sol";
import "../libraries/TokenHelper.sol";
import "../interfaces/IDividendPayingERC20.sol";

/// @dev A mintable ERC20 token that allows anyone to pay and distribute ether/erc20
///  to token holders as dividends and allows token holders to withdraw their dividends.
///  Reference: https://github.com/Roger-Wu/erc1726-dividend-paying-token/blob/master/contracts/DividendPayingToken.sol
abstract contract DividendPayingERC20 is ERC20Initializable, IDividendPayingERC20 {
    using SafeCast for uint256;
    using SafeCast for int256;
    using TokenHelper for address;

    // For more discussion about choosing the value of `magnitude`,
    //  see https://github.com/ethereum/EIPs/issues/1726#issuecomment-472352728
    uint256 public constant override MAGNITUDE = 2**128;

    address public override dividendToken;
    uint256 public override totalDividend;

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

    /// @dev Syncs dividends whenever ether is paid to this contract.
    receive() external payable {
        if (msg.value > 0) {
            require(dividendToken == TokenHelper.ETH, "SHOYU: UNABLE_TO_RECEIVE_ETH");
            sync();
        }
    }

    /// @notice Syncs the amount of ether/erc20 increased to token holders as dividends.
    /// @dev It reverts if the total supply of tokens is 0.
    /// @return increased The amount of total dividend increased
    /// It emits the `Sync` event if the amount of received ether/erc20 is greater than 0.
    /// About undistributed ether/erc20:
    ///   In each distribution, there is a small amount of ether/erc20 not distributed,
    ///     the magnified amount of which is
    ///     `(msg.value * magnitude) % totalSupply()`.
    ///   With a well-chosen `magnitude`, the amount of undistributed ether/erc20
    ///     (de-magnified) in a distribution can be less than 1 wei.
    ///   We can actually keep track of the undistributed ether/erc20 in a distribution
    ///     and try to distribute it in the next distribution,
    ///     but keeping track of such data on-chain costs much more than
    ///     the saved ether/erc20, so we don't do that.
    function sync() public payable override returns (uint256 increased) {
        uint256 _totalSupply = totalSupply();
        require(_totalSupply > 0, "SHOYU: NO_SUPPLY");

        uint256 balance = dividendToken.balanceOf(address(this));
        increased = balance - totalDividend;
        require(increased > 0, "SHOYU: INSUFFICIENT_AMOUNT");

        magnifiedDividendPerShare += (increased * MAGNITUDE) / _totalSupply;
        totalDividend = balance;

        emit Sync(increased);
    }

    /// @notice Withdraws the ether/erc20 distributed to the sender.
    /// @dev It emits a `DividendWithdrawn` event if the amount of withdrawn ether/erc20 is greater than 0.
    function withdrawDividend() public override {
        uint256 _withdrawableDividend = withdrawableDividendOf(msg.sender);
        if (_withdrawableDividend > 0) {
            withdrawnDividends[msg.sender] += _withdrawableDividend;
            emit DividendWithdrawn(msg.sender, _withdrawableDividend);
            totalDividend -= _withdrawableDividend;
            dividendToken.safeTransfer(msg.sender, _withdrawableDividend);
        }
    }

    /// @notice View the amount of dividend in wei that an address can withdraw.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` can withdraw.
    function dividendOf(address account) public view override returns (uint256) {
        return withdrawableDividendOf(account);
    }

    /// @notice View the amount of dividend in wei that an address can withdraw.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` can withdraw.
    function withdrawableDividendOf(address account) public view override returns (uint256) {
        return accumulativeDividendOf(account) - withdrawnDividends[account];
    }

    /// @notice View the amount of dividend in wei that an address has withdrawn.
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` has withdrawn.
    function withdrawnDividendOf(address account) public view override returns (uint256) {
        return withdrawnDividends[account];
    }

    /// @notice View the amount of dividend in wei that an address has earned in total.
    /// @dev accumulativeDividendOf(account) = withdrawableDividendOf(account) + withdrawnDividendOf(account)
    /// = (magnifiedDividendPerShare * balanceOf(account) + magnifiedDividendCorrections[account]) / magnitude
    /// @param account The address of a token holder.
    /// @return The amount of dividend in wei that `account` has earned in total.
    function accumulativeDividendOf(address account) public view override returns (uint256) {
        return
            ((magnifiedDividendPerShare * balanceOf(account)).toInt256() + magnifiedDividendCorrections[account])
                .toUint256() / MAGNITUDE;
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
        magnifiedDividendCorrections[from] += _magCorrection;
        magnifiedDividendCorrections[to] -= _magCorrection;
    }

    /// @dev Internal function that mints tokens to an account.
    /// Update magnifiedDividendCorrections to keep dividends unchanged.
    /// @param account The account that will receive the created tokens.
    /// @param value The amount that will be created.
    function _mint(address account, uint256 value) internal override {
        super._mint(account, value);

        magnifiedDividendCorrections[account] -= (magnifiedDividendPerShare * value).toInt256();
    }

    /// @dev Internal function that burns an amount of the token of a given account.
    /// Update magnifiedDividendCorrections to keep dividends unchanged.
    /// @param account The account whose tokens will be burnt.
    /// @param value The amount that will be burnt.
    function _burn(address account, uint256 value) internal override {
        super._burn(account, value);

        magnifiedDividendCorrections[account] += (magnifiedDividendPerShare * value).toInt256();
    }
}
