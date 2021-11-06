// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./NFT721V1.sol";
import "./base/NFT721ContractURIdentifiable.sol";
import "./base/NFTStaticCallProxy.sol";

contract NFT721V2 is NFT721V1, NFT721ContractURIdentifiable, NFTStaticCallProxy {
    function contractURI() external view override returns (string memory) {
        if (bytes(_contractURI).length > 0) {
            return _contractURI;
        } else {
            string memory baseURI = __baseURI;
            if (bytes(baseURI).length == 0) {
                baseURI = ITokenFactory(_factory).baseURI721();
            }
            return string(abi.encodePacked(baseURI, Strings.toHexString(uint160(address(this)), 20), ".json"));
        }
    }
}
