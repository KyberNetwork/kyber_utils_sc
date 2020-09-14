pragma solidity 0.6.6;

import "../Withdrawable.sol";


contract MockWithdrawable is Withdrawable {
    constructor() public Withdrawable(msg.sender) {}

    receive() external payable {}
}
