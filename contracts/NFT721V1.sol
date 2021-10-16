// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./NFT721V0.sol";
import "./base/NFTLockable.sol";

contract NFT721V1 is NFT721V0, NFTLockable {
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override ensureUnlocked(from) {
        super._transfer(from, to, tokenId);
    }
}
