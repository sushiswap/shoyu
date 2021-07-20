// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract EnglishAuction is IStrategy {
    function canExecute(
        uint256 deadline,
        bytes memory,
        address,
        uint256
    ) external view override returns (bool) {
        return deadline < block.number;
    }

    function canBid(
        uint256 deadline,
        bytes memory params,
        address,
        uint256 bidPrice,
        uint256 bestBidPrice,
        uint256
    ) external view override returns (bool) {
        uint256 startPrice = abi.decode(params, (uint256));
        require(startPrice > 0, "SHOYU: INVALID_START_PRICE");

        return block.number <= deadline && bidPrice >= startPrice && bidPrice > bestBidPrice;
    }
}
