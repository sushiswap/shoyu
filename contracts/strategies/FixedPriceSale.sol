// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract FixedPriceSale is IStrategy {
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
        uint256 price = abi.decode(params, (uint256));
        require(price > 0, "SHOYU: INVALID_PRICE");
        return (proxy != address(0) || block.timestamp <= deadline) && bidPrice == price;
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
