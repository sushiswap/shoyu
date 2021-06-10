// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFTFactory {
    function feeTo() external view returns (address);

    function fee() external view returns (uint8);

    function isStrategyWhitelisted721(address strategy) external view returns (bool);

    function isStrategyWhitelisted1155(address strategy) external view returns (bool);

    function setFeeTo(address _feeTo) external;

    function setFee(uint8 _fee) external;

    function setStrategyWhitelisted721(address sale, bool whitelisted) external;

    function setStrategyWhitelisted1155(address sale, bool whitelisted) external;

    function createNFT721(string memory name, string memory symbol) external returns (address proxy);

    function isNFT721(address query) external view returns (bool result);

    function createNFT1155() external returns (address proxy);

    function isNFT1155(address query) external view returns (bool result);
}
