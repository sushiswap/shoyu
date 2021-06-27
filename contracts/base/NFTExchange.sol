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

    bytes32 public immutable override DOMAIN_SEPARATOR;
    // keccak256("Order(address maker,address taker,address nft,address strategy,uint256 tokenId,uint256 amount,address currency,address recipient,bytes params)")
    bytes32 public constant override ORDER_TYPEHASH =
        0x920c8fe8f90bae4eb906a3bcfaf17c9ed94da7a76ed40a8262f1db2713ec8ea0;
    uint8 public constant override MAX_PROTOCOL_FEE = 100;
    uint8 public constant override MAX_ROYALTY_FEE = 250;

    address public override protocolFeeRecipient;
    uint8 public override protocolFee; // out of 1000
    mapping(address => address) public override royaltyFeeRecipientOf;
    mapping(address => uint8) public override royaltyFeeOf; // out of 1000
    mapping(address => bool) public override isStrategyWhitelisted;
    mapping(bytes32 => bool) public override isCancelledOrFinished;

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

    function cancel(Order memory ask) external override {
        require(ask.maker == msg.sender, "SHOYU: FORBIDDEN");

        bytes32 hash = _hashOrder(ask);
        isCancelledOrFinished[hash] = true;

        emit Cancel(hash);
    }

    function bid721(Order memory ask, Order memory bid) external override nonReentrant {
        bytes32 hash = _checkPreconditions(ask, bid);

        uint256 bidPrice = abi.decode(bid.params, (uint256));
        IStrategy(ask.strategy).validatePurchase(ask.params, bidPrice);

        address to = bid.recipient;
        if (to == address(0)) to = bid.maker;
        IERC721(ask.nft).safeTransferFrom(ask.maker, to, ask.tokenId);

        address recipient = _transferFeesAndFunds(ask, bid.maker, bidPrice);

        emit Bid(hash, ask.maker, bid.maker, ask.nft, ask.tokenId, 1, ask.currency, recipient, bidPrice);
    }

    function bid1155(Order memory ask, Order memory bid) external override nonReentrant {
        bytes32 hash = _checkPreconditions(ask, bid);

        uint256 bidPrice = abi.decode(bid.params, (uint256));
        IStrategy(ask.strategy).validatePurchase(ask.params, bidPrice);

        address to = bid.recipient;
        if (to == address(0)) to = bid.maker;
        IERC1155(ask.nft).safeTransferFrom(ask.maker, to, ask.tokenId, bid.amount, "");

        uint256 bidPriceSum = bidPrice * bid.amount;
        address recipient = _transferFeesAndFunds(ask, bid.maker, bidPriceSum);

        emit Bid(hash, ask.maker, bid.maker, ask.nft, ask.tokenId, bid.amount, ask.currency, recipient, bidPriceSum);
    }

    function _checkPreconditions(Order memory ask, Order memory bid) internal returns (bytes32 hash) {
        hash = _hashOrder(ask);
        require(!isCancelledOrFinished[hash], "SHOYU: CANCELLED_OR_FINISHED");
        isCancelledOrFinished[hash] = true;

        _validateOrder(ask);
        _matchOrders(ask, bid);
        _verifyOrder(ask, hash);
        _verifyOrder(bid, _hashOrder(bid));
    }

    function _hashOrder(Order memory order) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.maker,
                    order.taker,
                    order.nft,
                    order.strategy,
                    order.tokenId,
                    order.amount,
                    order.currency,
                    order.recipient,
                    keccak256(order.params)
                )
            );
    }

    function _validateOrder(Order memory order) internal view {
        require(order.maker != address(0), "SHOYU: INVALID_MAKER");
        require(order.nft != address(0), "SHOYU: INVALID_NFT");
        require(order.amount > 0, "SHOYU: INVALID_AMOUNT");
        require(order.currency != address(0), "SHOYU: INVALID_CURRENCY");
        IStrategy(order.strategy).validateParams(order.params);
    }

    function _matchOrders(Order memory ask, Order memory bid) internal pure {
        require(ask.maker == bid.taker, "SHOYU: UNMATCHED_MAKER_TAKER");
        require(ask.nft == bid.nft, "SHOYU: UNMATCHED_NFT");
        require(ask.strategy == bid.strategy, "SHOYU: UNMATCHED_STRATEGY");
        require(ask.tokenId == bid.tokenId, "SHOYU: UNMATCHED_TOKEN_ID");
        require(ask.amount >= bid.amount, "SHOYU: UNMATCHED_AMOUNT");
        require(ask.currency == bid.currency, "SHOYU: UNMATCHED_CURRENCY");
    }

    function _verifyOrder(Order memory order, bytes32 hash) internal view {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hash));
        if (Address.isContract(order.maker)) {
            require(
                IERC1271(order.maker).isValidSignature(digest, abi.encodePacked(order.r, order.s, order.v)) ==
                    0x1626ba7e,
                "SHOYU: UNAUTHORIZED"
            );
        } else {
            require(ecrecover(digest, order.v, order.r, order.s) == order.maker, "SHOYU: UNAUTHORIZED");
        }
    }

    function _transferFeesAndFunds(
        Order memory ask,
        address bidder,
        uint256 bidPriceSum
    ) internal returns (address recipient) {
        uint256 protocolFeeAmount = (bidPriceSum * protocolFee) / 1000;
        IERC20(ask.currency).safeTransferFrom(bidder, protocolFeeRecipient, protocolFeeAmount);

        uint256 remainder = bidPriceSum - protocolFeeAmount;
        uint256 royaltyFeeAmount = (remainder * royaltyFeeOf[ask.nft]) / 1000;
        if (royaltyFeeAmount > 0) {
            remainder -= royaltyFeeAmount;
            IERC20(ask.currency).safeTransferFrom(bidder, royaltyFeeRecipientOf[ask.nft], royaltyFeeAmount);
        }

        recipient = ask.recipient;
        if (recipient == address(0)) recipient = ask.maker;
        IERC20(ask.currency).safeTransferFrom(bidder, recipient, remainder);
    }
}
