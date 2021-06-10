// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BaseStrategy.sol";

contract FixedPriceSale is BaseStrategy, ReentrancyGuard {
    event Cancel();
    event Buy(address indexed buyer);

    uint256 public price;

    function initialize(
        address _owner,
        uint256 _tokenId,
        uint256 _amount,
        bytes calldata _config
    ) external override initializer {
        __BaseStrategy_init(_owner, _tokenId, _amount);
        (address _recipient, address _currency, uint256 _endBlock, uint256 _price) =
            abi.decode(_config, (address, address, uint256, uint256));
        require(_recipient != address(0), "SHOYU: INVALID_RECIPIENT");
        require(_endBlock > block.number, "SHOYU: INVALID_END_BLOCK");

        recipient = _recipient;
        currency = _currency;
        endBlock = _endBlock;
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
