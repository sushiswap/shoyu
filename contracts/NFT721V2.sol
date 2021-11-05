// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./NFT721V1.sol";
import "./base/NFTStaticCallProxy.sol";

contract NF721V2 is NFT721V1, NFTStaticCallProxy {
    function setTarget(address _target) public override onlyOwner {
        super.setTarget(_target);
    }
}
