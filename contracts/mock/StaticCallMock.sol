// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

contract StaticCallMock {
    function globalV() external view returns(address) {
        return address(this);
    }

    function pureTest11(uint256 id) external pure returns(uint256) {
        return id;
    }

    function pureTest23(uint256 id, string calldata str) external pure returns(uint256, address, string calldata) {
        return (id, address(0x0000000000000000000000000000000000000001), str);
    }

    mapping(uint256 => uint256) public x;
    mapping(uint256 => string) public y;

    function setX(uint256 id, uint256 value) external {
        x[id] = value;
    }

    function setY(uint256 id, string calldata str) external {
        y[id] = str;
    }

    function viewTest11(uint256 id) external view returns(uint256) {
        return x[id];
    }

    function viewTest13(uint256 id) external view returns(uint256, address, string memory) {
        return (x[id], address(this), y[id]);
    }
}
