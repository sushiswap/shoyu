// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BaseStrategy721.sol";

contract DutchAuction is BaseStrategy721, ReentrancyGuard {
    event Cancel();
    event Buy(address indexed buyer, uint256 price);

    uint256 public startBlock;
    uint256 public startPrice;
    uint256 public endPrice;

    function initialize(
        uint256 _tokenId,
        address _recipient,
        address _currency,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _startPrice,
        uint256 _endPrice
    ) external initializer {
        __BaseStrategy_init(_tokenId, _recipient, _currency, _endBlock);

        require(_startBlock >= block.number, "SHOYU: INVALID_START_BLOCK");
        require(_startBlock < _endBlock, "SHOYU: INVALID_END_BLOCK");
        require(_startPrice > _endPrice, "SHOYU: INVALID_END_PRICE");

        startBlock = _startBlock;
        startPrice = _startPrice;
        endPrice = _endPrice;
    }

    function currentPrice() public view override returns (uint256) {
        uint256 _startBlock = startBlock;
        uint256 _startPrice = startPrice;
        uint256 tickPerBlock = (_startPrice - endPrice) / (endBlock - _startBlock);
        return _startPrice - ((block.number - _startBlock) * tickPerBlock);
    }

    function buy(uint256 price) external payable nonReentrant whenSaleOpen {
        _buy(price);

        emit Buy(msg.sender, price);
    }

    function cancel() external override onlyOwner whenSaleOpen {
        _cancel();

        emit Cancel();
    }
}
