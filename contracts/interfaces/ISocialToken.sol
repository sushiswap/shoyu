// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IDividendPayingERC20.sol";
import "./IBaseExchange.sol";
import "./IOwnable.sol";

interface ISocialToken is IDividendPayingERC20, IBaseExchange, IOwnable {
    event Burn(uint256 amount, uint256 indexed label, bytes32 data);

    function initialize(
        address owner,
        string memory name,
        string memory symbol,
        address dividendToken,
        uint256 initialSupply
    ) external;

    function mint(address account, uint256 value) external;

    function burn(
        uint256 value,
        uint256 id,
        bytes32 data
    ) external;
}
