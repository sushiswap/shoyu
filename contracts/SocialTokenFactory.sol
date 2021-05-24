// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./ProxyFactory.sol";

contract SocialTokenFactory is ProxyFactory {
    address immutable target;

    constructor(address _target) {
        target = _target;
    }

    function createProxy(
        string memory _name,
        string memory _symbol,
        address _dividendToken
    ) public returns (address proxy) {
        bytes memory initData =
            abi.encodeWithSignature("initialize(string,string,address)", _name, _symbol, _dividendToken);
        return _createProxy(target, initData);
    }

    function isProxy(address query) public view returns (bool result) {
        return _isProxy(target, query);
    }
}
