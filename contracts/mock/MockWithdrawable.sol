// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../Withdrawable.sol";


contract MockWithdrawable is Withdrawable {
    constructor() Withdrawable(msg.sender) {}

    receive() external payable {}
}
