// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "./PermissionAdmin.sol";


abstract contract PermissionAlerters is PermissionAdmin {
    uint256 private constant MAX_GROUP_SIZE = 50;

    mapping(address => bool) internal alerters;
    address[] internal alertersGroup;

    event AlerterAdded(address newAlerter, bool isAdd);

    modifier onlyAlerter() {
        require(alerters[msg.sender], "only alerter");
        _;
    }

    function getAlerters() external view returns (address[] memory) {
        return alertersGroup;
    }

    function addAlerter(address newAlerter) public onlyAdmin {
        require(!alerters[newAlerter], "alerter exists"); // prevent duplicates.
        require(alertersGroup.length < MAX_GROUP_SIZE, "max alerters");

        emit AlerterAdded(newAlerter, true);
        alerters[newAlerter] = true;
        alertersGroup.push(newAlerter);
    }

    function removeAlerter(address alerter) public onlyAdmin {
        require(alerters[alerter], "not alerter");
        alerters[alerter] = false;

        for (uint256 i = 0; i < alertersGroup.length; ++i) {
            if (alertersGroup[i] == alerter) {
                alertersGroup[i] = alertersGroup[alertersGroup.length - 1];
                alertersGroup.pop();
                emit AlerterAdded(alerter, false);
                break;
            }
        }
    }
}
