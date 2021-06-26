// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract DutchAuction is IStrategy {
    function validateParams(bytes calldata params) external pure override {
        (uint256 startPrice, uint256 endPrice, uint256 startBlock, uint256 endBlock) =
            abi.decode(params, (uint256, uint256, uint256, uint256));
        require(startPrice > endPrice, "SHOYU: PRICE_MUST_DECREASE");
        require(startBlock < endBlock, "SHOYU: BLOCK_MUST_INCREASE");
    }

    function validatePurchase(bytes memory params, uint256 bidPrice) external view override {
        (uint256 startPrice, uint256 endPrice, uint256 startBlock, uint256 endBlock) =
            abi.decode(params, (uint256, uint256, uint256, uint256));
        uint256 tickPerBlock = (startPrice - endPrice) / (endBlock - startBlock);
        uint256 currentPrice = startPrice - ((block.number - startBlock) * tickPerBlock);
        require(endBlock >= block.number, "SHOYU: EXPIRED");
        require(bidPrice >= currentPrice, "SHOYU: BID_PRICE_TOO_LOW");
    }
}
