// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/INFTExchange.sol";
import "../interfaces/IStrategy.sol";
import "../NFT721.sol";
import "../NFT1155.sol";

abstract contract NFTExchange is Ownable, ReentrancyGuard, INFTExchange {
    using SafeERC20 for IERC20;
    using Orders for Orders.Ask;
    using Orders for Orders.Bid;

    bytes32 public immutable override DOMAIN_SEPARATOR;
    uint8 public constant override MAX_PROTOCOL_FEE = 100;
    uint8 public constant override MAX_ROYALTY_FEE = 250;

    address public override protocolFeeRecipient;
    uint8 public override protocolFee; // out of 1000
    mapping(address => address) public override royaltyFeeRecipientOf;
    mapping(address => uint8) public override royaltyFeeOf; // out of 1000

    mapping(address => bool) public override isStrategyWhitelisted;

    mapping(bytes32 => bool) public override isCancelledOrExecuted;
    mapping(bytes32 => address) public override bestBidder;
    mapping(bytes32 => uint256) public override bestBidPrice;

    constructor(address _protocolFeeRecipient, uint8 _protocolFee) {
        setProtocolFeeRecipient(_protocolFeeRecipient);
        setProtocolFee(_protocolFee);

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                bytes("NFTExchange"),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    function setProtocolFeeRecipient(address _protocolFeeRecipient) public override onlyOwner {
        require(_protocolFeeRecipient != address(0), "SHOYU: INVALID_FEE_TO");

        protocolFeeRecipient = _protocolFeeRecipient;
    }

    function setProtocolFee(uint8 _protocolFee) public override onlyOwner {
        require(protocolFee <= MAX_PROTOCOL_FEE, "SHOYU: INVALID_FEE");

        protocolFee = _protocolFee;
    }

    function setStrategyWhitelisted(address ask, bool whitelisted) external override onlyOwner {
        require(ask != address(0), "SHOYU: INVALID_SALE");

        isStrategyWhitelisted[ask] = whitelisted;
    }

    function setRoyaltyFeeRecipient(address nft, address royaltyFeeRecipient) external override {
        require(royaltyFeeRecipientOf[nft] == msg.sender, "SHOYU: FORBIDDEN");

        royaltyFeeRecipientOf[nft] = royaltyFeeRecipient;
    }

    function setRoyaltyFee(address nft, uint8 royaltyFee) external override {
        require(royaltyFeeRecipientOf[nft] == msg.sender, "SHOYU: FORBIDDEN");

        _setRoyaltyFee(nft, royaltyFee);
    }

    function _setRoyaltyFee(address nft, uint8 royaltyFee) internal {
        require(royaltyFee <= MAX_ROYALTY_FEE, "SHOYU: INVALID_FEE");

        royaltyFeeOf[nft] = royaltyFee;
    }

    function cancel(Orders.Ask memory ask) external override {
        require(ask.maker == msg.sender, "SHOYU: FORBIDDEN");

        bytes32 hash = ask.hash();
        isCancelledOrExecuted[hash] = true;

        emit Cancel(hash);
    }

    function bid721(Orders.Ask memory ask, Orders.Bid memory bid) external override nonReentrant {
        bytes32 askHash = ask.hash();
        require(askHash == bid.askHash, "SHOYU: UNMATCHED_HASH");

        _verify(bid.hash(), bid.maker, bid.v, bid.r, bid.s);

        _bid721(ask, askHash, bid.maker, bid.price);
    }

    function bid721(Orders.Ask memory ask, uint256 bidPrice) external override nonReentrant {
        _bid721(ask, ask.hash(), msg.sender, bidPrice);
    }

    function bid1155(Orders.Ask memory ask, Orders.Bid memory bid) external override nonReentrant {
        bytes32 askHash = ask.hash();
        require(askHash == bid.askHash, "SHOYU: UNMATCHED_HASH");

        _verify(bid.hash(), bid.maker, bid.v, bid.r, bid.s);

        _bid1155(ask, askHash, bid.maker, bid.amount, bid.price);
    }

    function bid1155(
        Orders.Ask memory ask,
        uint256 bidAmount,
        uint256 bidPrice
    ) external override nonReentrant {
        _bid1155(ask, ask.hash(), msg.sender, bidAmount, bidPrice);
    }

    function _bid721(
        Orders.Ask memory ask,
        bytes32 askHash,
        address bidder,
        uint256 bidPrice
    ) internal {
        _validate(ask, askHash);

        bool expired = ask.deadline < block.number;
        bool canClaim = bidder == bestBidder[askHash];
        if ((expired && canClaim) || (!expired && IStrategy(ask.strategy).canExecute(ask.params, bidPrice))) {
            isCancelledOrExecuted[askHash] = true;

            IERC721(ask.nft).safeTransferFrom(ask.maker, bidder, ask.tokenId);
            _transferFeesAndFunds(ask.maker, ask.nft, ask.currency, bidder, bidPrice);

            emit Execute(askHash, bidder, 1, bidPrice);
        } else if (!expired && IStrategy(ask.strategy).canBid(ask.params, bidPrice, bestBidPrice[askHash])) {
            bestBidder[askHash] = bidder;
            bestBidPrice[askHash] = bidPrice;

            emit Bid(askHash, bidder, 1, bidPrice);
        }
    }

    function _bid1155(
        Orders.Ask memory ask,
        bytes32 askHash,
        address bidder,
        uint256 amount,
        uint256 bidPrice
    ) internal {
        _validate(ask, askHash);

        bool expired = ask.deadline < block.number;
        bool canClaim = bidder == bestBidder[askHash];
        if ((expired && canClaim) || (!expired && IStrategy(ask.strategy).canExecute(ask.params, bidPrice))) {
            isCancelledOrExecuted[askHash] = true;

            IERC1155(ask.nft).safeTransferFrom(ask.maker, bidder, ask.tokenId, amount, "");
            _transferFeesAndFunds(ask.maker, ask.nft, ask.currency, bidder, bidPrice);

            emit Execute(askHash, bidder, 1, bidPrice);
        } else if (!expired && IStrategy(ask.strategy).canBid(ask.params, bidPrice, bestBidPrice[askHash])) {
            bestBidder[askHash] = bidder;
            bestBidPrice[askHash] = bidPrice;

            emit Bid(askHash, bidder, 1, bidPrice);
        }
    }

    function _validate(Orders.Ask memory ask, bytes32 askHash) internal view {
        require(!isCancelledOrExecuted[askHash], "SHOYU: CANCELLED_OR_EXECUTED");

        require(ask.maker != address(0), "SHOYU: INVALID_MAKER");
        require(ask.nft != address(0), "SHOYU: INVALID_NFT");
        require(ask.amount > 0, "SHOYU: INVALID_AMOUNT");
        require(ask.strategy != address(0), "SHOYU: INVALID_STRATEGY");
        require(ask.currency != address(0), "SHOYU: INVALID_CURRENCY");

        _verify(askHash, ask.maker, ask.v, ask.r, ask.s);
    }

    function _verify(
        bytes32 hash,
        address maker,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hash));
        if (Address.isContract(maker)) {
            require(
                IERC1271(maker).isValidSignature(digest, abi.encodePacked(r, s, v)) == 0x1626ba7e,
                "SHOYU: UNAUTHORIZED"
            );
        } else {
            require(ecrecover(digest, v, r, s) == maker, "SHOYU: UNAUTHORIZED");
        }
    }

    function _transferFeesAndFunds(
        address maker,
        address nft,
        address currency,
        address bidder,
        uint256 bidPriceSum
    ) internal {
        uint256 protocolFeeAmount = (bidPriceSum * protocolFee) / 1000;
        IERC20(currency).safeTransferFrom(bidder, protocolFeeRecipient, protocolFeeAmount);

        uint256 remainder = bidPriceSum - protocolFeeAmount;
        uint256 royaltyFeeAmount = (remainder * royaltyFeeOf[nft]) / 1000;
        if (royaltyFeeAmount > 0) {
            remainder -= royaltyFeeAmount;
            IERC20(currency).safeTransferFrom(bidder, royaltyFeeRecipientOf[nft], royaltyFeeAmount);
        }

        IERC20(currency).safeTransferFrom(bidder, maker, remainder);
    }
}
