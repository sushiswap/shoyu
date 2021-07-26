// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/IStrategy.sol";

contract DesignatedSale is IStrategy {
    function canExecute(
        uint256,
        bytes memory params,
        address bidder,
        uint256 bidPrice
    ) external pure override returns (bool) {
        (uint256 minPrice, address designee) = abi.decode(params, (uint256, address));
        require(designee != address(0), "SHOYU: INVALID_DESIGNEE");

        return minPrice <= bidPrice && bidder == designee;
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
