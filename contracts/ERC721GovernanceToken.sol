// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IERC721GovernanceToken.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/IBaseExchange.sol";
import "./interfaces/IOrderBook.sol";
import "./base/ERC20SnapshotInitializable.sol";
import "./libraries/Orders.sol";

contract ERC721GovernanceToken is ERC20SnapshotInitializable, IERC721GovernanceToken {
    using SafeERC20 for IERC20;
    using Orders for Orders.Ask;

    struct SellProposal {
        bool executed;
        address strategy;
        address currency;
        uint256 deadline;
        bytes params;
        uint256 expiration;
        uint256 snapshotId;
    }

    uint256 internal constant TOTAL_SUPPLY = 100e18;

    address public override factory;
    address public override orderBook;
    address public override nft;
    uint256 public override tokenId;
    uint8 public override minimumQuorum; // out of 100

    SellProposal[] public override proposals;
    mapping(uint256 => uint256) public override totalPowerOf;
    mapping(uint256 => mapping(address => uint256)) public override powerOf;

    mapping(uint256 => bool) internal _sold;

    function initialize(
        address _factory,
        address _orderBook,
        address _nft,
        uint256 _tokenId,
        uint8 _minimumQuorum
    ) external override initializer {
        __ERC20_init("Shoyu NFT-721 Governance", "G-ERC721");
        require(_minimumQuorum <= 100, "SHOYU: INVALID_MINIMUM_QUORUM");

        factory = _factory;
        orderBook = _orderBook;
        nft = _nft;
        tokenId = _tokenId;
        minimumQuorum = _minimumQuorum;
    }

    function proposalsLength() external view override returns (uint256) {
        return proposals.length;
    }

    function mint(address account, uint256 amount) external override {
        require(nft == msg.sender, "SHOYU: FORBIDDEN");

        _mint(account, amount);
    }

    function claimPayout(uint256 id) external override {
        SellProposal storage proposal = proposals[id];

        if (!_sold[id]) {
            address exchange = ITokenFactory(factory).isNFT721(nft) ? nft : ITokenFactory(factory).erc721Exchange();
            bytes32 hash = _hashOrder(proposal);
            require(IBaseExchange(exchange).amountFilled(hash) > 0, "SHOYU: NOT_SOLD");

            _sold[id] = true;
        }

        uint256 share = balanceOf(msg.sender);
        require(share > 0, "SHOYU: INSUFFICIENT_BALANCE");
        _burn(msg.sender, share);

        address _currency = proposal.currency;
        uint256 payout = IERC20(_currency).balanceOf(address(this));
        uint256 amount = (payout * share) / totalSupply();
        IERC20(_currency).safeTransfer(msg.sender, amount);
    }

    function _hashOrder(SellProposal storage proposal) internal view returns (bytes32) {
        Orders.Ask memory ask =
            Orders.Ask(
                address(this),
                nft,
                tokenId,
                1,
                proposal.strategy,
                proposal.currency,
                address(0),
                proposal.deadline,
                proposal.params,
                uint8(0),
                "",
                ""
            );
        return ask.hash();
    }

    function submitSellProposal(
        address strategy,
        address currency,
        uint256 deadline,
        bytes calldata params,
        uint256 expiration
    ) external override {
        require(msg.sender == tx.origin, "SHOYU: CONTRACT_CALL_FORBIDDEN");
        require(block.number < expiration, "SHOYU: EXPIRED");

        uint256 power = balanceOf(msg.sender);
        require(power > 0, "SHOYU: INSUFFICIENT_POWER");

        uint256 id = proposals.length;
        uint256 snapshotId = _snapshot();

        proposals.push(SellProposal(false, strategy, currency, deadline, params, expiration, snapshotId));
        totalPowerOf[id] = power;
        powerOf[id][msg.sender] = power;

        emit SubmitSellProposal(id, snapshotId, msg.sender, power);
    }

    function confirmSellProposal(uint256 id) external override {
        SellProposal storage proposal = proposals[id];
        require(!proposal.executed, "SHOYU: EXECUTED");
        require(block.number <= proposal.expiration, "SHOYU: EXPIRED");
        require(totalPowerOf[id] > 0, "SHOYU: NOT_SUBMITTED");
        require(powerOf[id][msg.sender] == 0, "SHOYU: CONFIRMED");

        uint256 power = balanceOfAt(msg.sender, proposal.snapshotId);
        require(power > 0, "SHOYU: INSUFFICIENT_POWER");

        totalPowerOf[id] += power;
        powerOf[id][msg.sender] = power;

        emit ConfirmSellProposal(id, msg.sender, power);

        if (totalPowerOf[id] > _minPower()) {
            _executeSellProposal(proposal);

            emit ExecuteSellProposal(id);
        }
    }

    function revokeSellProposal(uint256 id) external override {
        SellProposal storage proposal = proposals[id];
        require(!proposal.executed, "SHOYU: EXECUTED");
        require(block.number <= proposal.expiration, "SHOYU: EXPIRED");

        uint256 power = powerOf[id][msg.sender];
        require(power > 0, "SHOYU: NOT_CONFIRMED");

        totalPowerOf[id] -= power;
        powerOf[id][msg.sender] = 0;

        emit RevokeSellProposal(id, msg.sender, power);
    }

    function executeSellProposal(uint256 id) external override {
        SellProposal storage proposal = proposals[id];
        require(!proposal.executed, "SHOYU: EXECUTED");
        require(block.number <= proposal.expiration, "SHOYU: EXPIRED");
        require(totalPowerOf[id] > _minPower(), "SHOYU: NOT_SUBMITTED");

        _executeSellProposal(proposal);

        emit ExecuteSellProposal(id);
    }

    function _minPower() internal view returns (uint256) {
        return (TOTAL_SUPPLY * minimumQuorum) / 100;
    }

    function _executeSellProposal(SellProposal storage proposal) internal {
        try
            IOrderBook(orderBook).submitOrder(
                nft,
                tokenId,
                1,
                proposal.strategy,
                proposal.currency,
                address(0),
                proposal.deadline,
                proposal.params
            )
        returns (bytes32) {
            proposal.executed = true;
        } catch {}
    }
}
