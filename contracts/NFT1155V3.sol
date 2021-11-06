// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./NFT1155V2.sol";
import "./base/NFT1155ContractURIdentifiable.sol";
import "./base/NFTStaticCallProxy.sol";

contract NFT1155V3 is NFT1155V2, NFT1155ContractURIdentifiable, NFTStaticCallProxy {
    function contractURI() external view override returns (string memory) {
        if (bytes(_contractURI).length > 0) {
            return _contractURI;
        } else {
            string memory baseURI = _baseURI;
            if (bytes(baseURI).length == 0) {
                baseURI = ITokenFactory(_factory).baseURI1155();
            }
            return string(abi.encodePacked(baseURI, Strings.toHexString(uint160(address(this)), 20), ".json"));
        }
    }
}
