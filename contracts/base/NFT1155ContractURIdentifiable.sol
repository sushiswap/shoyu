// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/utils/Strings.sol";

import "../interfaces/INFTContractURIdentifiable.sol";
import "../interfaces/ITokenFactory.sol";
import "./OwnableInitializable.sol";

abstract contract NFT1155ContractURIdentifiable is OwnableInitializable, INFTContractURIdentifiable {
    string internal _contractURI;

    function factory() public view virtual returns (address);

    function contractURI() external view override returns (string memory) {
        if (bytes(_contractURI).length > 0) {
            return _contractURI;
        } else {
            string memory baseURI = ITokenFactory(factory()).baseURI1155();
            string memory addy = Strings.toHexString(uint160(address(this)), 20);
            return string(abi.encodePacked(baseURI, addy, ".json"));
        }
    }

    function setContractURI(string memory uri) external override onlyOwner {
        _contractURI = uri;

        emit SetContractURI(uri);
    }
}
