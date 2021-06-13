
pragma solidity =0.8.3;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";

contract SealedBidAuction {
    address seller;

    IERC20 public token;
    uint256 public reservePrice;
    uint256 public endOfBidding;
    uint256 public endOfRevealing;

    function SealedBidAuction(
        IERC20 _token,
        uint256 _reservePrice,
        uint256 biddingPeriod,
        uint256 revealingPeriod
    )
        public
    {
        token = _token;
        reservePrice = _reservePrice;

        endOfBidding = now + biddingPeriod;
        endOfRevealing = endOfBidding + revealingPeriod;

        seller = msg.sender;
    }

    mapping(address => uint256) public balanceOf;
    mapping(address => bytes32) public hashedBidOf;

    function bid(bytes32 hash) public payable {
        require(now < endOfBidding);

        hashedBidOf[msg.sender] = hash;
        balanceOf[msg.sender] += msg.value;
        require(balanceOf[msg.sender] >= reservePrice);
    }

    address public highBidder = msg.sender;
    uint256 public highBid;

    function reveal(uint256 amount, uint256 nonce) public {
        require(now >= endOfBidding && now < endOfRevealing);

        require(keccak256(amount, nonce) == hashedBidOf[msg.sender]);

        require(amount >= reservePrice);
        require(amount <= balanceOf[msg.sender]);

        if (amount > highBid) {
            // return escrowed bid to previous high bidder
            balanceOf[seller] -= highBid;
            balanceOf[highBidder] += highBid;

            highBid = amount;
            highBidder = msg.sender;

            // transfer new high bid from high bidder to seller
            balanceOf[highBidder] -= highBid;
            balanceOf[seller] += highBid;
        }
    }

    function withdraw() public {
        require(now >= endOfRevealing);

        uint256 amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        msg.sender.transfer(amount);
    }

    function claim() public {
        require(now >= endOfRevealing);

        uint256 t = token.balanceOf(this);
        token.transfer(highBidder, t);
    }


