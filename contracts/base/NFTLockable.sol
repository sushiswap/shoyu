// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./OwnableInitializable.sol";
import "../interfaces/INFTLockable.sol";

contract NFTLockable is OwnableInitializable, INFTLockable {
    bool internal _wasLocked;
    bool public override locked;

    modifier ensureUnlocked(address from) {
        require(msg.sender == owner() || from == owner() || !locked, "SHOYU: LOCKED");
        _;
    }

    function setLocked(bool _locked) external override onlyOwner {
        if (_locked) {
            require(!_wasLocked, "SHOYU: FORBIDDEN");
            _wasLocked = true;
        }
        locked = _locked;
        emit SetLocked(_locked);
    }
}
