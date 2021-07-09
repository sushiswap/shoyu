// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./interfaces/IERC721Liquidator.sol";
import "./base/ProxyFactory.sol";
import "./ERC721GovernanceToken.sol";

contract ERC721Liquidator is ProxyFactory, IERC721Liquidator {
    address public immutable factory;
    address internal immutable _target;

    constructor(address _factory) {
        factory = _factory;

        ERC721GovernanceToken token = new ERC721GovernanceToken();
        token.initialize(address(0), address(0), 0, 0);
        _target = address(token);
    }

    function liquidate(
        address nft,
        uint256 tokenId,
        uint8 minimumQuorum
    ) external override returns (address proxy) {
        bytes memory initData =
            abi.encodeWithSignature("initialize(address,address,uint256,uint8)", factory, nft, tokenId, minimumQuorum);
        proxy = _createProxy(_target, initData);

        IERC721(nft).safeTransferFrom(msg.sender, proxy, tokenId);

        emit Liquidate(proxy, nft, tokenId, minimumQuorum);
    }
}
