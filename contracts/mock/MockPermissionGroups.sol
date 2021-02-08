// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../PermissionAdmin.sol";
import "../PermissionAlerters.sol";
import "../PermissionOperators.sol";


contract MockPermissionGroups is PermissionAdmin, PermissionAlerters, PermissionOperators {
    uint256 public rate;
    bool public adminFlag = false;
    bool public tradeActive = true;

    constructor(address _admin) PermissionAdmin(_admin) {}

    function adminOnly() public onlyAdmin {
        adminFlag = true;
    }

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
