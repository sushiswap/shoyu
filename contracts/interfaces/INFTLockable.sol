// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

interface INFTLockable {
    event SetLocked(bool locked);

    function locked() external view returns (bool);

    function setLocked(bool _locked) external;
}
