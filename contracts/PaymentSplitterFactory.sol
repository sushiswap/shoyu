// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/IPaymentSplitterFactory.sol";
import "./base/ProxyFactory.sol";
import "./PaymentSplitter.sol";

contract PaymentSplitterFactory is ProxyFactory, IPaymentSplitterFactory {
    address internal _target;

    constructor() {
        PaymentSplitter target = new PaymentSplitter();
        address[] memory payees = new address[](1);
        payees[0] = msg.sender;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 1;
        target.initialize("", payees, shares);
        _target = address(target);
    }

    function deployPaymentSplitter(
        address owner,
        string calldata title,
        address[] calldata payees,
        uint256[] calldata shares
    ) external override returns (address splitter) {
        splitter = _createProxy(
            _target,
            abi.encodeWithSignature("initialize(string,address[],uint256[])", title, payees, shares)
        );

        emit DeployPaymentSplitter(owner, title, payees, shares, splitter);
    }

    function isPaymentSplitter(address query) external view override returns (bool result) {
        return _isProxy(_target, query);
    }
}
