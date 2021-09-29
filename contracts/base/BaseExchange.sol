// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IBaseExchange.sol";
import "../interfaces/ITokenFactory.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IDividendPayingERC20.sol";
import "./ReentrancyGuardInitializable.sol";
import "../libraries/Signature.sol";
import "../interfaces/IERC2981.sol";

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
        uint256 timestamp;
    }

    mapping(address => mapping(bytes32 => mapping(address => bytes32))) internal _bidHashes;

    mapping(bytes32 => BestBid) public override bestBid;
    mapping(bytes32 => bool) public override isCancelledOrClaimed;
    mapping(bytes32 => uint256) public override amountFilled;

    function __BaseNFTExchange_init() internal initializer {
        __ReentrancyGuard_init();
    }

    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32);

    function factory() public view virtual override returns (address);

    function canTrade(address token) public view virtual override returns (bool) {
        return token == address(this);
    }

    function approvedBidHash(
        address proxy,
        bytes32 askHash,
        address bidder
    ) external view override returns (bytes32 bidHash) {
        return _bidHashes[proxy][askHash][bidder];
    }

    function _transfer(
        address token,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal virtual;

    function cancel(Orders.Ask memory order) external override {
        require(order.signer == msg.sender || order.proxy == msg.sender, "SHOYU: FORBIDDEN");

        bytes32 hash = order.hash();
        require(bestBid[hash].bidder == address(0), "SHOYU: BID_EXISTS");

        isCancelledOrClaimed[hash] = true;

        emit Cancel(hash);
    }

    function updateApprovedBidHash(
        bytes32 askHash,
        address bidder,
        bytes32 bidHash
    ) external override {
        _bidHashes[msg.sender][askHash][bidder] = bidHash;
        emit UpdateApprovedBidHash(msg.sender, askHash, bidder, bidHash);
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

        bytes32 bidHash = bidOrder.hash();
        if (askOrder.proxy != address(0)) {
            require(
                askOrder.proxy == msg.sender || _bidHashes[askOrder.proxy][askHash][bidOrder.signer] == bidHash,
                "SHOYU: FORBIDDEN"
            );
            delete _bidHashes[askOrder.proxy][askHash][bidOrder.signer];
            emit UpdateApprovedBidHash(askOrder.proxy, askHash, bidOrder.signer, bytes32(0));
        }

        Signature.verify(bidHash, bidOrder.signer, bidOrder.v, bidOrder.r, bidOrder.s, DOMAIN_SEPARATOR());

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
        require(askOrder.proxy == address(0), "SHOYU: FORBIDDEN");

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
        uint256 _amountFilled = amountFilled[askHash];
        require(_amountFilled + bidAmount <= askOrder.amount, "SHOYU: SOLD_OUT");

        _validate(askOrder, askHash);
        Signature.verify(askHash, askOrder.signer, askOrder.v, askOrder.r, askOrder.s, DOMAIN_SEPARATOR());

        BestBid storage best = bestBid[askHash];
        if (
            IStrategy(askOrder.strategy).canClaim(
                askOrder.proxy,
                askOrder.deadline,
                askOrder.params,
                bidder,
                bidPrice,
                best.bidder,
                best.price,
                best.timestamp
            )
        ) {
            amountFilled[askHash] = _amountFilled + bidAmount;
            if (_amountFilled + bidAmount == askOrder.amount) isCancelledOrClaimed[askHash] = true;

            address recipient = askOrder.recipient;
            if (recipient == address(0)) recipient = askOrder.signer;
            require(
                _transferFeesAndFunds(
                    askOrder.token,
                    askOrder.tokenId,
                    askOrder.currency,
                    bidder,
                    recipient,
                    bidPrice * bidAmount
                ),
                "SHOYU: FAILED_TO_TRANSFER_FUNDS"
            );

            if (bidRecipient == address(0)) bidRecipient = bidder;
            _transfer(askOrder.token, askOrder.signer, bidRecipient, askOrder.tokenId, bidAmount);

            emit Claim(askHash, bidder, bidAmount, bidPrice, bidRecipient, bidReferrer);
            return true;
        } else {
            if (
                IStrategy(askOrder.strategy).canBid(
                    askOrder.proxy,
                    askOrder.deadline,
                    askOrder.params,
                    bidder,
                    bidPrice,
                    best.bidder,
                    best.price,
                    best.timestamp
                )
            ) {
                best.bidder = bidder;
                best.amount = bidAmount;
                best.price = bidPrice;
                best.recipient = bidRecipient;
                best.referrer = bidReferrer;
                best.timestamp = block.timestamp;

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
        Signature.verify(askHash, askOrder.signer, askOrder.v, askOrder.r, askOrder.s, DOMAIN_SEPARATOR());

        BestBid memory best = bestBid[askHash];
        require(
            IStrategy(askOrder.strategy).canClaim(
                askOrder.proxy,
                askOrder.deadline,
                askOrder.params,
                best.bidder,
                best.price,
                best.bidder,
                best.price,
                best.timestamp
            ),
            "SHOYU: FAILURE"
        );

        address recipient = askOrder.recipient;
        if (recipient == address(0)) recipient = askOrder.signer;

        isCancelledOrClaimed[askHash] = true;
        require(
            _transferFeesAndFunds(
                askOrder.token,
                askOrder.tokenId,
                askOrder.currency,
                best.bidder,
                recipient,
                best.price * best.amount
            ),
            "SHOYU: FAILED_TO_TRANSFER_FUNDS"
        );
        amountFilled[askHash] = amountFilled[askHash] + best.amount;

        address bidRecipient = best.recipient;
        if (bidRecipient == address(0)) bidRecipient = best.bidder;
        _transfer(askOrder.token, askOrder.signer, bidRecipient, askOrder.tokenId, best.amount);

        delete bestBid[askHash];

        emit Claim(askHash, best.bidder, best.amount, best.price, bidRecipient, best.referrer);
    }

    function _validate(Orders.Ask memory askOrder, bytes32 askHash) internal view {
        require(!isCancelledOrClaimed[askHash], "SHOYU: CANCELLED_OR_CLAIMED");

        require(askOrder.signer != address(0), "SHOYU: INVALID_MAKER");
        require(askOrder.token != address(0), "SHOYU: INVALID_NFT");
        require(askOrder.amount > 0, "SHOYU: INVALID_AMOUNT");
        require(askOrder.strategy != address(0), "SHOYU: INVALID_STRATEGY");
        require(askOrder.currency != address(0), "SHOYU: INVALID_CURRENCY");
        require(ITokenFactory(factory()).isStrategyWhitelisted(askOrder.strategy), "SHOYU: STRATEGY_NOT_WHITELISTED");
    }

    function _transferFeesAndFunds(
        address token,
        uint256 tokenId,
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

        try IERC2981(token).royaltyInfo(tokenId, amount) returns (
            address royaltyFeeRecipient,
            uint256 royaltyFeeAmount
        ) {
            if (royaltyFeeAmount > 0) {
                remainder -= royaltyFeeAmount;
                _transferRoyaltyFee(currency, royaltyFeeRecipient, royaltyFeeAmount);
            }
        } catch {}

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
