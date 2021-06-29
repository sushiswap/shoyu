# Shoyu: Sushi NFT Exchange and Launchpad

## Features
### Social Token
Social tokens are built around an “ownership economy” principle with the premise that a community will be more valuable tomorrow than today.
Creators can monetize their work as a non-fungible token (NFT) or social token, and supporters can give something back to show their loyalty.

### Multi-Ownership
Not only one address is the seller but multiple ones with his/her own percentage of share.

### Royalties Distribution
Artist can decided whom to distribute royalties to (ie charities, file storage fund)

### NFT Tagging
NFT's can be categorised and tagged to allow better searching capabilities.

### Bidding Options
#### Fixed Price Sale
The first buyer who pays for the fixed price gets the NFT.
#### English Auction
An English auction is a process in which an asset is sold through a suggested opening bid reserve or a starting price that is set by the seller. Increasingly higher bids are accepted from the gamut of buyers. Ultimately, the price is adjusted in a direction that's unfavorable to the bidders.
#### Dutch Auction
A Dutch auction is a market structure in which the price of something offered is determined after taking in all bids to arrive at the highest price at which the total offering can be sold. In this type of auction, investors place a bid for the amount they are willing to buy in terms of quantity and price.
#### [Foundation-style Auction](https://help.foundation.app/en/articles/4742997-a-complete-guide-to-collecting-nfts-and-how-auctions-work)
* **Start at a reserve price**: Creators set a starting price for the auction and buyers must place bids at or above this price. Reserve prices are made public on Foundation.
* **24 hour countdowns**: After the first bid is placed on an artwork at or above the reserve price, a 24 hour countdown for the auction starts. An auction comes to an end when the countdown has run out of time.
* **Time extensions for auctions**: If a bid is placed within the last 15 minutes of an auction, the countdown will reset back 15 minutes. The addition of 15-minute extensions give time for each buyer to have their final opportunity to place a bid, and for the artwork to find its true market value. Time extensions can go on indefinitely until no other bids are placed within the last 15 minutes of an auction.

## Backlog
- [x] SocialToken.sol
- [x] SocialTokenFactory.sol
- [x] NFT721.sol
- [x] NFT1155.sol
- [x] FixedPriceSale.sol
- [x] EnglishAuction.sol
- [x] DutchAuction.sol
- [ ] FirstBidAuction.sol
- [x] PaymentSplitter.sol
- [x] PaymentSplitterFactory.sol
- [x] NFTManager.sol
- [x] NFTGovernanceToken.sol
- [ ] Test Coverage
