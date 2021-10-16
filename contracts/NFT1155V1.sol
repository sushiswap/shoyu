// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./NFT1155V0.sol";
import "./base/NFTLockable.sol";

contract NFT1155V1 is NFT1155V0, NFTLockable {
    function _transfer(
        address from,
        address to,
        uint256 id,
        uint256 amount
    ) internal override ensureUnlocked(from) {
        super._transfer(from, to, id, amount);
    }
}
