// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IERC1271.sol";
import "../interfaces/IBaseNFTExchange.sol";
import "../interfaces/INFTFactory.sol";
import "../interfaces/IStrategy.sol";
import "../libraries/Orders.sol";

abstract contract BaseNFTExchange is IBaseNFTExchange, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Orders for Orders.Ask;
    using Orders for Orders.Bid;

    struct BestBid {
        address bidder;
        uint256 amount;
        uint256 price;
        address referrer;
    }

    mapping(bytes32 => BestBid) public override bestBid;
    mapping(bytes32 => bool) public override isCancelled;
    mapping(bytes32 => uint256) public override amountFilled;

    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32);

    function factory() public view virtual override returns (address);

    function royaltyFeeInfo() public view virtual override returns (address, uint8) {
        return (address(0), uint8(0));
    }

    function canTrade(address nft) public view virtual override returns (bool);

    function _transfer(
        address nft,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal virtual;

    function cancel(Orders.Ask memory order) external override {
        require(canTrade(order.nft), "SHOYU: INVALID_EXCHANGE");

        require(order.maker == msg.sender, "SHOYU: FORBIDDEN");

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

        _verify(bidOrder.hash(), bidOrder.maker, bidOrder.v, bidOrder.r, bidOrder.s);

        return _bid(askOrder, askHash, bidOrder.maker, bidOrder.amount, bidOrder.price, bidOrder.referrer);
    }

    function bid(
        Orders.Ask memory askOrder,
        uint256 bidAmount,
        uint256 bidPrice,
        address bidReferrer
    ) external override nonReentrant returns (bool executed) {
        return _bid(askOrder, askOrder.hash(), msg.sender, bidAmount, bidPrice, bidReferrer);
    }

    function _bid(
        Orders.Ask memory askOrder,
        bytes32 askHash,
        address bidder,
        uint256 bidAmount,
        uint256 bidPrice,
        address bidReferrer // TODO
    ) internal returns (bool executed) {
        require(canTrade(askOrder.nft), "SHOYU: INVALID_EXCHANGE");
        require(block.number <= askOrder.deadline, "SHOYU: EXPIRED");
        require(amountFilled[askHash] + bidAmount <= askOrder.amount, "SHOYU: SOLD_OUT");

        _validate(askOrder, askHash);
        _verify(askHash, askOrder.maker, askOrder.v, askOrder.r, askOrder.s);

        if (IStrategy(askOrder.strategy).canExecute(askOrder.params, bidPrice)) {
            amountFilled[askHash] += bidAmount;

            _transfer(askOrder.nft, askOrder.maker, bidder, askOrder.tokenId, bidAmount);
            _transferFeesAndFunds(askOrder.maker, askOrder.currency, bidder, bidPrice);

            emit Execute(askHash, bidder, bidAmount, bidPrice, bidReferrer);
            return true;
        } else {
            BestBid storage best = bestBid[askHash];
            if (IStrategy(askOrder.strategy).canBid(askOrder.params, bidPrice, best.price)) {
                best.bidder = bidder;
                best.amount = bidAmount;
                best.price = bidPrice;
                best.referrer = bidReferrer;

                emit Bid(askHash, bidder, bidAmount, bidPrice, bidReferrer);
                return false;
            }
        }
        revert("SHOYU: FAILURE");
    }

    function claim(Orders.Ask memory askOrder) external override {
        require(canTrade(askOrder.nft), "SHOYU: INVALID_EXCHANGE");
        require(askOrder.deadline < block.number, "SHOYU: NOT_CLAIMABLE");

        bytes32 askHash = askOrder.hash();
        _validate(askOrder, askHash);
        _verify(askHash, askOrder.maker, askOrder.v, askOrder.r, askOrder.s);

        BestBid storage best = bestBid[askHash];
        (address bidder, uint256 price) = (best.bidder, best.price);
        require(msg.sender == bidder, "SHOYU: FORBIDDEN");
        require(IStrategy(askOrder.strategy).canExecute(askOrder.params, price), "SHOYU: FAILURE");

        uint256 amount = best.amount;
        amountFilled[askHash] += amount;

        _transfer(askOrder.nft, askOrder.maker, bidder, askOrder.tokenId, amount);
        _transferFeesAndFunds(askOrder.maker, askOrder.currency, bidder, price);

        emit Claim(askHash, msg.sender);
    }

    function _validate(Orders.Ask memory askOrder, bytes32 askHash) internal view {
        require(!isCancelled[askHash], "SHOYU: CANCELLED");

        require(askOrder.maker != address(0), "SHOYU: INVALID_MAKER");
        require(askOrder.nft != address(0), "SHOYU: INVALID_NFT");
        require(askOrder.amount > 0, "SHOYU: INVALID_AMOUNT");
        require(askOrder.strategy != address(0), "SHOYU: INVALID_STRATEGY");
        require(askOrder.currency != address(0), "SHOYU: INVALID_CURRENCY");
        require(INFTFactory(factory()).isStrategyWhitelisted(askOrder.strategy), "SHOYU: STRATEGY_NOT_WHITELISTED");
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
        address maker,
        address currency,
        address bidder,
        uint256 bidPriceSum
    ) internal {
        address _factory = factory();
        uint256 remainder = bidPriceSum;
        {
            (address protocolFeeRecipient, uint8 protocolFeePermil) = INFTFactory(_factory).protocolFeeInfo();
            uint256 protocolFeeAmount = (bidPriceSum * protocolFeePermil) / 1000;
            IERC20(currency).safeTransferFrom(bidder, protocolFeeRecipient, protocolFeeAmount);
            remainder -= protocolFeeAmount;
        }

        {
            (address operationalFeeRecipient, uint8 operationalFeePermil) = INFTFactory(_factory).operationalFeeInfo();
            uint256 operationalFeeAmount = (bidPriceSum * operationalFeePermil) / 1000;
            IERC20(currency).safeTransferFrom(bidder, operationalFeeRecipient, operationalFeeAmount);
            remainder -= operationalFeeAmount;
        }

        (address royaltyFeeRecipient, uint8 royaltyFeePermil) = royaltyFeeInfo();
        uint256 royaltyFeeAmount = (remainder * royaltyFeePermil) / 1000;
        if (royaltyFeeAmount > 0) {
            remainder -= royaltyFeeAmount;
            IERC20(currency).safeTransferFrom(bidder, royaltyFeeRecipient, royaltyFeeAmount);
        }

        IERC20(currency).safeTransferFrom(bidder, maker, remainder);
    }
}
