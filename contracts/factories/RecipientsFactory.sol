// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./ProxyFactory.sol";
import "../Recipients.sol";

contract RecipientsFactory is ProxyFactory {
    event CreateRecipients(address[] members, uint8[] weights);

    address internal immutable target;

    constructor() {
        Recipients recipients = new Recipients();
        recipients.initialize(new address[](0), new uint8[](0));
        target = address(recipients);
    }

    function createRecipients(address[] memory members, uint8[] memory weights) external returns (address proxy) {
        bytes memory initData = abi.encodeWithSignature("initialize(address[],address[])", members, weights);
        proxy = _createProxy(target, initData);

        emit CreateRecipients(members, weights);
    }

    function isRecipients(address query) external view returns (bool result) {
        return _isProxy(target, query);
    }
}
