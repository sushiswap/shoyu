// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

// Reference: https://github.com/optionality/clone-factory/blob/master/contracts/CloneFactory.sol
contract SocialTokenFactory {
    event SocialTokenCreated(address socialToken);

    address immutable target;

    constructor(address _target) {
        target = _target;
    }

    function createSocialToken(
        string memory _name,
        string memory _symbol,
        address _dividendToken
    ) public returns (address socialToken) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            socialToken := create(0, clone, 0x37)
        }

        emit SocialTokenCreated(socialToken);

        (bool success, ) =
            socialToken.call(
                abi.encodeWithSignature("initialize(string,string,address)", _name, _symbol, _dividendToken)
            );
        require(success);
    }

    function isSocialToken(address socialToken) public view returns (bool result) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x363d3d373d3d3d363d7300000000000000000000000000000000000000000000)
            mstore(add(clone, 0xa), targetBytes)
            mstore(add(clone, 0x1e), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)

            let other := add(clone, 0x40)
            extcodecopy(socialToken, other, 0, 0x2d)
            result := and(eq(mload(clone), mload(other)), eq(mload(add(clone, 0xd)), mload(add(other, 0xd))))
        }
    }
}
