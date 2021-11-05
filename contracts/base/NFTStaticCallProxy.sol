// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "../interfaces/INFTStaticCallProxy.sol";
import "./OwnableInitializable.sol";

contract NFTStaticCallProxy is OwnableInitializable, INFTStaticCallProxy {
    address public override target;

    function setTarget(address _target) external override onlyOwner {
        target = _target;

        emit SetTarget(_target);
    }

    fallback() external payable {
        address _target = target;
        if (_target != address(0)) {
            assembly {
                let ptr := mload(0x40)
                let callsize := calldatasize()
                calldatacopy(ptr, 0, callsize)
                let result := staticcall(gas(), _target, ptr, callsize, 0, 0)
                let returnsize := returndatasize()
                returndatacopy(ptr, 0, returnsize)

                switch result
                    case 0 {
                        revert(ptr, returnsize)
                    }
                    default {
                        return(ptr, returnsize)
                    }
            }
        }
    }

    receive() external payable {
        // Empty
    }
}
