// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/INFT721.sol";
import "../interfaces/INFTFactory.sol";
import "../interfaces/IStrategy.sol";
import "../libraries/TokenHelper.sol";

abstract contract BaseStrategy721 is Initializable, IStrategy {
    using SafeERC20 for IERC20;
    using TokenHelper for address;

    Status public override status;
    address public override token;
    uint256 public override tokenId;
    address public override recipient;
    address public override currency;
    uint256 public override endBlock;

    modifier onlyOwner {
        require(msg.sender == owner(), "SHOYU: FORBIDDEN");
        _;
    }

    modifier whenSaleOpen {
        require(INFT721(token).openSaleOf(tokenId) == address(this) && status == Status.OPEN, "SHOYU: SALE_NOT_OPEN");
        _;
    }

    function __BaseStrategy_init(
        uint256 _tokenId,
        address _recipient,
        address _currency,
        uint256 _endBlock
    ) internal initializer {
        require(_recipient != address(0), "SHOYU: INVALID_RECIPIENT");
        require(_endBlock > block.number, "SHOYU: INVALID_END_BLOCK");

        token = msg.sender;
        tokenId = _tokenId;
        recipient = _recipient;
        currency = _currency;
        endBlock = _endBlock;
    }

    function owner() public view override returns (address) {
        return INFT721(token).ownerOf(tokenId);
    }

    function currentPrice() public view virtual override returns (uint256);

    function _cancel() internal {
        status = Status.CANCELLED;
        INFT721(token).closeSale(tokenId);
    }

    function _buy(uint256 price) internal {
        uint256 _currentPrice = currentPrice();
        require(price >= _currentPrice, "SHOYU: INVALID_PRICE");
        require(block.number <= endBlock, "SHOYU: EXPIRED");

        (address _token, uint256 _tokenId) = (token, tokenId);

        status = Status.FINISHED;
        INFT721(_token).closeSale(_tokenId);

        address _owner = INFT721(_token).ownerOf(_tokenId);
        INFT721(_token).safeTransferFrom(_owner, msg.sender, _tokenId);

        address _currency = currency;
        address factory = INFT721(token).factory();
        address feeTo = INFTFactory(factory).feeTo();
        uint256 feeAmount = (_currentPrice * INFTFactory(factory).fee()) / 1000;
        _currency.safeTransferFromSender(feeTo, feeAmount);
        _currency.safeTransferFromSender(recipient, _currentPrice - feeAmount);
    }
}
