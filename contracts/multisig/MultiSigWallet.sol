// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;


/// @title Multisignature wallet - Allows multiple parties to agree on transactions before execution.
/// @author Stefan George - <stefan.george@consensys.net>
/// Modification:
///     - Only save the hash of transaction (target, value, calldata) instead of saving the whole transaction
///     - When approving, it won't automatically execute the transaction
contract MultiSigWallet {

    struct Transaction {
        bytes32[] actionHashes;
        uint64 blockNumber;
        bool executed;
    }

    string public constant VERSION = "1.0.0";
    uint256 constant public MAX_OWNER_COUNT = 50;

    mapping (uint256 => mapping (address => bool)) public confirmations;
    mapping (address => bool) public isOwner;
    address[] public owners;
    uint256 public required;
    uint256 public transactionCount;

    mapping (uint256 => Transaction) internal transactions;

    event Confirmation(address indexed sender, uint256 indexed transactionId);
    event Revocation(address indexed sender, uint256 indexed transactionId);
    event Submission(
        uint256 indexed transactionId,
        bytes32[] actionHashes,
        address[] targets,
        uint256[] values,
        bytes[] callDatas
    );
    event Execution(
        uint256 indexed transactionId,
        address indexed target,
        uint256 indexed value,
        bytes callData,
        bytes result
    );
    event Deposit(address indexed sender, uint256 value);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint256 required);

    modifier onlyWallet() {
        require(msg.sender == address(this), "only this address");
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        require(!isOwner[owner], "not an owner");
        _;
    }

    modifier ownerExists(address owner) {
        require(isOwner[owner], "only an owner");
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        require(transactionId < transactionCount, "transaction does not exist");
        _;
    }

    modifier confirmed(uint256 transactionId, address owner) {
        require(confirmations[transactionId][owner], "only confirmed");
        _;
    }

    modifier notConfirmed(uint256 transactionId, address owner) {
        require(!confirmations[transactionId][owner], "only not confirmed");
        _;
    }

    modifier notExecuted(uint256 transactionId) {
        require(!transactions[transactionId].executed, "only not executed");
        _;
    }

    modifier notNull(address _address) {
        require(_address != address(0), "invalid address");
        _;
    }

    modifier validRequirement(uint256 ownerCount, uint256 _required) {
        require(ownerCount <= MAX_OWNER_COUNT
            && _required <= ownerCount
            && _required != 0
            && ownerCount != 0, "invalid _required or ownerCount");
        _;
    }

    /// @dev Contract constructor sets initial owners and required number of confirmations.
    /// @param _owners List of initial owners.
    /// @param _required Number of required confirmations.
    constructor(address[] memory _owners, uint256 _required)
        validRequirement(_owners.length, _required)
    {
        for (uint256 i = 0; i < _owners.length; i++) {
            require(!isOwner[_owners[i]] && _owners[i] != address(0), "invalid owner");
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        required = _required;
    }

    receive() external payable {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value);
        }
    }

    /// @dev Allows to add a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of new owner.
    function addOwner(address owner)
        external
        onlyWallet
        ownerDoesNotExist(owner)
        notNull(owner)
        validRequirement(owners.length + 1, required)
    {
        isOwner[owner] = true;
        owners.push(owner);
        emit OwnerAddition(owner);
    }

    /// @dev Allows to remove an owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner.
    function removeOwner(address owner)
        external
        onlyWallet
        ownerExists(owner)
    {
        isOwner[owner] = false;
        for (uint256 i = 0; i < owners.length - 1; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        }
        owners.pop();
        if (required > owners.length) changeRequirement(owners.length);
        emit OwnerRemoval(owner);
    }

    /// @dev Allows to replace an owner with a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner to be replaced.
    /// @param newOwner Address of new owner.
    function replaceOwner(address owner, address newOwner)
        external
        onlyWallet
        ownerExists(owner)
        ownerDoesNotExist(newOwner)
    {
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = newOwner;
                break;
            }
        }
        isOwner[owner] = false;
        isOwner[newOwner] = true;
        emit OwnerRemoval(owner);
        emit OwnerAddition(newOwner);
    }

    /// @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
    /// @param _required Number of required confirmations.
    function changeRequirement(uint256 _required)
        public
        onlyWallet
        validRequirement(owners.length, _required)
    {
        required = _required;
        emit RequirementChange(_required);
    }

    /// @dev Allows an owner to submit and confirm a transaction.
    /// @param targets List of targets for each transaction
    /// @param values List of values for each transaction
    /// @param callDatas List of calldata for each transaction
    /// @return transactionId Returns transaction ID.
    function submitTransaction(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata callDatas
    )
        external
        ownerExists(msg.sender)
        returns (uint256 transactionId)
    {
        transactionId = _addTransaction(targets, values, callDatas);

        // not calling confirmTransactionWithData to avoid redundant checks
        confirmations[transactionId][msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);

        if (required == 1) {
            // only require 1 confirmation
            _executeTransaction(transactionId, targets, values, callDatas);
        }
    }

    /// @dev Allows an owner to confirm a transaction.
    ///     Confirm a transaction with data to execute, should only call this function
    ///     if the owner also wants to execute the transaction
    ///     Note: it only validates the execution data if it has enough confirmations
    /// @param transactionId Transaction ID.
    /// @param targets List of targets for each transaction
    /// @param values List of values for each transaction
    /// @param callDatas List of calldata for each transaction
    function confirmTransactionWithData(
        uint256 transactionId,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata callDatas
    )
        public
        ownerExists(msg.sender)
        transactionExists(transactionId)
        notConfirmed(transactionId, msg.sender)
    {
        confirmations[transactionId][msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);
        if (isConfirmed(transactionId) && !transactions[transactionId].executed) {
            _executeTransaction(transactionId, targets, values, callDatas);
        }
    }

    /// @dev Allows an owner to confirm a transaction.
    /// @param transactionId Transaction ID.
    function confirmTransaction(uint256 transactionId)
        external
        ownerExists(msg.sender)
        transactionExists(transactionId)
        notConfirmed(transactionId, msg.sender)
    {
        confirmations[transactionId][msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);
    }

    /// @dev Allows an owner to revoke a confirmation for a transaction.
    /// @param transactionId Transaction ID.
    function revokeConfirmation(uint256 transactionId)
        external
        ownerExists(msg.sender)
        confirmed(transactionId, msg.sender)
        notExecuted(transactionId)
    {
        confirmations[transactionId][msg.sender] = false;
        emit Revocation(msg.sender, transactionId);
    }

    /// @dev Allows an owner to execute a confirmed transaction.
    /// @param transactionId Transaction ID.
    /// @param targets List of targets for each transaction
    /// @param values List of values for each transaction
    /// @param callDatas List of calldata for each transaction
    function executeTransaction(
        uint256 transactionId,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata callDatas
    )
        public
        ownerExists(msg.sender)
        confirmed(transactionId, msg.sender)
        notExecuted(transactionId)
    {
        require(isConfirmed(transactionId), "not enough confirmations");
        _executeTransaction(transactionId, targets, values, callDatas);
    }

    /// @dev Returns the confirmation status of a transaction.
    /// @param transactionId Transaction ID.
    /// @return Confirmation status.
    function isConfirmed(uint256 transactionId)
        public
        view
        returns (bool)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < owners.length; i++) {
            if (confirmations[transactionId][owners[i]]) count += 1;
            if (count == required) return true;
        }
        return false;
    }

    /*
     * Web3 call functions
     */
    /// @dev Returns number of confirmations of a transaction.
    /// @param transactionId Transaction ID.
    /// @return count Number of confirmations.
    function getConfirmationCount(uint256 transactionId)
        external
        view
        returns (uint256 count)
    {
        for (uint256 i = 0; i < owners.length; i++) {
            if (confirmations[transactionId][owners[i]]) count += 1;
        }
    }

    /// @dev Returns total number of transactions, also number of pending/executed transactions
    /// @return totalTransactions total number of transactions
    /// @return pendingTransactions total number of pending transactions
    /// @return executedTransactions total number of executed transactions
    function getTransactionCount()
        external
        view
        returns (
            uint256 totalTransactions,
            uint256 pendingTransactions,
            uint256 executedTransactions
        )
    {
        totalTransactions = transactionCount;
        for (uint256 i = 0; i < transactionCount; i++) {
            if (transactions[i].executed) {
                executedTransactions += 1;
            } else {
                pendingTransactions += 1;
            }
        }
    }

    /// @dev Returns list of owners.
    /// @return List of owner addresses.
    function getOwners()
        external
        view
        returns (address[] memory)
    {
        return owners;
    }

    /// @dev Returns array with owner addresses, which confirmed transaction.
    /// @param transactionId Transaction ID.
    /// @return _confirmations Returns array of owner addresses.
    function getConfirmations(uint256 transactionId)
        external
        view
        returns (address[] memory _confirmations)
    {
        address[] memory confirmationsTemp = new address[](owners.length);
        uint256 count = 0;
        for (uint256 i = 0; i < owners.length; i++) {
            if (confirmations[transactionId][owners[i]]) {
                confirmationsTemp[count] = owners[i];
                count += 1;
            }
        }
        _confirmations = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            _confirmations[i] = confirmationsTemp[i];
        }
    }

    function getTransaction(uint256 i) external view returns (Transaction memory) {
        return transactions[i];
    }

    /*
     * Internal functions
     */
    /// @dev Adds a new transaction to the transaction mapping with list of executions
    /// @param targets List of targets for each transaction
    /// @param values List of values for each transaction
    /// @param callDatas List of calldata for each transaction
    /// @return transactionId Returns transaction ID.
    function _addTransaction(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory callDatas
    )
        internal
        returns (uint256 transactionId)
    {
        require(
            targets.length > 0 &&
            targets.length == values.length &&
            targets.length == callDatas.length,
            "invalid lengths"
        );
        transactionId = transactionCount;
        transactions[transactionId].executed = false;
        transactions[transactionId].blockNumber = uint64(block.number);
        for (uint256 i = 0; i < targets.length; i++) {
            require(targets[i] != address(0), "invalid target address");
            bytes32 actionHash = keccak256(
                abi.encode(targets[i], values[i], callDatas[i], transactionId)
            );
            transactions[transactionId].actionHashes.push(actionHash);
        }
        transactionCount += 1;
        emit Submission(
            transactionId,
            transactions[transactionId].actionHashes,
            targets,
            values,
            callDatas
        );
    }

    /// @dev Execute a new transaction with list of executions
    /// @param transactionId Id of the transaction
    /// @param targets List of targets for each transaction
    /// @param values List of values for each transaction
    /// @param callDatas List of calldata for each transaction
    function _executeTransaction(
        uint256 transactionId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory callDatas
    )
        internal
    {
        require(
            targets.length == values.length &&
            targets.length == callDatas.length,
            "invalid lengths"
        );
        Transaction storage txn = transactions[transactionId];
        require(targets.length == txn.actionHashes.length, "invalid lengths");
        bytes32 actionHash;
        bool success;
        bytes memory result;
        for (uint256 i = 0; i < targets.length; i++) {
            actionHash = keccak256(
                abi.encode(targets[i], values[i], callDatas[i], transactionId)
            );
            require(actionHash == txn.actionHashes[i], "invalid action");
            (success, result) = targets[i].call{value: values[i]}(callDatas[i]);
            if (!success) {
                // look for revert message
                if (result.length > 0) {
                    // solhint-disable-next-line no-inline-assembly
                    assembly {
                        let returndata_size := mload(result)
                        revert(add(32, result), returndata_size)
                    }
                } else {
                    revert("transaction failure");
                }
            }
            emit Execution(transactionId, targets[i], values[i], callDatas[i], result);
        }
        txn.executed = true;
    }
}
