// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseNFTExchange.sol";

interface INFTExchange is IBaseNFTExchange {
    event SubmitOrder(bytes32 indexed hash);

    function submitOrder(
        address nft,
        uint256 tokenId,
        uint256 amount,
        address strategy,
        address currency,
        uint256 deadline,
        bytes memory params
    ) external;
}
