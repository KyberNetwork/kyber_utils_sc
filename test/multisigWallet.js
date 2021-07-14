let MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
let Token = artifacts.require('Token.sol');
let Helper = require('./helper.js');

const BN = web3.utils.BN;
const {zeroAddress, ethAddress} = require('./helper.js');
const {expectEvent, expectRevert} = require('@openzeppelin/test-helpers');

let multisigWallet;

let owners;
let user;
let required;

contract('MultisigWallet', function (accounts) {
  before('init global accounts', async () => {
    // global inits in first test
    user = accounts[0];
    owners = [accounts[2], accounts[4], accounts[5]];
    required = 2;
  });

  beforeEach('deploy new multisig', async () => {
    multisigWallet = await MultiSigWallet.new(owners, required);
  });

  const verifyOwnerList = async (contract, listOwners) => {
    for(let i = 0; i < listOwners.length; i++) {
      Helper.assertEqual(true, await contract.isOwner(listOwners[i]));
      Helper.assertEqual(listOwners[i], await contract.owners(i));
    }
    Helper.assertEqualArray(listOwners, await contract.getOwners());
  }

  const verifyConfirmations = async (contract, txId, listConfirms) => {
    Helper.assertEqualArray(listConfirms, await contract.getConfirmations(txId));
    Helper.assertEqual(listConfirms.length, await contract.getConfirmationCount(txId));
    for(let i = 0; i < listConfirms.length; i++) {
      Helper.assertEqual(true, await contract.confirmations(txId, listConfirms[i]));
    }
  }

  describe(`#constructor`, async () => {
    it('revert - invalid data', async () => {
      // duplicated owner
      await expectRevert(
        MultiSigWallet.new([accounts[0], accounts[0]], 1),
        'invalid owner' 
      );
      await expectRevert(
        MultiSigWallet.new([accounts[0]], 0),
        'invalid _required or ownerCount'
      );
      await expectRevert(
        MultiSigWallet.new([], 1),
        'invalid _required or ownerCount'
      );
      await expectRevert(
        MultiSigWallet.new([accounts[1]], 2),
        'invalid _required or ownerCount'
      );
      let ownerLists = [];
      let maxCount = 50;
      for(let i = 0; i <= maxCount; i++) ownerLists.push(accounts[0]);
      // too many owner
      await expectRevert(
        MultiSigWallet.new(ownerLists, 2),
        'invalid _required or ownerCount'
      );
    });

    it('correct data initialized', async () => {
      let _listOwners = [accounts[1], accounts[4], accounts[2]];
      let _required = 2;
      let contract = await MultiSigWallet.new(_listOwners, _required);
      Helper.assertEqual(_required, await contract.required());
      Helper.assertEqual(0, await multisigWallet.transactionCount());
      await verifyOwnerList(contract, _listOwners);
    });
  });

  describe(`#submit transaction`, async () => {
    it('revert - sender is now an owner', async () => {
      await expectRevert(
        multisigWallet.submitTransaction(
          [accounts[0]], [0], ['0x'], { from: accounts[8] }
        ),
        'only an owner'
      );
    });

    it('revert - invalid data', async () => {
      // invalid data length
      await expectRevert(
        multisigWallet.submitTransaction([], [], [], { from: owners[0] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.submitTransaction(
          [accounts[0]], [], [], { from: owners[0] }
        ),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.submitTransaction(
          [accounts[0]], [0], [], { from: owners[0] }
        ),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.submitTransaction(
          [zeroAddress], [0], ['0x'], { from: owners[0] }
        ),
        'invalid target address'
      );
    });

    it('record correct data with no execution', async () => {
      let txCountData = await multisigWallet.getTransactionCount();
      let targets = [accounts[0], accounts[2]];
      let values = [new BN(10), new BN(0)];
      let callDatas = ['0x1234', '0x0000'];
      let tx = await multisigWallet.submitTransaction(
        targets, values, callDatas, { from: owners[1] }
      );
      let txId = txCountData.totalTransactions;
      let hashes = getActionHashes(targets, values, callDatas, txId);
      for(let i = 0; i < tx.receipt.logs.length; i++) {
        if (tx.receipt.logs[i].event == 'Submission') {
          Helper.assertEqual(txId, tx.receipt.logs[i].args.transactionId);
          Helper.assertEqualArray(hashes, tx.receipt.logs[i].args.actionHashes);
          Helper.assertEqualArray(targets, tx.receipt.logs[i].args.targets);
          Helper.assertEqualArray(values, tx.receipt.logs[i].args.values);
          Helper.assertEqualArray(callDatas, tx.receipt.logs[i].args.callDatas);
        } else if (tx.receipt.logs[i].event == 'Confirmation') {
          Helper.assertEqual(owners[1], tx.receipt.logs[i].args.sender);
          Helper.assertEqualArray(txId, tx.receipt.logs[i].args.transactionId);
        }
      }
      let txData = await multisigWallet.getTransaction(txId);
      Helper.assertEqual(false, txData.executed);
      Helper.assertEqualArray(hashes, txData.actionHashes);
      await verifyConfirmations(multisigWallet, txId, [owners[1]]);

      Helper.assertEqual(txCountData.totalTransactions + 1, await multisigWallet.transactionCount());
      let newTxCountData = await multisigWallet.getTransactionCount();
      Helper.assertEqual(txCountData.totalTransactions + 1, newTxCountData.totalTransactions);
      Helper.assertEqual(txCountData.executedTransactions, newTxCountData.executedTransactions);
      Helper.assertEqual(txCountData.pendingTransactions + 1, newTxCountData.pendingTransactions);
    });

    it('record correct data with execution', async () => {
      multisigWallet = await MultiSigWallet.new(owners, 1);
      let txCountData = await multisigWallet.getTransactionCount();
      let targets = [accounts[0], accounts[2]];
      let values = [new BN(0), new BN(0)];
      let callDatas = ['0x0123', '0x1234'];
      let tx = await multisigWallet.submitTransaction(
        targets, values, callDatas, { from: owners[1] }
      );
      let txId = txCountData.totalTransactions;
      let executionEventCount = 0;
      for(let i = 0; i < tx.receipt.logs.length; i++) {
        if (tx.receipt.logs[i].event == 'Execution') {
          Helper.assertEqual(txId, tx.receipt.logs[i].args.transactionId);
          Helper.assertEqual(targets[executionEventCount], tx.receipt.logs[i].args.target);
          Helper.assertEqual(values[executionEventCount], tx.receipt.logs[i].args.value);
          Helper.assertEqual(callDatas[executionEventCount], tx.receipt.logs[i].args.callData);
          executionEventCount++;
        }
      }
      Helper.assertEqual(targets.length, executionEventCount);
      let txData = await multisigWallet.getTransaction(txId);
      Helper.assertEqual(true, txData.executed);
      Helper.assertEqualArray(
        getActionHashes(targets, values, callDatas, txId),
        txData.actionHashes
      );
      await verifyConfirmations(multisigWallet, txId, [owners[1]]);

      Helper.assertEqual(txCountData.totalTransactions + 1, await multisigWallet.transactionCount());
      let newTxCountData = await multisigWallet.getTransactionCount();
      Helper.assertEqual(txCountData.totalTransactions + 1, newTxCountData.totalTransactions);
      Helper.assertEqual(txCountData.executedTransactions + 1, newTxCountData.executedTransactions);
      Helper.assertEqual(txCountData.pendingTransactions, newTxCountData.pendingTransactions);
    });
  });

  describe(`#confirm transaction`, async () => {
    it('revert - sender is not an owner', async () => {
      await expectRevert(
        multisigWallet.confirmTransaction(0, { from: accounts[6] }),
        'only an owner'
      );
    });

    it('revert - transaction does not exist', async () => {
      await expectRevert(
        multisigWallet.confirmTransaction(0, { from: owners[0] }),
        'transaction does not exist'
      );
    });

    it('revert - already confirmed', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await expectRevert(
        multisigWallet.confirmTransaction(0, { from: owners[0] }),
        'only not confirmed'
      );
    });

    it('record correct data', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      let listConfirms = [owners[0]];
      let tx = await multisigWallet.confirmTransaction(0, { from: owners[1] });
      expectEvent(tx, 'Confirmation', {
        sender: owners[1],
        transactionId: new BN(0)
      });
      listConfirms.push(owners[1]);
      await verifyConfirmations(multisigWallet, 0, listConfirms);
      // verify that tx has not been executed
      let txData = await multisigWallet.getTransaction(0);
      Helper.assertEqual(false, txData.executed);

      // manually call execute transaction
      await multisigWallet.executeTransaction(0, [accounts[0]], [0], ["0x"], { from: owners[0] });
      txData = await multisigWallet.getTransaction(0);
      Helper.assertEqual(true, txData.executed);
    });
  });

  describe(`#confirm transaction with data`, async () => {
    it('revert - sender is not an owner', async () => {
      await expectRevert(
        multisigWallet.confirmTransactionWithData(0, [], [], [], { from: accounts[6] }),
        'only an owner'
      );
    });

    it('revert - transaction does not exist', async () => {
      await expectRevert(
        multisigWallet.confirmTransactionWithData(0, [], [], [], { from: owners[0] }),
        'transaction does not exist'
      );
    });

    it('revert - already confirmed', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(0, [], [], [], { from: owners[0] }),
        'only not confirmed'
      );
    });

    it('revert - invalid execution data', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(0, [], [], [], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(0, [accounts[0]], [], [], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(0, [accounts[0]], [0], [], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(0, [], [0], ["0x"], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(
          0,
          [accounts[0], accounts[0]], [0, 0], ["0x", "0x"], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(
          0,
          [accounts[1]], [0], ["0x"], { from: owners[1] }),
        'invalid action'
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(
          0,
          [accounts[0]], [1], ["0x"], { from: owners[1] }),
        'invalid action'
      );
      await expectRevert(
        multisigWallet.confirmTransactionWithData(
          0,
          [accounts[0]], [0], ["0x0000"], { from: owners[1] }),
        'invalid action'
      );
    });

    it('record correct data - no execution', async () => {
      multisigWallet = await MultiSigWallet.new(owners, 3);
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      let listConfirms = [owners[0]];
      let tx = await multisigWallet.confirmTransactionWithData(0, [], [], [], { from: owners[1] });
      expectEvent(tx, 'Confirmation', {
        sender: owners[1],
        transactionId: new BN(0)
      });
      listConfirms.push(owners[1]);
      await verifyConfirmations(multisigWallet, 0, listConfirms);
      // verify that tx has not been executed
      let txData = await multisigWallet.getTransaction(0);
      Helper.assertEqual(false, txData.executed);
    });

    it('record correct data - with execution', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x0000"],
        { from: owners[0] }
      );
      let listConfirms = [owners[0]];
      let tx = await multisigWallet.confirmTransactionWithData(0, [accounts[0]], [0], ["0x0000"], { from: owners[1] });
      expectEvent(tx, 'Confirmation', {
        sender: owners[1],
        transactionId: new BN(0)
      });
      expectEvent(tx, 'Execution', {
        transactionId: new BN(0),
        target: accounts[0],
        value: new BN(0),
        callData: "0x0000"
      });
      listConfirms.push(owners[1]);
      await verifyConfirmations(multisigWallet, 0, listConfirms);
      // verify that tx has not been executed
      let txData = await multisigWallet.getTransaction(0);
      Helper.assertEqual(true, txData.executed);
    });
  });

  describe(`#revoke confirmation`, async () => {
    it('revert - sender is not an owner', async () => {
      await expectRevert(
        multisigWallet.revokeConfirmation(0, { from: accounts[6] }),
        'only an owner'
      );
    });

    it('revert - not confirmed yet', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await expectRevert(
        multisigWallet.revokeConfirmation(0, { from: owners[1] }),
        'only confirmed'
      );
    });

    it('revert - already executed', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await multisigWallet.confirmTransactionWithData(0, [accounts[0]], [0], ["0x"], { from: owners[1] });
      let txData = await multisigWallet.getTransaction(0);
      Helper.assertEqual(true, txData.executed);
      await expectRevert(
        multisigWallet.revokeConfirmation(0, { from: owners[0] }),
        'only not executed'
      );
    });

    it('record correct data', async () => {
      multisigWallet = await MultiSigWallet.new(owners, 3);
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await multisigWallet.confirmTransactionWithData(0, [], [], [], { from: owners[1] });
      await verifyConfirmations(multisigWallet, 0, [owners[0], owners[1]]);
      let tx = await multisigWallet.revokeConfirmation(0, { from: owners[0] });
      expectEvent(tx, 'Revocation', {
        sender: owners[0],
        transactionId: new BN(0)
      });
      await verifyConfirmations(multisigWallet, 0, [owners[1]]);
      tx = await multisigWallet.revokeConfirmation(0, { from: owners[1] });
      expectEvent(tx, 'Revocation', {
        sender: owners[1],
        transactionId: new BN(0)
      });
      await verifyConfirmations(multisigWallet, 0, []);
    });
  });

  describe(`#execute transaction`, async () => {
    it('revert - sender is not an owner', async () => {
      await expectRevert(
        multisigWallet.executeTransaction(0, [], [], [], { from: accounts[6] }),
        'only an owner'
      );
    });

    it('revert - not confirmed yet', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await expectRevert(
        multisigWallet.executeTransaction(0, [], [], [], { from: owners[1] }),
        'only confirmed'
      );
    });

    it('revert - already executed', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await multisigWallet.confirmTransactionWithData(0, [accounts[0]], [0], ["0x"], { from: owners[1] });
      await expectRevert(
        multisigWallet.executeTransaction(0, [], [], [], { from: owners[0] }),
        'only not executed'
      );
    });

    it('revert - no enough confirmations', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await expectRevert(
        multisigWallet.executeTransaction(0, [], [], [], { from: owners[0] }),
        'not enough confirmations'
      );
    });

    it('revert - invalid execution data', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x"],
        { from: owners[0] }
      );
      await multisigWallet.confirmTransaction(0, { from: owners[1] });
      await expectRevert(
        multisigWallet.executeTransaction(0, [], [], [], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.executeTransaction(0, [accounts[0]], [], [], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.executeTransaction(0, [accounts[0]], [0], [], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.executeTransaction(0, [], [0], ["0x"], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.executeTransaction(
          0,
          [accounts[0], accounts[0]], [0, 0], ["0x", "0x"], { from: owners[1] }),
        'invalid lengths'
      );
      await expectRevert(
        multisigWallet.executeTransaction(
          0,
          [accounts[1]], [0], ["0x"], { from: owners[1] }),
        'invalid action'
      );
      await expectRevert(
        multisigWallet.executeTransaction(
          0,
          [accounts[0]], [1], ["0x"], { from: owners[1] }),
        'invalid action'
      );
      await expectRevert(
        multisigWallet.executeTransaction(
          0,
          [accounts[0]], [0], ["0x0000"], { from: owners[1] }),
        'invalid action'
      );
    });

    it('record correct data', async () => {
      await multisigWallet.submitTransaction(
        [accounts[0]], [0], ["0x0000"],
        { from: owners[0] }
      );
      await multisigWallet.confirmTransaction(0, { from: owners[1] });
      let tx = await multisigWallet.executeTransaction(0, [accounts[0]], [0], ["0x0000"], { from: owners[0] });
      expectEvent(tx, 'Execution', {
        transactionId: new BN(0),
        target: accounts[0],
        value: new BN(0),
        callData: "0x0000"
      });
      let txData = await multisigWallet.getTransaction(0);
      Helper.assertEqual(true, txData.executed);
    });
  });

  describe(`#internal updates`, async () => {
    it(`add owner`, async () => {
      await expectRevert(
        multisigWallet.addOwner(accounts[2], { from: accounts[0] }),
        'only this address'
      );
      multisigWallet = await MultiSigWallet.new(owners, 1);
      let data = encodeFunctionAddOwner(owners[0]);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      data = encodeFunctionAddOwner(zeroAddress);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      data = encodeFunctionAddOwner(accounts[8]);
      let tx = await multisigWallet.submitTransaction(
        [multisigWallet.address], [0], [data], { from: owners[0] }
      );
      expectEvent(tx, 'OwnerAddition', {
        owner: accounts[8]
      });
      let listOwners = owners;
      listOwners.push(accounts[8]);
      await verifyOwnerList(multisigWallet, listOwners);
    });

    it(`remove owner`, async () => {
      await expectRevert(
        multisigWallet.removeOwner(accounts[2], { from: accounts[0] }),
        'only this address'
      );
      owners = [accounts[1], accounts[2], accounts[3]];
      multisigWallet = await MultiSigWallet.new(owners, 1);
      let data = encodeFunctionRemoveOwner(accounts[8]);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      // only 1 owner, try to remove
      multisigWallet = await MultiSigWallet.new([accounts[0]], 1);
      data = encodeFunctionRemoveOwner(accounts[0]);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: accounts[0] }
        ),
        'transaction failure'
      );
      multisigWallet = await MultiSigWallet.new(owners, 1);
      // check remove owner, not change requirement
      data = encodeFunctionRemoveOwner(owners[1]);
      let tx = await multisigWallet.submitTransaction(
        [multisigWallet.address], [0], [data], { from: owners[0] }
      );
      expectEvent(tx, 'OwnerRemoval', {
        owner: owners[1]
      });
      await verifyOwnerList(multisigWallet, [owners[0], owners[2]]);
      // remove owner, also change requirement
      multisigWallet = await MultiSigWallet.new(owners, 3);
      data = encodeFunctionRemoveOwner(owners[1]);
      await multisigWallet.submitTransaction(
        [multisigWallet.address], [0], [data], { from: owners[0] }
      );
      await multisigWallet.confirmTransaction(0, { from: owners[1] });
      tx = await multisigWallet.confirmTransactionWithData(0,
        [multisigWallet.address], [0], [data],
        { from: owners[2] }
      );
      expectEvent(tx, 'OwnerRemoval', {
        owner: owners[1]
      });
      expectEvent(tx, 'RequirementChange', {
        required: new BN(2)
      });
      await verifyOwnerList(multisigWallet, [owners[0], owners[2]]);
    });

    it(`replace owner`, async () => {
      await expectRevert(
        multisigWallet.replaceOwner(accounts[2], accounts[3], { from: accounts[0] }),
        'only this address'
      );
      multisigWallet = await MultiSigWallet.new(owners, 1);
      let data = encodeFunctionReplaceOwner(owners[0], owners[0]);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      data = encodeFunctionReplaceOwner(accounts[8], owners[0]);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      data = encodeFunctionReplaceOwner(owners[0], owners[1]);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      owners = [accounts[0], accounts[1]];
      multisigWallet = await MultiSigWallet.new(owners, 1);
      data = encodeFunctionReplaceOwner(owners[1], accounts[8]);
      let tx = await multisigWallet.submitTransaction(
        [multisigWallet.address], [0], [data], { from: owners[0] }
      );
      expectEvent(tx, 'OwnerRemoval', {
        owner: owners[1]
      });
      expectEvent(tx, 'OwnerAddition', {
        owner: accounts[8]
      })
      owners[1] = accounts[8];
      await verifyOwnerList(multisigWallet, owners);
    });

    it(`change requirement`, async () => {
      await expectRevert(
        multisigWallet.changeRequirement(1, { from: accounts[0] }),
        'only this address'
      );
      multisigWallet = await MultiSigWallet.new(owners, 1);
      // change requirement to be higher than number of owners
      let data = encodeFunctionChangeRequirement(owners.length + 1);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );
      // change requirement to 0
      data = encodeFunctionChangeRequirement(0);
      await expectRevert(
        multisigWallet.submitTransaction(
          [multisigWallet.address], [0], [data], { from: owners[0] }
        ),
        'transaction failure'
      );

      data = encodeFunctionChangeRequirement(1);
      let tx = await multisigWallet.submitTransaction(
        [multisigWallet.address], [0], [data], { from: owners[0] }
      );
      expectEvent(tx, 'RequirementChange', {
        required: new BN(1)
      });
      Helper.assertEqual(1, await multisigWallet.required());
    });
  });

  describe(`#withdraw tokens`, async () => {
    it('test withdraw tokens', async () => {
      multisigWallet = await MultiSigWallet.new(owners, 1);
      let tokens = [ethAddress];
      await Helper.sendEtherWithPromise(accounts[0], multisigWallet.address, new BN(100000));
      // for test coverage only
      await Helper.sendEtherWithPromise(accounts[0], multisigWallet.address, 0);
      for (let i = 0; i < 2; i++) {
        let token = await Token.new("T", "T", 10);
        await token.transfer(multisigWallet.address, new BN(1000000));
        tokens.push(token.address);
      }
      let receiver = accounts[6];
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] == ethAddress) {
          let balanceMultisig = await Helper.getBalancePromise(multisigWallet.address);
          let balanceReceiver = await Helper.getBalancePromise(receiver);
          let amount = new BN(1000);
          await multisigWallet.submitTransaction(
            [receiver], [amount], ["0x"], { from: owners[0] }
          );
          Helper.assertEqual(
            balanceMultisig.sub(amount), await Helper.getBalancePromise(multisigWallet.address)
          );
          Helper.assertEqual(
            balanceReceiver.add(amount), await Helper.getBalancePromise(receiver)
          );
        } else {
          let token = await Token.at(tokens[i]);
          let balanceMultisig = await token.balanceOf(multisigWallet.address);
          let balanceReceiver = await token.balanceOf(receiver);
          let amount = new BN(1000);
          let data = encodeFunctionTransferToken(receiver, amount);
          await multisigWallet.submitTransaction(
            [tokens[i]], [0], [data], { from: owners[0] }
          );
          Helper.assertEqual(
            balanceMultisig.sub(amount), await token.balanceOf(multisigWallet.address)
          );
          Helper.assertEqual(
            balanceReceiver.add(amount), await token.balanceOf(receiver)
          );
        }
      }
    });
  });
});

