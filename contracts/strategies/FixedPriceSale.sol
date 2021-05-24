// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/INFT.sol";
import "../interfaces/INFTFactory.sol";

contract FixedPriceSale is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Cancel();
    event Buy(address indexed buyer);

    address public constant ETH = 0x0000000000000000000000000000000000000000;

    address public token;
    uint256 public tokenId;
    address public recipient;
    address public currency;
    uint256 public price;
    uint256 public endBlock;

    modifier whenSaleOpen() {
        require(INFT(token).openSaleOf(tokenId) == address(this), "SHOYU: SALE_NOT_OPEN");
        _;
    }

    function initialize(
        uint256 _tokenId,
        address _recipient,
        address _currency,
        uint256 _price,
        uint256 _endBlock
    ) external initializer {
        require(_recipient != address(0), "SHOYU: INVALID_RECIPIENT");
        require(_endBlock > block.number, "SHOYU: INVALID_END_BLOCK");

        token = msg.sender;
        tokenId = _tokenId;
        recipient = _recipient;
        currency = _currency;
        price = _price;
        endBlock = _endBlock;
    }

    function owner() public view returns (address) {
        return INFT(token).ownerOf(tokenId);
    }

    function cancel() external whenSaleOpen {
        require(msg.sender == token, "SHOYU: FORBIDDEN");

        emit Cancel();
    }

    function buy() external payable nonReentrant whenSaleOpen {
        require(block.number <= endBlock, "SHOYU: EXPIRED");

        uint256 _price = price;
        address factory = INFT(token).factory();
        address feeTo = INFTFactory(factory).feeTo();
        uint256 feeAmount = (_price * INFTFactory(factory).fee()) / 1000;

        //  TODO: mark sold
        _safeTransferFromSender(feeTo, feeAmount);
        _safeTransferFromSender(recipient, _price - feeAmount);

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
