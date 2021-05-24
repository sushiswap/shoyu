// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTFactory is Ownable {
    address public feeTo;
    uint8 public fee; // out of 1000
    mapping(address => bool) isStrategyWhitelisted;

    constructor(address _feeTo, uint8 _fee) {
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
}
