// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/INFT.sol";
import "../interfaces/INFTFactory.sol";

contract EnglishAuction is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Cancel(address indexed lastBidder, uint256 lastBidPrice);
    event Bid(address indexed bidder, uint256 bidPrice);
    event Claim(address indexed taker, uint256 indexed price);

    address public constant ETH = 0x0000000000000000000000000000000000000000;

    address public token;
    uint256 public tokenId;
    address public recipient;
    address public currency;
    uint256 public startPrice;
    uint256 public endBlock;
    uint8 public priceGrowth; // out of 100
    address public lastBidder;
    uint256 public lastBidPrice;

    modifier whenSaleOpen() {
        require(INFT(token).openSaleOf(tokenId) == address(this), "SHOYU: SALE_NOT_OPEN");
        _;
    }

    function initialize(
        uint256 _tokenId,
        address _recipient,
        address _currency,
        uint256 _startPrice,
        uint256 _endBlock,
        uint8 _priceGrowth
    ) external initializer {
        require(_recipient != address(0), "SHOYU: INVALID_RECIPIENT");
        require(_endBlock > block.number, "SHOYU: INVALID_END_BLOCK");

        token = msg.sender;
        tokenId = _tokenId;
        recipient = _recipient;
        currency = _currency;
        startPrice = _startPrice;
        endBlock = _endBlock;
        priceGrowth = _priceGrowth;
    }

    function owner() public view returns (address) {
        return INFT(token).ownerOf(tokenId);
    }

    function cancel() external whenSaleOpen {
        require(msg.sender == token, "SHOYU: FORBIDDEN");

        address _lastBidder = lastBidder;
        uint256 _lastBidPrice = lastBidPrice;

        lastBidder = address(0);
        lastBidPrice = 0;

        if (_lastBidPrice > 0) {
            _safeTransfer(_lastBidder, _lastBidPrice);
        }

        emit Cancel(_lastBidder, _lastBidPrice);
    }

    function bid(uint256 price) external payable nonReentrant whenSaleOpen {
        uint256 _endBlock = endBlock;
        require(block.number <= _endBlock, "SHOYU: EXPIRED");

        uint256 _lastBidPrice = lastBidPrice;
        if (_lastBidPrice != 0) {
            require(msg.value >= _lastBidPrice + ((_lastBidPrice * priceGrowth) / 100), "SHOYU: PRICE_NOT_INCREASED");
        } else {
            require(msg.value >= startPrice && msg.value > 0, "low price bid");
        }

        if (block.number > _endBlock - 20) {
            endBlock = endBlock + 20; // 5 mins
        }

        _safeTransferFrom(price);
        if (_lastBidPrice > 0) {
            _safeTransfer(lastBidder, _lastBidPrice);
        }

        lastBidder = msg.sender;
        lastBidPrice = price;

        emit Bid(msg.sender, price);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        address _currency = currency;
        if (_currency == ETH) {
            payable(to).transfer(amount);
        } else {
            IERC20(_currency).safeTransfer(to, amount);
        }
    }

    function _safeTransferFrom(uint256 amount) internal {
        address _currency = currency;
        if (_currency == ETH) {
            require(msg.value == amount, "SHOYU: INVALID_MSG_VALUE");
        } else {
            IERC20(_currency).safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    function claim() external nonReentrant whenSaleOpen {
        require(block.number > endBlock, "SHOYU: ON_SALE");
        address _token = token;
        uint256 _tokenId = tokenId;
        address factory = INFT(_token).factory();

        uint256 _lastBidPrice = lastBidPrice;
        address feeTo = INFTFactory(factory).feeTo();
        uint256 feeAmount = (_lastBidPrice * INFTFactory(factory).fee()) / 1000;

        //  TODO: mark sold
        _safeTransfer(feeTo, feeAmount);
        _safeTransfer(recipient, _lastBidPrice - feeAmount);

        address _owner = INFT(_token).ownerOf(_tokenId);
        address _lastBidder = lastBidder;
        INFT(_token).safeTransferFrom(_owner, _lastBidder, _tokenId);

        emit Claim(_lastBidder, _lastBidPrice);
    }
}