function getActionHashes(targets, values, callDatas, txId) {
  let hashes = [];
  for(let i = 0; i < targets.length; i++) {
    hashes.push(
      web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['address', 'uint256', 'bytes', 'uint256'],
          [targets[i], values[i], callDatas[i], txId]
        )
      )
    );
  }
  return hashes;
}

function encodeFunctionAddOwner(_owner) {
  return web3.eth.abi.encodeFunctionCall({
      name: 'addOwner',
      type: 'function',
      inputs: [{ type: 'address', name: 'owner'}]
    }, [_owner]
  );
}

function encodeFunctionRemoveOwner(_owner) {
  return web3.eth.abi.encodeFunctionCall({
      name: 'removeOwner',
      type: 'function',
      inputs: [{ type: 'address', name: 'owner'}]
    }, [_owner]
  );
}

function encodeFunctionReplaceOwner(_owner, _newOwner) {
  return web3.eth.abi.encodeFunctionCall({
      name: 'replaceOwner',
      type: 'function',
      inputs: [{ type: 'address', name: 'owner'}, { type: 'address', name: 'newOwner' }]
    }, [_owner, _newOwner]
  );
}

function encodeFunctionChangeRequirement(_required) {
  return web3.eth.abi.encodeFunctionCall({
      name: 'changeRequirement',
      type: 'function',
      inputs: [{ type: 'uint256', name: '_required'}]
    }, [_required]
  );
}

function encodeFunctionTransferToken(receiver, amount) {
  return web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'function',
      inputs: [{ type: 'address', name: 'receiver'}, { type: 'uint256', name: 'amount'}]
    }, [receiver, amount]
  );
}
