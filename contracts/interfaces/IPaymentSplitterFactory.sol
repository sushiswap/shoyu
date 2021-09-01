// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IPaymentSplitterFactory {
    event DeployPaymentSplitter(
        address indexed owner,
        string title,
        address[] payees,
        uint256[] shares,
        address splitter
    );

    function deployPaymentSplitter(
        address owner,
        string calldata title,
        address[] calldata payees,
        uint256[] calldata shares
    ) external returns (address splitter);

    function isPaymentSplitter(address query) external view returns (bool result);
}
