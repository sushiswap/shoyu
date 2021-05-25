// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/INFT.sol";
import "../interfaces/INFTFactory.sol";
import "../interfaces/IStrategy.sol";

abstract contract BaseStrategy is Initializable, IStrategy {
    using SafeERC20 for IERC20;

    address public constant override ETH = 0x0000000000000000000000000000000000000000;

    Status public override status;
    address public override token;
    uint256 public override tokenId;
    address public override recipient;
    address public override currency;

    modifier onlyOwner {
        require(msg.sender == owner(), "SHOYU: FORBIDDEN");
        _;
    }

    modifier whenSaleOpen {
        require(INFT(token).openSaleOf(tokenId) == address(this) && status == Status.OPEN, "SHOYU: SALE_NOT_OPEN");
        _;
    }

    function __BaseStrategy_init(
        uint256 _tokenId,
        address _recipient,
        address _currency
    ) internal initializer {
        require(_recipient != address(0), "SHOYU: INVALID_RECIPIENT");

        token = msg.sender;
        tokenId = _tokenId;
        recipient = _recipient;
        currency = _currency;
    }

    function owner() public view override returns (address) {
        return INFT(token).ownerOf(tokenId);
    }
}
