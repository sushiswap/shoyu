// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";

contract FixedPriceSale is BaseStrategy, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Cancel();
    event Buy(address indexed buyer);

    uint256 public price;
    uint256 public endBlock;

    function initialize(
        uint256 _tokenId,
        address _recipient,
        address _currency,
        uint256 _price,
        uint256 _endBlock
    ) external initializer {
        __BaseStrategy_init(_tokenId, _recipient, _currency);

        require(_endBlock > block.number, "SHOYU: INVALID_END_BLOCK");

        price = _price;
        endBlock = _endBlock;
    }

    function currentPrice() external view override returns (uint256) {
        return price;
    }

    function cancel() external override onlyOwner whenSaleOpen {
        status = Status.CANCELLED;
        INFT(token).closeSale(tokenId);

        emit Cancel();
    }

    function buy() external payable nonReentrant whenSaleOpen {
        require(block.number <= endBlock, "SHOYU: EXPIRED");

        address _token = token;
        uint256 _tokenId = tokenId;
        uint256 _price = price;
        address factory = INFT(token).factory();
        address feeTo = INFTFactory(factory).feeTo();
        uint256 feeAmount = (_price * INFTFactory(factory).fee()) / 1000;

        status = Status.FINISHED;
        INFT(_token).closeSale(_tokenId);

        _safeTransferFromSender(feeTo, feeAmount);
        _safeTransferFromSender(recipient, _price - feeAmount);

        address _owner = INFT(_token).ownerOf(_tokenId);
        INFT(_token).safeTransferFrom(_owner, msg.sender, _tokenId);

        emit Buy(msg.sender);
    }

    function _safeTransferFromSender(address to, uint256 amount) internal {
        address _currency = currency;
        if (_currency == ETH) {
            require(msg.value == amount, "SHOYU: INVALID_MSG_VALUE");
            payable(to).transfer(amount);
        } else {
            IERC20(_currency).safeTransferFrom(msg.sender, to, amount);
        }
    }
}
