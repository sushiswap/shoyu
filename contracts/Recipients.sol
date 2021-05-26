// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/TransferHelper.sol";

contract Recipients is Initializable {
    event Initialize(address[] members, uint8[] weights);
    event Check(address indexed token, uint256 id);
    event Claim(address indexed token, uint256 amount);

    uint8 internal constant WEIGHT_SUM = 100;

    mapping(address => bool) public isMember;
    mapping(address => uint8) public weightOf;
    mapping(address => uint256) public reserveOf;
    mapping(address => uint256[]) public payments;
    mapping(address => mapping(address => mapping(uint256 => bool))) public paymentClaimed;

    function initialize(address[] memory members, uint8[] memory weights) external initializer {
        require(members.length == weights.length, "SHOYU: INVALID_DATA_LENGTH");
        uint8 weightSum;
        for (uint256 i; i < members.length; i++) {
            address member = members[i];
            uint8 weight = weights[i];
            require(weight > 0, "SHOYU: INVALID_WEIGHT");
            isMember[member] = true;
            weightOf[member] = weight;
            weightSum += weight;
        }
        require(weightSum == WEIGHT_SUM, "SHOYU: INVALID_WEIGHT_SUM");

        emit Initialize(members, weights);
    }

    function paymentsLength(address token) external view returns (uint256) {
        return payments[token].length;
    }

    function checkAndClaim(address token) external {
        require(isMember[msg.sender], "SHOYU: FORBIDDEN");

        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 reserve = reserveOf[token];
        uint256 payment = balance - reserve;
        if (payment > 0) {
            reserveOf[token] += payment;
            payments[token].push(payment);

            uint256 id = payments[token].length - 1;
            _claim(token, id);

            emit Check(token, id);
        }
    }

    function claim(address token, uint256 id) external {
        require(isMember[msg.sender], "SHOYU: FORBIDDEN");
        require(!paymentClaimed[token][msg.sender][id], "SHOYU: ALREADY_CLAIMED");

        _claim(token, id);
    }

    function claimMultiple(address token, uint256[] memory ids) external {
        require(isMember[msg.sender], "SHOYU: FORBIDDEN");
        for (uint256 i; i < ids.length; i++) {
            uint256 id = ids[i];
            require(!paymentClaimed[token][msg.sender][id], "SHOYU: ALREADY_CLAIMED");
            _claim(token, id);
        }
    }

    function _claim(address token, uint256 id) internal {
        uint256 amount = (weightOf[msg.sender] * payments[token][id]) / WEIGHT_SUM;
        reserveOf[token] -= amount;
        paymentClaimed[token][msg.sender][id] = true;

        TransferHelper.safeTransfer(token, msg.sender, amount);

        emit Claim(token, id);
    }
}
