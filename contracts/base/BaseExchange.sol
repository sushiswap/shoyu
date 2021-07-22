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
        uint256 blockNumber;
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
        require(bestBid[hash].bidder == address(0), "SHOYU: BID_EXISTS");

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
        require(bidOrder.signer != address(0), "SHOYU: INVALID_SIGNER");

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
        require(bidAmount > 0, "SHOYU: INVALID_AMOUNT");
        require(amountFilled[askHash] + bidAmount <= askOrder.amount, "SHOYU: SOLD_OUT");

        _validate(askOrder, askHash);
        _verify(askHash, askOrder.signer, askOrder.v, askOrder.r, askOrder.s);

        if (IStrategy(askOrder.strategy).canExecute(askOrder.deadline, askOrder.params, bidder, bidPrice)) {
            amountFilled[askHash] += bidAmount;

            address recipient = askOrder.recipient;
            if (recipient == address(0)) recipient = askOrder.signer;
            require(
                _transferFeesAndFunds(askOrder.currency, bidder, recipient, bidPrice * bidAmount),
                "SHOYU: FAILED_TO_TRANSFER_FUNDS"
            );

            if (bidRecipient == address(0)) bidRecipient = bidder;
            _transfer(askOrder.token, askOrder.signer, bidRecipient, askOrder.tokenId, bidAmount);

            emit Execute(askHash, bidder, bidAmount, bidPrice, bidRecipient, bidReferrer);
            return true;
        } else {
            BestBid storage best = bestBid[askHash];
            if (
                IStrategy(askOrder.strategy).canBid(
                    askOrder.deadline,
                    askOrder.params,
                    bidder,
                    bidPrice,
                    best.price,
                    best.blockNumber
                )
            ) {
                best.bidder = bidder;
                best.amount = bidAmount;
                best.price = bidPrice;
                best.recipient = bidRecipient;
                best.referrer = bidReferrer;
                best.blockNumber = block.number;

                emit Bid(askHash, bidder, bidAmount, bidPrice, bidRecipient, bidReferrer);
                return false;
            }
        }
        revert("SHOYU: FAILURE");
    }

    function claim(Orders.Ask memory askOrder) external override nonReentrant {
        require(canTrade(askOrder.token), "SHOYU: INVALID_EXCHANGE");

        bytes32 askHash = askOrder.hash();
        _validate(askOrder, askHash);
        _verify(askHash, askOrder.signer, askOrder.v, askOrder.r, askOrder.s);

        BestBid memory best = bestBid[askHash];
        require(
            IStrategy(askOrder.strategy).canExecute(askOrder.deadline, askOrder.params, best.bidder, best.price),
            "SHOYU: FAILURE"
        );

        address recipient = askOrder.recipient;
        if (recipient == address(0)) recipient = askOrder.signer;
        if (_transferFeesAndFunds(askOrder.currency, best.bidder, recipient, best.price * best.amount)) {
            amountFilled[askHash] += best.amount;

            address bidRecipient = best.recipient;
            if (bidRecipient == address(0)) bidRecipient = best.bidder;
            _transfer(askOrder.token, askOrder.signer, bidRecipient, askOrder.tokenId, best.amount);

            delete bestBid[askHash];

            emit Execute(askHash, best.bidder, best.amount, best.price, bidRecipient, best.referrer);
        } else {
            isCancelled[askHash] = true;

            emit Cancel(askHash);
        }
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
    ) internal returns (bool) {
        if (!_safeTransferFrom(currency, from, address(this), amount)) {
            return false;
        }

        address _factory = factory();
        uint256 remainder = amount;
        {
            (address protocolFeeRecipient, uint8 protocolFeePermil) = ITokenFactory(_factory).protocolFeeInfo();
            uint256 protocolFeeAmount = (amount * protocolFeePermil) / 1000;
            IERC20(currency).safeTransfer(protocolFeeRecipient, protocolFeeAmount);
            remainder -= protocolFeeAmount;
        }

        {
            (address operationalFeeRecipient, uint8 operationalFeePermil) =
                ITokenFactory(_factory).operationalFeeInfo();
            uint256 operationalFeeAmount = (amount * operationalFeePermil) / 1000;
            IERC20(currency).safeTransfer(operationalFeeRecipient, operationalFeeAmount);
            remainder -= operationalFeeAmount;
        }

        (address royaltyFeeRecipient, uint8 royaltyFeePermil) = royaltyFeeInfo();
        if (royaltyFeePermil != type(uint8).max) {
            uint256 royaltyFeeAmount = (remainder * royaltyFeePermil) / 1000;
            if (royaltyFeeAmount > 0) {
                remainder -= royaltyFeeAmount;
                _transferRoyaltyFee(currency, royaltyFeeRecipient, royaltyFeeAmount);
            }
        }

        IERC20(currency).safeTransfer(to, remainder);
        return true;
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) private returns (bool) {
        (bool success, bytes memory returndata) =
            token.call(abi.encodeWithSelector(IERC20(token).transferFrom.selector, from, to, value));
        return success && (returndata.length == 0 || abi.decode(returndata, (bool)));
    }

    function _transferRoyaltyFee(
        address currency,
        address to,
        uint256 amount
    ) internal {
        IERC20(currency).safeTransfer(to, amount);
        if (Address.isContract(to)) {
            try IDividendPayingERC20(to).sync() returns (uint256) {} catch {}
        }
    }
}
