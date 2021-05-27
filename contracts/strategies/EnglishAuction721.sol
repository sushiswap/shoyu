// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BaseStrategy721.sol";
import "../libraries/TransferHelper.sol";

contract EnglishAuction is BaseStrategy721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Cancel(address indexed lastBidder, uint256 lastBidPrice);
    event Bid(address indexed bidder, uint256 bidPrice);
    event Claim(address indexed taker, uint256 indexed price);

    address public lastBidder;
    uint256 public lastBidPrice;
    uint256 public startPrice;
    uint8 public priceGrowth; // out of 100

    function initialize(
        uint256 _tokenId,
        address _recipient,
        address _currency,
        uint256 _endBlock,
        uint256 _startPrice,
        uint8 _priceGrowth
    ) external initializer {
        __BaseStrategy_init(_tokenId, _recipient, _currency, _endBlock);

        startPrice = _startPrice;
        priceGrowth = _priceGrowth;
    }

    function currentPrice() public view override returns (uint256) {
        uint256 _lastBidPrice = lastBidPrice;
        return _lastBidPrice == 0 ? startPrice : _lastBidPrice;
    }

    function cancel() external override onlyOwner whenSaleOpen {
        _cancel();

        address _lastBidder = lastBidder;
        uint256 _lastBidPrice = lastBidPrice;

        lastBidder = address(0);
        lastBidPrice = 0;

        if (_lastBidPrice > 0) {
            TransferHelper.safeTransfer(currency, _lastBidder, _lastBidPrice);
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
        TransferHelper.safeTransferFromSender(_currency, price);
        if (_lastBidPrice > 0) {
            TransferHelper.safeTransfer(_currency, _lastBidder, _lastBidPrice);
        }

        lastBidder = msg.sender;
        lastBidPrice = price;

        emit Bid(msg.sender, price);
    }

    function claim() external nonReentrant whenSaleOpen {
        require(block.number > endBlock, "SHOYU: ONGOING_SALE");
        address _token = token;
        uint256 _tokenId = tokenId;
        address factory = INFT721(_token).factory();

        uint256 _lastBidPrice = lastBidPrice;
        address feeTo = INFTFactory(factory).feeTo();
        uint256 feeAmount = (_lastBidPrice * INFTFactory(factory).fee()) / 1000;

        status = Status.CANCELLED;
        INFT721(token).closeSale(_tokenId);

        address _currency = currency;
        TransferHelper.safeTransfer(_currency, feeTo, feeAmount);
        TransferHelper.safeTransfer(_currency, recipient, _lastBidPrice - feeAmount);

        address _owner = INFT721(_token).ownerOf(_tokenId);
        address _lastBidder = lastBidder;
        INFT721(_token).safeTransferFrom(_owner, _lastBidder, _tokenId);

        emit Claim(_lastBidder, _lastBidPrice);
    }
}
