// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./base/ERC20SnapshotInitializable.sol";
import "./interfaces/IERC1271.sol";
import "./interfaces/INFTExchange.sol";

contract NFTGovernanceToken is ERC20SnapshotInitializable, IERC1271 {
    using SafeERC20 for IERC20;
    using Orders for Orders.Ask;

    struct Proposal {
        bool executed;
        ProposalType proposalType;
        bytes data;
        uint256 deadline;
        uint256 snapshotId;
    }

    enum Status {Raising, Buying, Bought, Sold}
    enum ProposalType {UpdateMinimumQuorum, UpdateSigner, Sell}

    event UpdateMinimumQuorum(uint8 minimumQuorum);
    event UpdateSigner(address signer);

    event Deposit(address indexed account, uint256 amount);
    event Bid(bool executed);
    event ClaimRefund(address indexed account, uint256 amount);
    event Mint(address indexed account, uint256 balance);
    event Burn(address indexed account, uint256 balance);

    event SubmitProposal(
        uint256 id,
        ProposalType indexed proposalType,
        uint256 snapshotId,
        address indexed from,
        uint256 power
    );
    event ConfirmProposal(uint256 id, address indexed from, uint256 power);
    event RevokeProposal(uint256 id, address indexed from, uint256 power);
    event ExecuteProposal(uint256 id);

    uint256 internal constant TOTAL_SUPPLY = 100e18;

    address public exchange;
    Orders.Ask public order;
    uint256 public price;
    uint8 minimumQuorum; // out of 100
    address public signer;

    Status public status;
    uint256 public totalPendingAmount;
    mapping(address => uint256) public pendingAmount;

    Proposal[] public proposals;
    mapping(uint256 => uint256) public totalPowerOf;
    mapping(uint256 => mapping(address => uint256)) public powerOf;

    mapping(bytes32 => bool) internal _hashApproved;

    function initialize(
        address _exchange,
        Orders.Ask calldata _order,
        uint256 _price,
        uint8 _minimumQuorum
    ) external initializer {
        __ERC20_init("Shoyu NFT Governance", "NFT-G");

        exchange = _exchange;
        order = _order;
        price = _price;

        _updateMinimumQuorum(_minimumQuorum);
        _updateSigner(msg.sender);
    }

    function proposalsLength() external view returns (uint256) {
        return proposals.length;
    }

    function nft() external view returns (address) {
        return order.nft;
    }

    function tokenId() external view returns (uint256) {
        return order.tokenId;
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4 magicValue) {
        if (!_hashApproved[hash]) return 0xffffffff;

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (ecrecover(hash, v, r, s) == signer) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }

    function _updateMinimumQuorum(uint8 _minimumQuorum) internal {
        require(_minimumQuorum <= 100, "SHOYU: INVALID_MINIMUM_QUORUM");

        minimumQuorum = _minimumQuorum;

        emit UpdateMinimumQuorum(_minimumQuorum);
    }

    function _updateSigner(address _signer) internal {
        require(_signer != address(0), "SHOYU: INVALID_SIGNER");

        signer = _signer;

        emit UpdateSigner(_signer);
    }

    function deposit(uint256 amount) external {
        require(status == Status.Raising, "SHOYU: INVALID_STATUS");
        require(totalPendingAmount + amount <= price, "SHOYU: AMOUNT_EXCEEDED");

        totalPendingAmount += amount;
        pendingAmount[msg.sender] += amount;

        IERC20(order.currency).safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, amount);

        if (totalPendingAmount == price) {
            if (_bid()) {
                status = Status.Bought;
            } else {
                status = Status.Buying;
            }
        }
    }

    function bid() external {
        require(status == Status.Buying, "SHOYU: INVALID_STATUS");

        if (_bid()) {
            status = Status.Bought;
        }
    }

    function _bid() internal returns (bool executed) {
        IERC20(order.currency).approve(exchange, price);
        try INFTExchange(exchange).bid721(order, price) returns (bool _executed) {
            executed = _executed;
            emit Bid(executed);
        } catch {
            executed = false;
        }
    }

    function claimRefund() external {
        require(status == Status.Buying, "SHOYU: INVALID_STATUS");
        require(INFTExchange(exchange).isCancelledOrExecuted(order.hash()), "SHOYU: NOT_CANCELLED");

        uint256 amount = pendingAmount[msg.sender];
        require(amount > 0, "SHOYU: NO_DEPOSIT");

        pendingAmount[msg.sender] = 0;
        totalPendingAmount -= amount;

        IERC20(order.currency).safeTransfer(msg.sender, amount);

        emit ClaimRefund(msg.sender, amount);
    }

    function mint() external {
        require(status == Status.Bought, "SHOYU: INVALID_STATUS");

        uint256 amount = pendingAmount[msg.sender];
        require(amount > 0, "SHOYU: NO_DEPOSIT");

        pendingAmount[msg.sender] = 0;
        totalPendingAmount -= amount;

        uint256 balance = (TOTAL_SUPPLY * amount) / price;
        _mint(msg.sender, balance);

        emit Mint(msg.sender, balance);
    }

    function burn(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        (address strategy, address currency, uint256 deadline, bytes memory params) =
            abi.decode(proposal.data, (address, address, uint256, bytes));

        if (status != Status.Sold) {
            bytes32 hash = _hashSellOrder(strategy, currency, deadline, params);

            require(_hashApproved[hash], "SHOYU: INVALID_HASH");
            require(INFTExchange(exchange).isCancelledOrExecuted(hash), "SHOYU: NOT_SOLD");

            status = Status.Sold;
        }

        uint256 share = balanceOf(msg.sender);
        require(share > 0, "SHOYU: INSUFFICIENT_BALANCE");
        _burn(msg.sender, share);

        uint256 fund = IERC20(currency).balanceOf(address(this));
        uint256 amount = (fund * share) / totalSupply();
        IERC20(currency).safeTransfer(msg.sender, amount);

        emit Burn(msg.sender, amount);
    }

    function submitProposal(
        ProposalType proposalType,
        bytes calldata data,
        uint256 deadline
    ) external {
        require(block.number < deadline, "SHOYU: INVALID_DEADLINE");

        uint256 power = balanceOf(msg.sender);
        require(power > 0, "SHOYU: INSUFFICIENT_POWER");

        uint256 id = proposals.length;
        uint256 snapshotId = _snapshot();

        proposals.push(Proposal(false, proposalType, data, deadline, snapshotId));
        totalPowerOf[id] = power;
        powerOf[id][msg.sender] = power;

        emit SubmitProposal(id, proposalType, snapshotId, msg.sender, power);
    }

    function confirmProposal(uint256 id) external {
        Proposal storage proposal = proposals[id];
        require(!proposal.executed, "SHOYU: EXECUTED");
        require(block.number <= proposal.deadline, "SHOYU: EXPIRED");
        require(totalPowerOf[id] > 0, "SHOYU: NOT_SUBMITTED");
        require(powerOf[id][msg.sender] == 0, "SHOYU: CONFIRMED");

        uint256 power = balanceOfAt(msg.sender, proposal.snapshotId);
        require(power > 0, "SHOYU: INSUFFICIENT_POWER");

        totalPowerOf[id] += power;
        powerOf[id][msg.sender] = power;

        emit ConfirmProposal(id, msg.sender, power);

        if (totalPowerOf[id] > _minPower()) {
            _executeProposal(proposal);

            emit ExecuteProposal(id);
        }
    }

    function revokeProposal(uint256 id) external {
        Proposal storage proposal = proposals[id];
        require(!proposal.executed, "SHOYU: EXECUTED");
        require(block.number <= proposal.deadline, "SHOYU: EXPIRED");

        uint256 power = powerOf[id][msg.sender];
        require(power > 0, "SHOYU: NOT_CONFIRMED");

        totalPowerOf[id] -= power;
        powerOf[id][msg.sender] = 0;

        emit RevokeProposal(id, msg.sender, power);
    }

    function executeProposal(uint256 id) public {
        Proposal storage proposal = proposals[id];
        require(proposal.deadline < block.number, "SHOYU: NOT_FINISHED");
        require(totalPowerOf[id] > _minPower(), "SHOYU: NOT_SUBMITTED");

        _executeProposal(proposal);

        emit ExecuteProposal(id);
    }

    function _minPower() internal view returns (uint256) {
        return (TOTAL_SUPPLY * minimumQuorum) / 100;
    }

    function _executeProposal(Proposal storage proposal) internal {
        proposal.executed = true;

        if (proposal.proposalType == ProposalType.UpdateSigner) {
            address _signer = abi.decode(proposal.data, (address));
            _updateSigner(_signer);
        } else if (proposal.proposalType == ProposalType.UpdateMinimumQuorum) {
            uint8 _minimumQuorum = abi.decode(proposal.data, (uint8));
            _updateMinimumQuorum(_minimumQuorum);
        } else if (proposal.proposalType == ProposalType.Sell) {
            (address strategy, address currency, uint256 deadline, bytes memory params) =
                abi.decode(proposal.data, (address, address, uint256, bytes));
            bytes32 hash = _hashSellOrder(strategy, currency, deadline, params);
            _hashApproved[hash] = true;
        }
    }

    function _hashSellOrder(
        address strategy,
        address currency,
        uint256 deadline,
        bytes memory params
    ) internal view returns (bytes32) {
        Orders.Ask memory sellOrder =
            Orders.Ask(
                address(this),
                order.nft,
                order.tokenId,
                1,
                strategy,
                currency,
                deadline,
                params,
                uint8(0),
                "",
                ""
            );
        return sellOrder.hash();
    }
}
