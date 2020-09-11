pragma solidity 0.6.6;

import "../PermissionGroups.sol";


contract MockPermissionGroups is PermissionGroups {
    uint256 public rate;
    bool public tradeActive = true;

    constructor() public PermissionGroups(msg.sender) {}

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
