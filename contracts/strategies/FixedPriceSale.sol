// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract FixedPriceSale is IStrategy {
    function canExecute(bytes memory params, uint256 bidPrice) external pure override returns (bool) {
        uint256 price = abi.decode(params, (uint256));
        require(price > 0, "SHOYU: INVALID_PRICE");
        return bidPrice == price;
    }

    function canBid(
        bytes memory,
        uint256,
        uint256
    ) external pure override returns (bool) {
        return false;
    }
}
