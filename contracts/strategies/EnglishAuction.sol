// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BaseStrategy.sol";
import "../libraries/TokenHelper.sol";

contract EnglishAuction is BaseStrategy, ReentrancyGuard {
    using TokenHelper for address;

    event Cancel(address indexed lastBidder, uint256 lastBidPrice);
    event Bid(address indexed bidder, uint256 bidPrice);
    event Claim(address indexed taker, uint256 indexed price);

    address public lastBidder;
    uint256 public lastBidPrice;
    uint256 public startPrice;
    uint8 public priceGrowth; // out of 100

    function initialize(
        address _owner,
        uint256 _tokenId,
        uint256 _amount,
        bytes calldata _config
    ) external override initializer {
        __BaseStrategy_init(_owner, _tokenId, _amount);
        (address _recipient, address _currency, uint256 _endBlock, uint256 _startPrice, uint8 _priceGrowth) =
            abi.decode(_config, (address, address, uint256, uint256, uint8));
        require(_recipient != address(0), "SHOYU: INVALID_RECIPIENT");
        require(_endBlock > block.number, "SHOYU: INVALID_END_BLOCK");

        recipient = _recipient;
        currency = _currency;
        endBlock = _endBlock;
        startPrice = _startPrice;
        priceGrowth = _priceGrowth;
    }

    function currentPrice() public view override returns (uint256) {
        uint256 _lastBidPrice = lastBidPrice;
        return _lastBidPrice == 0 ? startPrice : _lastBidPrice;
    }

    function cancel() external override whenSaleOpen {
        _cancel();

        address _lastBidder = lastBidder;
        uint256 _lastBidPrice = lastBidPrice;

        lastBidder = address(0);
        lastBidPrice = 0;

        if (_lastBidPrice > 0) {
            currency.safeTransfer(_lastBidder, _lastBidPrice);
        }

        emit Cancel(_lastBidder, _lastBidPrice);
    }

    function bid(uint256 price) external payable nonReentrant whenSaleOpen {
        uint256 _endBlock = endBlock;
        require(block.number <= _endBlock, "SHOYU: EXPIRED");

        (uint256 _priceGrowth, address _lastBidder) = (priceGrowth, lastBidder); // gas optimization
        uint256 _lastBidPrice = lastBidPrice;
        if (_lastBidPrice != 0) {
            require(msg.value >= _lastBidPrice + ((_lastBidPrice * _priceGrowth) / 100), "SHOYU: PRICE_NOT_INCREASED");
        } else {
            require(msg.value >= startPrice && msg.value > 0, "low price bid");
        }

        if (block.number > _endBlock - 20) {
            endBlock = endBlock + 20; // 5 mins
        }

        address _currency = currency;
        _currency.safeTransferFromSender(price);
        if (_lastBidPrice > 0) {
            _currency.safeTransfer(_lastBidder, _lastBidPrice);
        }

        lastBidder = msg.sender;
        lastBidPrice = price;

        emit Bid(msg.sender, price);
    }

    function claim() external nonReentrant whenSaleOpen {
        require(block.number > endBlock, "SHOYU: ONGOING_SALE");
        (address _token, uint256 _tokenId, uint256 _amount) = (token, tokenId, amount);
        address factory = INFT(_token).factory();

        uint256 _lastBidPrice = lastBidPrice;
        address feeTo = INFTFactory(factory).feeTo();
        uint256 feeAmount = (_lastBidPrice * INFTFactory(factory).fee()) / 1000;

        status = Status.FINISHED;
        INFT(token).closeSale(_tokenId, _amount);

        address _currency = currency;
        _currency.safeTransfer(feeTo, feeAmount);
        _currency.safeTransfer(recipient, _lastBidPrice - feeAmount);

        address _lastBidder = lastBidder;
        INFT(_token).safeTransferFrom(owner, _lastBidder, _tokenId, _amount);

        emit Claim(_lastBidder, _lastBidPrice);
    }
}
