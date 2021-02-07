// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../PermissionGroups.sol";


contract MockPermissionGroups is PermissionGroups {
    uint256 public rate;
    bool public tradeActive = true;

    constructor(address _admin) PermissionGroups(_admin) {}

    function activateTrade() public onlyOperator {
        tradeActive = true;
    }

    function setRate(uint256 newRate) public onlyOperator {
        rate = newRate;
    }

    function stopTrade() public onlyAlerter {
        tradeActive = false;
    }
}
