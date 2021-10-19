// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT1155Metadata.sol";
import "./NFT1155V1.sol";

contract NFT1155V2 is NFT1155V1, INFT1155Metadata {
    string public override name;

    function setName(string calldata _name) external override onlyOwner {
        require(bytes(name).length == 0, "SHOYU: NAME_ALREADY_SET");

        name = _name;

        emit SetName(_name);
    }
}
