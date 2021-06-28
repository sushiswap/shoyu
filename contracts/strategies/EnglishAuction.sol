// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract EnglishAuction is IStrategy {
    uint8 public constant MAX_PRICE_GROWTH = 250; // out of 1000

    function canExecute(bytes memory, uint256) external pure override returns (bool) {
        return false;
    }

    function canBid(
        bytes memory params,
        uint256 bidPrice,
        uint256 bestPrice
    ) external pure override returns (bool) {
        (uint256 startPrice, uint8 priceGrowth) = abi.decode(params, (uint256, uint8));
        require(startPrice > 0, "SHOYU: INVALID_START_PRICE");
        require(priceGrowth > 0, "SHOYU: INVALID_PRICE_GROWTH");
        require(bidPrice > startPrice, "SHOYU: BID_PRICE_TOO_LOW");

        return bidPrice > ((bestPrice * (1000 + priceGrowth)) / 1000);
    }
}
