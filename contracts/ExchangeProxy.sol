// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IExchangeProxy.sol";
import "./interfaces/IBaseExchange.sol";
import "./libraries/Signature.sol";

contract ExchangeProxy is Ownable, IExchangeProxy {
    using Orders for Orders.Ask;
    using Orders for Orders.Bid;

    mapping(address => bool) public override isClaimerWhitelisted;

    constructor() {
        isClaimerWhitelisted[msg.sender] = true;
    }

    modifier onlyClaimer {
        require(isClaimerWhitelisted[msg.sender], "SHOYU: FORBIDDEN");
        _;
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setClaimerWhitelisted(address claimer, bool whitelisted) external override onlyOwner {
        require(claimer != address(0), "SHOYU: INVALID_ADDRESS");

        isClaimerWhitelisted[claimer] = whitelisted;
    }

    function claim(
        address exchange,
        Orders.Ask memory askOrder,
        Orders.Bid memory bidOrder
    ) external override onlyClaimer {
        bytes32 askHash = askOrder.hash();
        require(askHash == bidOrder.askHash, "SHOYU: UNMATCHED_HASH");
        require(bidOrder.signer != address(0), "SHOYU: INVALID_SIGNER");
        require(bidOrder.recipient != address(0), "SHOYU: INVALID_RECIPIENT");
        Signature.verify(
            bidOrder.hash(),
            bidOrder.signer,
            bidOrder.v,
            bidOrder.r,
            bidOrder.s,
            IBaseExchange(exchange).DOMAIN_SEPARATOR()
        );

        IERC20(askOrder.currency).transferFrom(bidOrder.signer, address(this), bidOrder.amount * bidOrder.price);
        IERC20(askOrder.currency).approve(exchange, bidOrder.amount * bidOrder.price);
        IBaseExchange(exchange).bid(askOrder, bidOrder.amount, bidOrder.price, bidOrder.recipient, bidOrder.referrer);

        emit Claim(
            exchange,
            askOrder.hash(),
            bidOrder.signer,
            bidOrder.amount,
            bidOrder.price,
            bidOrder.recipient,
            bidOrder.referrer
        );
    }
}
