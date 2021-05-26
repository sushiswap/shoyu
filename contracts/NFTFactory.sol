// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ProxyFactory.sol";
import "./NFT721.sol";

contract NFTFactory is ProxyFactory, Ownable {
    event CreateNFT721(string name, string symbol, address indexed owner);

    address public immutable target721;

    address public feeTo;
    uint8 public fee; // out of 1000
    mapping(address => bool) isStrategyWhitelisted;

    constructor(address _feeTo, uint8 _fee) {
        NFT721 nft721 = new NFT721();
        nft721.initialize("", "", address(0));
        target721 = address(nft721);

        setFeeTo(_feeTo);
        setFee(_fee);
    }

    function setFeeTo(address _feeTo) public onlyOwner {
        require(_feeTo != address(0), "SHOYU: INVALID_FEE_TO");
        feeTo = _feeTo;
    }

    function setFee(uint8 _fee) public onlyOwner {
        require(fee <= 100, "SHOYU: INVALID_FEE");
        fee = _fee;
    }

    function setStrategyWhitelisted(address sale, bool whitelisted) external onlyOwner {
        require(sale != address(0), "SHOYU: INVALID_SALE");
        isStrategyWhitelisted[sale] = whitelisted;
    }

    function createNFT721(string memory name, string memory symbol) public returns (address proxy) {
        bytes memory initData = abi.encodeWithSignature("initialize(string,string,address)", name, symbol, msg.sender);
        proxy = _createProxy(target721, initData);

        emit CreateNFT721(name, symbol, msg.sender);
    }

    function isNFT721(address query) public view returns (bool result) {
        return _isProxy(target721, query);
    }
}
