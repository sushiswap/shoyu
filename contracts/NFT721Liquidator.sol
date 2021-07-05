// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./interfaces/INFT721Liquidator.sol";
import "./factories/ProxyFactory.sol";
import "./NFT721GovernanceToken.sol";

contract NFT721Liquidator is ProxyFactory, INFT721Liquidator {
    address public immutable orderBook;
    address internal immutable _target;

    constructor(address _orderBook) {
        orderBook = _orderBook;

        NFT721GovernanceToken token = new NFT721GovernanceToken();
        token.initialize(address(0), address(0), 0, 0);
        _target = address(token);
    }

    function liquidate(
        address nft,
        uint256 tokenId,
        uint8 minimumQuorum
    ) external override returns (address proxy) {
        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(address,address,uint256,uint8)",
                orderBook,
                nft,
                tokenId,
                minimumQuorum
            );
        proxy = _createProxy(_target, initData);

        IERC721(nft).safeTransferFrom(msg.sender, proxy, tokenId);

        emit Liquidate(proxy, nft, tokenId, minimumQuorum);
    }
}
