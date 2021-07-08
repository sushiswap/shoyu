// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IDividendPayingERC20.sol";

interface ISocialToken is IDividendPayingERC20 {
    function MINTER_ROLE() external view returns (bytes32);

    function initialize(
        string memory _name,
        string memory _symbol,
        address _dividendToken,
        address _owner
    ) external;

    function mint(address account, uint256 value) external;

    function burn(uint256 value, bytes32 data) external;
}
