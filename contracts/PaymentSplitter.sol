// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./libraries/TokenHelper.sol";

// Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/finance/PaymentSplitter.sol
contract PaymentSplitter is Initializable {
    using TokenHelper for address;

    event PayeeAdded(address account, uint256 shares);
    event PaymentReleased(address token, address to, uint256 amount);

    string public title;

    /**
     * @dev Getter for the total shares held by payees.
     */
    uint256 public totalShares;
    /**
     * @dev Getter for the total amount of token already released.
     */
    mapping(address => uint256) public totalReleased;

    /**
     * @dev Getter for the amount of shares held by an account.
     */
    mapping(address => uint256) public shares;
    /**
     * @dev Getter for the amount of token already released to a payee.
     */
    mapping(address => mapping(address => uint256)) public released;
    /**
     * @dev Getter for the address of the payee number `index`.
     */
    address[] public payees;

    /**
     * @dev Creates an instance of `PaymentSplitter` where each account in `payees` is assigned the number of shares at
     * the matching position in the `shares` array.
     *
     * All addresses in `payees` must be non-zero. Both arrays must have the same non-zero length, and there must be no
     * duplicates in `payees`.
     */
    function initialize(
        string memory _title,
        address[] memory _payees,
        uint256[] memory _shares
    ) external initializer {
        require(_payees.length == _shares.length, "SHOYU: LENGTHS_NOT_EQUAL");
        require(_payees.length > 0, "SHOYU: NO_PAYEES");

        title = _title;

        for (uint256 i = 0; i < _payees.length; i++) {
            _addPayee(_payees[i], _shares[i]);
        }
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of token they are owed, according to their percentage of the
     * total shares and their previous withdrawals.
     */
    function release(address token, address account) public virtual {
        require(shares[account] > 0, "SHOYU: FORBIDDEN");

        uint256 totalReceived = token.balanceOf(address(this)) + totalReleased[token];
        uint256 payment = (totalReceived * shares[account]) / totalShares - released[token][account];

        require(payment != 0, "SHOYU: NO_PAYMENT");

        released[token][account] += payment;
        totalReleased[token] += payment;

        token.safeTransfer(account, payment);
        emit PaymentReleased(token, account, payment);
    }

    /**
     * @dev Add a new payee to the contract.
     * @param account The address of the payee to add.
     * @param _shares The number of shares owned by the payee.
     */
    function _addPayee(address account, uint256 _shares) private {
        require(account != address(0), "SHOYU: INVALID_ADDRESS");
        require(_shares > 0, "SHOYU: INVALID_SHARES");
        require(shares[account] == 0, "SHOYU: ALREADY_ADDED");

        payees.push(account);
        shares[account] = _shares;
        totalShares = totalShares + _shares;
        emit PayeeAdded(account, _shares);
    }
}
