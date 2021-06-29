// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./ProxyFactory.sol";
import "../NFTGovernanceToken.sol";

contract NFTGovernanceTokenFactory is ProxyFactory {
    using Orders for Orders.Ask;

    event CreateNFTGovernanceToken(
        address indexed proxy,
        address indexed nft,
        uint256 indexed tokenId,
        bytes32 orderHash,
        uint256 price,
        uint8 minimumQuorum
    );

    address internal immutable target;

    constructor() {
        NFTGovernanceToken token = new NFTGovernanceToken();
        token.initialize(
            Orders.Ask(address(0), address(0), 0, 0, address(0), address(0), 0, "", uint8(0), "", ""),
            0,
            uint8(0)
        );
        target = address(token);
    }

    function createNFTGovernanceToken(
        Orders.Ask calldata order,
        uint256 price,
        uint8 minimumQuorum
    ) external returns (address proxy) {
        bytes memory initData = abi.encodeWithSelector(0xc52b221f, order, price, minimumQuorum);
        proxy = _createProxy(target, initData);

        emit CreateNFTGovernanceToken(proxy, order.nft, order.tokenId, order.hash(), price, minimumQuorum);
    }

    function isNFTGovernanceToken(address query) external view returns (bool result) {
        return _isProxy(target, query);
    }
}
