// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IPaymentSplitter {
    event PayeeAdded(address account, uint256 shares);
    event PaymentReleased(address token, address to, uint256 amount);

    function initialize(
        string calldata _title,
        address[] calldata _payees,
        uint256[] calldata _shares
    ) external;

    function title() external view returns (string memory);

    function totalShares() external view returns (uint256);

    function totalReleased(address account) external view returns (uint256);

    function shares(address account) external view returns (uint256);

    function released(address token, address account) external view returns (uint256);

    function payees(uint256 index) external view returns (address);

    function release(address token, address account) external;
}
