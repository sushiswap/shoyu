// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BaseStrategy.sol";

contract FixedPriceSale is BaseStrategy, ReentrancyGuard {
    event Cancel();
    event Buy(address indexed buyer);

    uint256 public price;

    function initialize(
        uint256 _tokenId,
        uint256 _amount,
        address _recipient,
        address _currency,
        uint256 _endBlock,
        uint256 _price
    ) external initializer {
        __BaseStrategy_init(_tokenId, _amount, _recipient, _currency, _endBlock);

        price = _price;
    }

    function currentPrice() public view override returns (uint256) {
        return price;
    }

    function cancel() external override whenSaleOpen {
        _cancel();

        emit Cancel();
    }

    function buy() external payable nonReentrant whenSaleOpen {
        _buy(price);

        emit Buy(msg.sender);
    }
}
