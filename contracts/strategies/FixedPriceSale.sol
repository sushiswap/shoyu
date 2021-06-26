// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract FixedPriceSale is IStrategy {
    function validateParams(bytes calldata params) external pure override {
        (uint256 price, uint256 endBlock) = abi.decode(params, (uint256, uint256));
        require(price > 0, "SHOYU: INVALID_PRICE");
    }

    function validatePurchase(bytes memory params, uint256 bidPrice) external view override {
        (uint256 price, uint256 endBlock) = abi.decode(params, (uint256, uint256));
        require(endBlock == 0 || endBlock >= block.number, "SHOYU: EXPIRED");
        require(bidPrice == price, "SHOYU: BID_PRICE_TOO_LOW");
    }
}
