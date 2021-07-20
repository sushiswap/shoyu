// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract FixedPriceSale is IStrategy {
    function canExecute(
        uint256 deadline,
        bytes memory params,
        address,
        uint256 bidPrice
    ) external view override returns (bool) {
        uint256 price = abi.decode(params, (uint256));
        require(price > 0, "SHOYU: INVALID_PRICE");
        return block.number <= deadline && bidPrice == price;
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
