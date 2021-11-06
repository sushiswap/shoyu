// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./NFT721V1.sol";
import "./base/NFT721ContractURIdentifiable.sol";
import "./base/NFTStaticCallProxy.sol";

contract NFT721V2 is NFT721V1, NFT721ContractURIdentifiable, NFTStaticCallProxy {
    function factory() public view override(NFT721V0, NFT721ContractURIdentifiable) returns (address) {
        return NFT721V0.factory();
    }
}
