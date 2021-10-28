// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./interfaces/IBaseNFT721.sol";
import "https://github.com/FrankieIsLost/RICKS/blob/master/contracts/interfaces/IWETH.sol";
import "https://github.com/FrankieIsLost/RICKS/blob/master/contracts/StakingPool.sol";

/// @notice RICKS -- https://www.paradigm.xyz/2021/10/ricks/. Auction design based off fractional TokenVault.sol.
/// @dev Implementation based on https://github.com/FrankieIsLost/RICKS.
contract RICKS is ERC20, ERC721Holder {

    /// ---------------------------
    /// -------- Addresses --------
    /// ---------------------------
    
    /// @notice weth address
    IWETH public immutable wETH;

    /// @notice staking pool address
    address public immutable stakingPool;

    /// -----------------------------------
    /// -------- ERC721 INFORMATION --------
    /// -----------------------------------

    /// @notice the ERC721 token address being fractionalized
    IBaseNFT721 public immutable token;

    /// @notice the ERC721 token ID being fractionalized
    uint256 public immutable id;

    /// -------------------------------------
    /// -------- AUCTION INFORMATION --------
    /// -------------------------------------

    /// @notice the unix timestamp end time of auction
    uint256 public auctionEndTime;

    /// @notice minimum amount of time between auctions 
    uint256 public auctionInterval;

    /// @notice minimum % increase between bids. 3 decimals, ie. 100 = 10%
    uint256 public minBidIncrease;

    /// @notice the minumum length of auctions
    uint256 public auctionLength;

    /// @notice the current price of the winning Bid during auction
    uint256 public currentPrice;

    /// @notice the current user winning the token auction
    address payable public winning;

     /// @notice the amount of tokens being sold in current auction
    uint256 public tokenAmountForAuction;

    /// @notice possible states for the auction
    enum AuctionState {empty, inactive, active, finalized }

    /// @notice auction's current state 
    AuctionState public auctionState;

    /// @notice price per shard for the five most recent auctions
    uint256[5] public mostRecentPrices;

    /// @notice number of auctions that have taken place 
    uint256 public numberOfAuctions;

    /// @notice price per token when buyout is completed
    uint256 public finalBuyoutPricePerToken;

    /// -------------------------------------
    /// -------- Inflation Parameters -------
    /// -------------------------------------

    /// @notice rate of daily RICKS issuance. 3 decimals, ie. 100 = 10%
    uint256 public immutable dailyInflationRate;

    /// @notice initial supply of RICKS tokens
    uint256 public initialSupply;

    /// ------------------------
    /// -------- EVENTS --------
    /// ------------------------

    /// @notice An event emitted when an auction is activated
    event Activate(address indexed initiatior);

    /// @notice An event emitted when an auction starts
    event Start(address indexed buyer, uint price);

    /// @notice An event emitted when a bid is made
    event Bid(address indexed buyer, uint price);

    /// @notice An event emitted when an auction is won
    event Won(address indexed buyer, uint price);

    /// @notice An event emitted when someone redeems all tokens for the NFT
    event Redeem(address indexed redeemer);

     /// @notice An event emitted with the price per token required for a buyout
    event BuyoutPricePerToken(address indexed buyer, uint price);

    constructor(
        string memory _name,
        string memory _symbol,
        IBaseNFT721 _token,
        uint256 _id,
        uint256 _supply,
        uint256 _dailyInflationRate,
        IWETH _wETH
    ) ERC20(_name, _symbol) {
                    
        token = _token;
        id = _id;
        auctionState = AuctionState.empty;

        // default parameters
        auctionLength = 3 hours;
        auctionInterval = 1 days;
        minBidIncrease = 50; // 5%

        require(_dailyInflationRate > 0, "inflation rate cannot be negative");
        dailyInflationRate = _dailyInflationRate;
        initialSupply = _supply;

        stakingPool = address(new StakingPool(address(this), address(_wETH)));
        
        wETH = _wETH;
    }
    
    /// @notice RICKS starts in `empty` state until the specified ERC721 has been transfered to the contract 
    /// once this has been done, activate can be fully executed to mint erc20s and start inflation schedule
    function activate() public {
        require(auctionState == AuctionState.empty, "already active");
        
        token.safeTransferFrom(msg.sender, address(this), id);

        // begin inflation schedule from this point
        auctionEndTime = block.timestamp;
        auctionState = AuctionState.inactive;

        // mint initial supply
        _mint(msg.sender, initialSupply);
        emit Activate(msg.sender);
    }

    /// @notice RICKS starts in `empty` state until the specified ERC721 has been transfered to the contract 
    /// once this has been done, activate can be fully executed to mint erc20s and start inflation schedule
    /// @dev This performs a Shoyu-compatible `permit` metaTX
    function activateWithPermit(uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        token.permit(address(this), id, deadline, v, r, s);
        activate();
    }

    /// @notice kick off an auction. The msg.value is the bid amount
    function startAuction() external payable {
        require(auctionState == AuctionState.inactive, "cannot start auction that's not innactive");
        require(block.timestamp > auctionEndTime + auctionInterval, "cannot start auction yet");
        require(msg.value > 0, "cannot bid 0");

        // amount of current infation per day
        uint256 inflationPerDayAmount = dailyInflationRate * totalSupply(); 
        // number of seconds of inflation 
        uint256 inflationSecondsForCurrentAuction = block.timestamp - auctionEndTime;
        // infation amount is number of inflation seconds in period, times daily inflation amount, 
        // divided by 86400 (# of seconds per day), divided by 1000 to normalize inflation rate
        uint256 inflationAmount = inflationSecondsForCurrentAuction * inflationPerDayAmount / 86400000;

        require(inflationAmount > 0, "amount up for auction must be greater than 0");
        
        tokenAmountForAuction = inflationAmount;
        auctionEndTime = block.timestamp + auctionLength;
        auctionState = AuctionState.active;

        currentPrice = msg.value;
        winning = payable(msg.sender);

        emit Start(msg.sender, msg.value);
    }

    /// @notice  bid on auction. The msg.value is the bid amount
    function bid() external payable {
        require(auctionState == AuctionState.active, "cannot bid on auction that is not live");
        require(block.timestamp < auctionEndTime, "cannot bid on auction that has ended");

        uint256 minIncreaseMultiplier = minBidIncrease + 1000;
        require(msg.value * 1000 >= currentPrice * minIncreaseMultiplier, "bid too low");

        // If bid is within 15 minutes of auction end, extend auction
        if (auctionEndTime - block.timestamp <= 15 minutes) {
            auctionEndTime += 15 minutes;
        }

        _sendETHOrWETH(winning, currentPrice);

        currentPrice = msg.value;
        winning = payable(msg.sender);

        emit Bid(msg.sender, msg.value);
    }

    /// @notice an external function to end an auction after the timer has run out. Mint RICKS for
    /// winer and assign payout
    function endAuction() external {
        require(auctionState == AuctionState.active, "cannot end auction that is not live");
        require(block.timestamp >= auctionEndTime, "cannot end auction yet");

        updateMostRecentPrices(currentPrice/tokenAmountForAuction);

        auctionState = AuctionState.inactive;
        auctionEndTime = block.timestamp;
        numberOfAuctions += 1;
        
        wETH.deposit{value: currentPrice}();
        wETH.approve(stakingPool, currentPrice);
        StakingPool(stakingPool).depositReward(currentPrice);
        _mint(winning, tokenAmountForAuction);

        emit Won(winning, currentPrice);
    }

    /// @notice trigger a buyout of the underlying ERC721
    function buyout() external payable {
        require(auctionState == AuctionState.inactive, "can't buy out during auction");
        require(numberOfAuctions >= 5, "not enough auctions to establish price");
        
        uint256 pricePerToken = buyoutPricePerToken(msg.sender);
        uint256 unownedSupply = totalSupply() - balanceOf(msg.sender);
        uint256 totalBuyoutCost = pricePerToken * unownedSupply;

        require(msg.value >= totalBuyoutCost, "not enough to complete buyout");
        _burn(msg.sender, balanceOf(msg.sender));

        finalBuyoutPricePerToken = pricePerToken;
        
        // transfer erc721 to redeemer
        IERC721(token).transferFrom(address(this), msg.sender, id);
        
        auctionState = AuctionState.finalized;

        emit Redeem(msg.sender);
    }

    /// @notice return the potential buyout price per token for the given buyer. The buyer 
    /// has to pay a premium to all other token holders. The premium scales quadratically 
    // with the amount of supply that is not owned by the buyer. We use the averge of the past 
    // 5 auctions to establish the implied total price.
    /// @param buyer the prospective buyer
    function buyoutPricePerToken(address buyer) public returns (uint256) {
        uint256 ownedSupplyRatio = 1000 * balanceOf(buyer) / totalSupply();
        uint256 unownedSupplyRatio = 1000 - ownedSupplyRatio;

        // premium scales quadratically with unowned supply
        uint256 premium = 1000 + (unownedSupplyRatio ** 2 / 100);
        uint256 averagePrice = getAveragePrice();

        uint256 pricePerToken = averagePrice * premium / 1000;

        emit BuyoutPricePerToken(buyer, pricePerToken);
        return pricePerToken;
    }

    /// @notice After buyout has been completed, remaining holders are able to redeem tokens for weth
    function redeemTokensForWeth() external {
        require(auctionState == AuctionState.finalized, "cannot redeem yet");
        uint256 balance = balanceOf(msg.sender);
        uint256 paymentDue = balance * finalBuyoutPricePerToken;
    
        _burn(msg.sender, balance);
        wETH.deposit{value: paymentDue}();
        wETH.transfer(msg.sender, paymentDue);
    }

    /// @notice keep track of the most recent 5 prices per shard
    /// @param newPrice newest price per shard
    function updateMostRecentPrices(uint256 newPrice) private {
        for(uint256 i = 1; i < mostRecentPrices.length; i++) {
            mostRecentPrices[i-1] = mostRecentPrices[i];
        }
        mostRecentPrices[mostRecentPrices.length-1] = newPrice;
    }

    /// @notice average price per shard from 5 last auctions, used to determine implied valuation
    function getAveragePrice() public view returns (uint256) {
        uint256 price = 0;
        for(uint256 i = 0; i < mostRecentPrices.length; i++) {
           price += mostRecentPrices[i];
        }
        return price / mostRecentPrices.length;
    }


    // Will attempt to transfer ETH, but will transfer WETH instead if it fails.
    function _sendETHOrWETH(address to, uint256 value) internal {
        // Try to transfer ETH to the given recipient.
        if (!_attemptETHTransfer(to, value)) {
            wETH.deposit{value: value}();
            wETH.transfer(to, value);
        }
    }

    function _attemptETHTransfer(address to, uint256 value)
        internal
        returns (bool)
    {
        (bool success, ) = to.call{value: value, gas: 30000}("");
        return success;
    }
}
