pragma solidity 0.6.6;

import "../WithdrawableNoModifiers.sol";


contract MockWithdrawableNoModifiers is WithdrawableNoModifiers {
    constructor() public WithdrawableNoModifiers(msg.sender) {}

    receive() external payable {}
}
