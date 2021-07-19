// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Withdrawable.sol";


contract MockWithdrawable is Withdrawable {
    constructor() Withdrawable(msg.sender) {}

    receive() external payable {}
}
