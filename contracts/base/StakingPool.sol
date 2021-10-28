// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Implementation based on https://github.com/FrankieIsLost/RICKS/blob/master/contracts/StakingPool.sol.
contract StakingPool {
    IERC20 public stakingToken;
    IERC20 public rewardToken;
    uint256 public totalSupply;
    uint256 public rewardFactor;

    mapping(address => uint) public stakedAmounts;
    mapping(address => uint) public rewardFactorAtStakeTime;
    
    event Stake(address indexed staker, uint amount);
    event Unstake(address indexed staker, uint stakedAmount, uint rewardAmount);
    event DepositReward(address indexed depositor, uint amount);

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function stake(uint256 amount) external {
        require(stakedAmounts[msg.sender] == 0, "SHOYU: MUST_CLAIM_CURRENT_STAKE");
        stakingToken.transferFrom(msg.sender, address(this), amount);
        stakedAmounts[msg.sender] = amount;
        totalSupply += amount;
        rewardFactorAtStakeTime[msg.sender] = rewardFactor;
        emit Stake(msg.sender, amount);
    } 

    function unstakeAndClaimRewards() external {
        uint256 stakedAmount = stakedAmounts[msg.sender];
        uint256 rewardAmount = stakedAmount * (rewardFactor - rewardFactorAtStakeTime[msg.sender]);
        totalSupply -= stakedAmounts[msg.sender];
        stakedAmounts[msg.sender] = 0;
        stakingToken.transfer(msg.sender, stakedAmount);
        rewardToken.transfer(msg.sender, rewardAmount);
        emit Unstake(msg.sender, stakedAmount, rewardAmount);
    }

    function depositReward(uint256 amount) external {
        rewardToken.transferFrom(msg.sender, address(this), amount);
        // we only perform this calculation when there are stakers to claim reward, else
        // we receive payment but can't assign it to any staker
        if(totalSupply != 0) {
            rewardFactor += (amount / totalSupply);
        }
        emit DepositReward(msg.sender, amount);
    }
}
