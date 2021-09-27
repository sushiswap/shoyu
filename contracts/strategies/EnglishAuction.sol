// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract EnglishAuction is IStrategy {
    function canClaim(
        uint256 deadline,
        bytes memory,
        address bidder,
        uint256 bidPrice,
        address bestBidder,
        uint256 bestBidPrice,
        uint256
    ) external view override returns (bool) {
        return bidder == bestBidder && bidPrice == bestBidPrice && deadline < block.timestamp;
    }

    function canBid(
        uint256 deadline,
        bytes memory params,
        address,
        uint256 bidPrice,
        address,
        uint256 bestBidPrice,
        uint256
    ) external view override returns (bool) {
        uint256 startPrice = abi.decode(params, (uint256));
        require(startPrice > 0, "SHOYU: INVALID_START_PRICE");

        return block.timestamp <= deadline && bidPrice >= startPrice && bidPrice > bestBidPrice;
    }
}
