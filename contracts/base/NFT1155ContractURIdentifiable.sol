// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/INFTContractURIdentifiable.sol";
import "./OwnableInitializable.sol";

abstract contract NFT1155ContractURIdentifiable is OwnableInitializable, INFTContractURIdentifiable {
    string internal _contractURI;

    function contractURI() external view virtual override returns (string memory);

    function setContractURI(string memory uri) external override onlyOwner {
        _contractURI = uri;

        emit SetContractURI(uri);
    }
}
