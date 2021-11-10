// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./interfaces/IBaseNFT721.sol";
import "./interfaces/IWETHv9minimal.sol";
import "./base/StakingPool.sol";

/// @dev Implementation based on https://github.com/FrankieIsLost/RICKS, https://www.paradigm.xyz/2021/10/ricks/.
contract RICKSV0 is ERC20, ERC721Holder {
    address public immutable wETH;
    address public immutable stakingPool;
    IBaseNFT721 public immutable token;
    uint256 public immutable id;

    /// -------------------------------------
    /// -------- AUCTION INFORMATION --------
    /// -------------------------------------

    uint256 public auctionEndTime;
    uint256 public auctionInterval;
    uint256 public minBidIncrease;
    uint256 public auctionLength;
    uint256 public currentPrice;
    address payable public winning;
    uint256 public tokenAmountForAuction;

    enum AuctionState {empty, inactive, active, finalized}

    AuctionState public auctionState;

    uint256[5] public mostRecentPrices;
    uint256 public numberOfAuctions;
    uint256 public finalBuyoutPricePerToken;

    /// -------------------------------------
    /// -------- Inflation Parameters -------
    /// -------------------------------------

    uint256 public immutable dailyInflationRate;
    uint256 public initialSupply;

    /// ------------------------
    /// -------- EVENTS --------
    /// ------------------------

    event Activate(address indexed initiatior);
    event Start(address indexed buyer, uint256 price);
    event Bid(address indexed buyer, uint256 price);
    event Won(address indexed buyer, uint256 price);
    event Redeem(address indexed redeemer);
    event BuyoutPricePerToken(address indexed buyer, uint256 price);

    constructor(
        string memory _name,
        string memory _symbol,
        IBaseNFT721 _token,
        uint256 _id,
        uint256 _supply,
        uint256 _dailyInflationRate,
        address _wETH
    ) ERC20(_name, _symbol) {
                    
        token = _token;
        id = _id;
        auctionState = AuctionState.empty;

        // default parameters
        auctionLength = 3 hours;
        auctionInterval = 1 days;
        minBidIncrease = 50; // 5%

        require(_dailyInflationRate > 0, "SHOYU: NEGATIVE_INFLATION_RATE");
        dailyInflationRate = _dailyInflationRate;
        initialSupply = _supply;

        stakingPool = address(new StakingPool(address(this), address(_wETH)));
        
        wETH = _wETH;
    }
    
    function activate() public {
        require(auctionState == AuctionState.empty, "SHOYU: ALREADY_ACTIVE");
        
        token.safeTransferFrom(msg.sender, address(this), id);
        
        // begin inflation schedule from this point
        auctionEndTime = block.timestamp;
        auctionState = AuctionState.inactive;

        // mint initial supply
        _mint(msg.sender, initialSupply);
        emit Activate(msg.sender);
    }

    function activateWithPermit(uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        token.permit(address(this), id, deadline, v, r, s);
        activate();
    }

    function startAuction() external payable {
        require(auctionState == AuctionState.inactive, "SHOYU: AUCTION_ACTIVE");
        require(block.timestamp > auctionEndTime + auctionInterval, "SHOYU: CANNOT_START_AUCTION_YET");
        require(msg.value > 0, "SHOYU: ZERO_BID");

        // amount of current inflation per day
        uint256 inflationPerDayAmount = dailyInflationRate * totalSupply(); 
        // number of seconds of inflation 
        uint256 inflationSecondsForCurrentAuction = block.timestamp - auctionEndTime;
        // inflation amount is number of inflation seconds in period, times daily inflation amount, 
        // divided by 86400 (# of seconds per day), divided by 1000 to normalize inflation rate
        uint256 inflationAmount = inflationSecondsForCurrentAuction * inflationPerDayAmount / 86400000;

        require(inflationAmount > 0, "SHOYU: ZERO_AUCTION_AMOUNT");
        
        tokenAmountForAuction = inflationAmount;
        auctionEndTime = block.timestamp + auctionLength;
        auctionState = AuctionState.active;

        currentPrice = msg.value;
        winning = payable(msg.sender);

        emit Start(msg.sender, msg.value);
    }

    function bid() external payable {
        require(auctionState == AuctionState.active, "SHOYU: AUCTION_NOT_ACTIVE");
        require(block.timestamp < auctionEndTime, "SHOYU: AUCTION_ENDED");

        uint256 minIncreaseMultiplier = minBidIncrease + 1000;
        require(msg.value * 1000 >= currentPrice * minIncreaseMultiplier, "SHOYU: BID_TOO_LOW");

        // if bid is within 15 minutes of auction end, extend auction
        if (auctionEndTime - block.timestamp <= 15 minutes) {
            auctionEndTime += 15 minutes;
        }

        _sendETHOrWETH(winning, currentPrice);

        currentPrice = msg.value;
        winning = payable(msg.sender);

        emit Bid(msg.sender, msg.value);
    }

    function endAuction() external {
        require(auctionState == AuctionState.active, "SHOYU: AUCTION_NOT_ACTIVE");
        require(block.timestamp >= auctionEndTime, "SHOYU: CANNOT_END_AUCTION_YET");

        updateMostRecentPrices(currentPrice / tokenAmountForAuction);

        auctionState = AuctionState.inactive;
        auctionEndTime = block.timestamp;
        numberOfAuctions += 1;
        
        IWETHv9minimal(wETH).deposit{value: currentPrice}();
        IERC20(wETH).approve(stakingPool, currentPrice);
        StakingPool(stakingPool).depositReward(currentPrice);
        _mint(winning, tokenAmountForAuction);

        emit Won(winning, currentPrice);
    }

    function buyout() external payable {
        require(auctionState == AuctionState.inactive, "SHOYU: CANNOT_BUYOUT_DURING_AUCTION");
        require(numberOfAuctions >= 5, "SHOYU: NOT_ENOUGH_AUCTIONS_FOR_PRICE");
        
        uint256 pricePerToken = buyoutPricePerToken(msg.sender);
        uint256 unownedSupply = totalSupply() - balanceOf(msg.sender);
        uint256 totalBuyoutCost = pricePerToken * unownedSupply;

        require(msg.value >= totalBuyoutCost, "SHOYU: NOT_SUFF_FOR_BUYOUT");
        _burn(msg.sender, balanceOf(msg.sender));

        finalBuyoutPricePerToken = pricePerToken;
        
        // transfer erc721 to redeemer
        IERC721(token).transferFrom(address(this), msg.sender, id);
        
        auctionState = AuctionState.finalized;

        emit Redeem(msg.sender);
    }

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

    function redeemTokensForWeth() external {
        require(auctionState == AuctionState.finalized, "SHOYU: CANNOT_REDEEM_YET");
        uint256 balance = balanceOf(msg.sender);
        uint256 paymentDue = balance * finalBuyoutPricePerToken;
    
        _burn(msg.sender, balance);
        IWETHv9minimal(wETH).deposit{value: paymentDue}();
        IERC20(wETH).transfer(msg.sender, paymentDue);
    }

    function updateMostRecentPrices(uint256 newPrice) private {
        for (uint256 i = 1; i < mostRecentPrices.length; i++) {
            mostRecentPrices[i - 1] = mostRecentPrices[i];
        }
        
        mostRecentPrices[mostRecentPrices.length - 1] = newPrice;
    }

    function getAveragePrice() public view returns (uint256) {
        uint256 price;
        
        for (uint256 i; i < mostRecentPrices.length; i++) {
            price += mostRecentPrices[i];
        }
        
        return price / mostRecentPrices.length;
    }

    function _sendETHOrWETH(address to, uint256 value) internal {
        if (!_attemptETHTransfer(to, value)) {
            IWETHv9minimal(wETH).deposit{value: value}();
            IERC20(wETH).transfer(to, value);
        }
    }

    function _attemptETHTransfer(address to, uint256 value) internal returns (bool) {
        (bool success, ) = to.call{value: value, gas: 30000}("");
        return success;
    }
}
