// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./IBEP20.sol";
import "./PermissionAdmin.sol";


abstract contract Withdrawable is PermissionAdmin {
    using SafeERC20 for IBEP20;

    event TokenWithdraw(IBEP20 token, uint256 amount, address sendTo);
    event BnbWithdraw(uint256 amount, address sendTo);

    constructor(address _admin) PermissionAdmin(_admin) {}

    /**
     * @dev Withdraw all IBEP20 compatible tokens
     * @param token IBEP20 The address of the token contract
     */
    function withdrawToken(
        IBEP20 token,
        uint256 amount,
        address sendTo
    ) external onlyAdmin {
        token.safeTransfer(sendTo, amount);
        emit TokenWithdraw(token, amount, sendTo);
    }

    /**
     * @dev Withdraw BNBs
     */
    function withdrawBnb(uint256 amount, address payable sendTo) external onlyAdmin {
        (bool success, ) = sendTo.call{value: amount}("");
        require(success, "withdraw failed");
        emit BnbWithdraw(amount, sendTo);
    }
}
