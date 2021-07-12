// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IERC1271.sol";
import "../interfaces/IBaseExchange.sol";
import "../interfaces/ITokenFactory.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IDividendPayingERC20.sol";
import "../libraries/Orders.sol";
import "./ReentrancyGuardInitializable.sol";

abstract contract BaseExchange is ReentrancyGuardInitializable, IBaseExchange {
    using SafeERC20 for IERC20;
    using Orders for Orders.Ask;
    using Orders for Orders.Bid;

    struct BestBid {
        address bidder;
        uint256 amount;
        uint256 price;
        address recipient;
        address referrer;
    }

    mapping(bytes32 => BestBid) public override bestBid;
    mapping(bytes32 => bool) public override isCancelled;
    mapping(bytes32 => uint256) public override amountFilled;

    function __BaseNFTExchange_init() internal {
        __ReentrancyGuard_init();
    }

    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32);

    function factory() public view virtual override returns (address);

    function royaltyFeeInfo() public view virtual override returns (address, uint8) {
        return (address(0), uint8(0));
    }

    function canTrade(address token) public view virtual override returns (bool) {
        return token == address(this);
    }

    function _transfer(
        address token,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal virtual;

    function cancel(Orders.Ask memory order) external override {
        require(order.signer == msg.sender, "SHOYU: FORBIDDEN");

        bytes32 hash = order.hash();
        isCancelled[hash] = true;

        emit Cancel(hash);
    }

    function bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder)
        external
        override
        nonReentrant
        returns (bool executed)
    {
        bytes32 askHash = askOrder.hash();
        require(askHash == bidOrder.askHash, "SHOYU: UNMATCHED_HASH");

        _verify(bidOrder.hash(), bidOrder.signer, bidOrder.v, bidOrder.r, bidOrder.s);

        return
            _bid(
                askOrder,
                askHash,
                bidOrder.signer,
                bidOrder.amount,
                bidOrder.price,
                bidOrder.recipient,
                bidOrder.referrer
            );
    }

    function bid(
        Orders.Ask memory askOrder,
        uint256 bidAmount,
        uint256 bidPrice,
        address bidRecipient,
        address bidReferrer
    ) external override nonReentrant returns (bool executed) {
        return _bid(askOrder, askOrder.hash(), msg.sender, bidAmount, bidPrice, bidRecipient, bidReferrer);
    }

    function _bid(
        Orders.Ask memory askOrder,
        bytes32 askHash,
        address bidder,
        uint256 bidAmount,
        uint256 bidPrice,
        address bidRecipient,
        address bidReferrer
    ) internal returns (bool executed) {
        require(canTrade(askOrder.token), "SHOYU: INVALID_EXCHANGE");
        require(block.number <= askOrder.deadline, "SHOYU: EXPIRED");
        require(amountFilled[askHash] + bidAmount <= askOrder.amount, "SHOYU: SOLD_OUT");

        _validate(askOrder, askHash);
        _verify(askHash, askOrder.signer, askOrder.v, askOrder.r, askOrder.s);

        if (IStrategy(askOrder.strategy).canExecute(askOrder.params, bidPrice)) {
            amountFilled[askHash] += bidAmount;

            if (bidRecipient == address(0)) bidRecipient = bidder;
            _transfer(askOrder.token, askOrder.signer, bidRecipient, askOrder.tokenId, bidAmount);

            address recipient = askOrder.recipient;
            if (recipient == address(0)) recipient = askOrder.signer;
            _transferFeesAndFunds(askOrder.currency, bidder, recipient, bidPrice * bidAmount);

            emit Execute(askHash, bidder, bidAmount, bidPrice, bidRecipient, bidReferrer);
            return true;
        } else {
            BestBid storage best = bestBid[askHash];
            if (IStrategy(askOrder.strategy).canBid(askOrder.params, bidPrice, best.price)) {
                best.bidder = bidder;
                best.amount = bidAmount;
                best.price = bidPrice;
                best.recipient = bidRecipient;
                best.referrer = bidReferrer;

                emit Bid(askHash, bidder, bidAmount, bidPrice, bidRecipient, bidReferrer);
                return false;
            }
        }
        revert("SHOYU: FAILURE");
    }

    function claim(Orders.Ask memory askOrder) external override nonReentrant {
        require(canTrade(askOrder.token), "SHOYU: INVALID_EXCHANGE");
        require(askOrder.deadline < block.number, "SHOYU: NOT_CLAIMABLE");

        bytes32 askHash = askOrder.hash();
        _validate(askOrder, askHash);
        _verify(askHash, askOrder.signer, askOrder.v, askOrder.r, askOrder.s);

        BestBid memory best = bestBid[askHash];
        require(msg.sender == best.bidder, "SHOYU: FORBIDDEN");
        require((amountFilled[askHash] += best.amount) <= askOrder.amount, "SHOYU: SOLD_OUT");
        require(IStrategy(askOrder.strategy).canExecute(askOrder.params, best.price), "SHOYU: FAILURE");

        address bidRecipient = best.recipient;
        if (bidRecipient == address(0)) bidRecipient = best.bidder;
        _transfer(askOrder.token, askOrder.signer, bidRecipient, askOrder.tokenId, best.amount);

        address recipient = askOrder.recipient;
        if (recipient == address(0)) recipient = askOrder.signer;
        _transferFeesAndFunds(askOrder.currency, best.bidder, recipient, best.price * best.amount);

        emit Execute(askHash, best.bidder, best.amount, best.price, bidRecipient, best.referrer);
    }

    function _validate(Orders.Ask memory askOrder, bytes32 askHash) internal view {
        require(!isCancelled[askHash], "SHOYU: CANCELLED");

        require(askOrder.signer != address(0), "SHOYU: INVALID_MAKER");
        require(askOrder.token != address(0), "SHOYU: INVALID_NFT");
        require(askOrder.amount > 0, "SHOYU: INVALID_AMOUNT");
        require(askOrder.strategy != address(0), "SHOYU: INVALID_STRATEGY");
        require(askOrder.currency != address(0), "SHOYU: INVALID_CURRENCY");
        require(ITokenFactory(factory()).isStrategyWhitelisted(askOrder.strategy), "SHOYU: STRATEGY_NOT_WHITELISTED");
    }

    function _verify(
        bytes32 hash,
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), hash));
        if (Address.isContract(signer)) {
            require(
                IERC1271(signer).isValidSignature(digest, abi.encodePacked(r, s, v)) == 0x1626ba7e,
                "SHOYU: UNAUTHORIZED"
            );
        } else {
            require(ecrecover(digest, v, r, s) == signer, "SHOYU: UNAUTHORIZED");
        }
    }

    function _transferFeesAndFunds(
        address currency,
        address from,
        address to,
        uint256 amount
    ) internal {
        address _factory = factory();
        uint256 remainder = amount;
        {
            (address protocolFeeRecipient, uint8 protocolFeePermil) = ITokenFactory(_factory).protocolFeeInfo();
            uint256 protocolFeeAmount = (amount * protocolFeePermil) / 1000;
            IERC20(currency).safeTransferFrom(from, protocolFeeRecipient, protocolFeeAmount);
            remainder -= protocolFeeAmount;
        }

        {
            (address operationalFeeRecipient, uint8 operationalFeePermil) =
                ITokenFactory(_factory).operationalFeeInfo();
            uint256 operationalFeeAmount = (amount * operationalFeePermil) / 1000;
            IERC20(currency).safeTransferFrom(from, operationalFeeRecipient, operationalFeeAmount);
            remainder -= operationalFeeAmount;
        }

        (address royaltyFeeRecipient, uint8 royaltyFeePermil) = royaltyFeeInfo();
        uint256 royaltyFeeAmount = (remainder * royaltyFeePermil) / 1000;
        if (royaltyFeeAmount > 0) {
            remainder -= royaltyFeeAmount;
            _transferRoyaltyFee(currency, from, royaltyFeeRecipient, royaltyFeeAmount);
        }

        IERC20(currency).safeTransferFrom(from, to, remainder);
    }

    function _transferRoyaltyFee(
        address currency,
        address from,
        address to,
        uint256 amount
    ) internal {
        IERC20(currency).safeTransferFrom(from, to, amount);
        if (Address.isContract(to)) {
            try IDividendPayingERC20(to).sync() returns (uint256) {} catch {}
        }
    }
}
