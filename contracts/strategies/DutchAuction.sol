// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract DutchAuction is IStrategy {
    function canPurchase(bytes memory params, uint256 bidPrice) external view override returns (bool) {
        (uint256 startPrice, uint256 endPrice, uint256 startBlock, uint256 endBlock) =
            abi.decode(params, (uint256, uint256, uint256, uint256));
        require(startPrice > endPrice, "SHOYU: INVALID_PRICE_RANGE");
        require(startBlock < endBlock, "SHOYU: INVALID_BLOCK_RANGE");

        uint256 tickPerBlock = (startPrice - endPrice) / (endBlock - startBlock);
        uint256 currentPrice = startPrice - ((block.number - startBlock) * tickPerBlock);

        return block.number <= endBlock && bidPrice >= currentPrice;
    }

    function canBid(
        bytes memory,
        uint256,
        uint256
    ) external pure override returns (bool) {
        return false;
    }
}
