// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract DutchAuction is IStrategy {
    function canExecute(
        uint256 deadline,
        bytes memory params,
        address,
        uint256 bidPrice
    ) external view override returns (bool) {
        (uint256 startPrice, uint256 endPrice, uint256 startBlock) = abi.decode(params, (uint256, uint256, uint256));
        require(startPrice > endPrice, "SHOYU: INVALID_PRICE_RANGE");
        require(startBlock < deadline, "SHOYU: INVALID_START_BLOCK");

        uint256 tickPerBlock = (startPrice - endPrice) / (deadline - startBlock);
        uint256 currentPrice = startPrice - ((block.number - startBlock) * tickPerBlock);

        return block.number <= deadline && bidPrice >= currentPrice;
    }

    function canBid(
        uint256,
        bytes memory,
        address,
        uint256,
        uint256,
        uint256
    ) external pure override returns (bool) {
        return false;
    }
}
