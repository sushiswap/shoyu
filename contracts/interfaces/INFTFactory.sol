// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFTFactory {
    function feeTo() external view returns (address);

    function fee() external view returns (uint8);

    function isStrategyWhitelisted(address strategy) external view returns (bool);
}
