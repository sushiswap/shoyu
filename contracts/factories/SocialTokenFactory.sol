// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./ProxyFactory.sol";
import "../SocialToken.sol";

contract SocialTokenFactory is ProxyFactory {
    event CreateSocialToken(
        address indexed proxy,
        string name,
        string symbol,
        address indexed owner,
        address indexed dividendToken
    );

    address internal immutable target;

    constructor() {
        SocialToken token = new SocialToken();
        token.initialize("", "", address(0), address(0));
        target = address(token);
    }

    function createSocialToken(
        string memory name,
        string memory symbol,
        address dividendToken
    ) external returns (address proxy) {
        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(string,string,address,address)",
                name,
                symbol,
                msg.sender,
                dividendToken
            );
        proxy = _createProxy(target, initData);

        emit CreateSocialToken(proxy, name, symbol, msg.sender, dividendToken);
    }

    function isSocialToken(address query) external view returns (bool result) {
        return _isProxy(target, query);
    }
}
