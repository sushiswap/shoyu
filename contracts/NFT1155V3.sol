// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./NFT1155V2.sol";
import "./base/NFT1155ContractURIdentifiable.sol";
import "./base/NFTStaticCallProxy.sol";

contract NFT1155V3 is NFT1155V2, NFT1155ContractURIdentifiable, NFTStaticCallProxy {
    function factory() public view override(NFT1155V0, NFT1155ContractURIdentifiable) returns (address) {
        return NFT1155V0.factory();
    }
}
