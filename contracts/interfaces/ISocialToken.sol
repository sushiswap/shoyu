// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IDividendPayingERC20.sol";
import "./IOwnable.sol";

interface ISocialToken is IDividendPayingERC20, IOwnable {
    event Burn(uint256 amount, uint256 indexed label, bytes32 data);

    function initialize(
        address owner,
        string memory name,
        string memory symbol,
        address dividendToken,
        uint256 initialSupply
    ) external;

    function PERMIT_TYPEHASH() external view returns (bytes32);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function factory() external view returns (address);

    function nonces(address owner) external view returns (uint256);

    function mint(address account, uint256 value) external;

    function burn(
        uint256 value,
        uint256 id,
        bytes32 data
    ) external;

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
