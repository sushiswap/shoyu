// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract DutchAuction is IStrategy {
    function canClaim(
        address proxy,
        uint256 deadline,
        bytes memory params,
        address,
        uint256 bidPrice,
        address,
        uint256,
        uint256
    ) external view override returns (bool) {
        (uint256 startPrice, uint256 endPrice, uint256 startedAt) = abi.decode(params, (uint256, uint256, uint256));
        require(startPrice > endPrice, "SHOYU: INVALID_PRICE_RANGE");
        require(startedAt < deadline, "SHOYU: INVALID_STARTED_AT");

        uint256 tickPerBlock = (startPrice - endPrice) / (deadline - startedAt);
        uint256 currentPrice =
            block.timestamp >= deadline ? endPrice : startPrice - ((block.timestamp - startedAt) * tickPerBlock);

        return (proxy != address(0) || block.timestamp <= deadline) && bidPrice >= currentPrice;
    }

    function canBid(
        address,
        uint256,
        bytes memory,
        address,
        uint256,
        address,
        uint256,
        uint256
    ) external pure override returns (bool) {
        return false;
    }
}
