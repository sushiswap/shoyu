// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "./IBaseExchange.sol";
import "./IDividendPayingERC20.sol";

interface ISocialToken is IBaseExchange, IDividendPayingERC20 {
    event Log(uint256 indexed id, bytes32 data);

    function initialize(
        string memory _name,
        string memory _symbol,
        address _dividendToken,
        address _owner
    ) external;

    function mint(address account, uint256 value) external;

    function burn(
        uint256 value,
        uint256 id,
        bytes32 data
    ) external;
}
