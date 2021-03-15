const MockWithdrawable = artifacts.require('MockWithdrawable.sol');
const TestToken = artifacts.require('Token.sol');
const TokenTransferNoReturn = artifacts.require('TokenTransferNoReturn.sol');

const Helper = require('./helper.js');
const BN = web3.utils.BN;

let token;
let admin;
let user;
let withdrawableInst;
let initialTokenBalance = new BN(100);
let tokenWithdrawAmt = new BN(60);
let initialBnbBalance = new BN(10);
let bnbWithdrawAmt = new BN(3);

const {zeroBN} = require('./helper.js');
const {expectRevert} = require('@openzeppelin/test-helpers');

contract('Withdrawable', function (accounts) {
  before('should init globals, deploy test token', async function () {
    user = accounts[0];
    admin = accounts[1];
    token = await TestToken.new('tst', 'test', 18, {from: accounts[2]});
    tokenTransferNoReturn = await TokenTransferNoReturn.new('tst', 'test', 18, {from: accounts[2]});
  });

  describe('test token transfer permissions', async () => {
    beforeEach('deploy a new withdrawable inst, with some initial tokens', async function () {
      withdrawableInst = await MockWithdrawable.new({from: admin});
      // transfer some tokens to withdrawable.
      await token.transfer(withdrawableInst.address, initialTokenBalance, {from: accounts[2]});
      await tokenTransferNoReturn.transfer(withdrawableInst.address, initialTokenBalance, {from: accounts[2]});
      let balance = await token.balanceOf(withdrawableInst.address);
      Helper.assertEqual(balance, initialTokenBalance, 'unexpected balance in withdrawable contract.');
      balance = await tokenTransferNoReturn.balanceOf(withdrawableInst.address);
      Helper.assertEqual(balance, initialTokenBalance, 'unexpected balance in withdrawable contract.');
    });

    it('should test withdraw token success for admin.', async function () {
      let rxAdmin = await withdrawableInst.admin();
      Helper.assertEqual(admin, rxAdmin, 'wrong admin ' + rxAdmin.toString());

      // withdraw the tokens from withdrawableInst
      await withdrawableInst.withdrawToken(token.address, tokenWithdrawAmt, user, {from: admin});

      balance = await token.balanceOf(withdrawableInst.address);
      Helper.assertEqual(
        balance,
        initialTokenBalance.sub(tokenWithdrawAmt),
        'unexpected balance in withdrawble contract.'
      );

      balance = await token.balanceOf(user);
      Helper.assertEqual(balance, tokenWithdrawAmt, 'unexpected balance in user.');
    });

    it('should test withdraw token with no return values success for admin.', async function () {
      let rxAdmin = await withdrawableInst.admin();
      Helper.assertEqual(admin, rxAdmin, 'wrong admin ' + rxAdmin.toString());

      // withdraw the tokens with no  transfer return values from withdrawableInst
      await withdrawableInst.withdrawToken(tokenTransferNoReturn.address, tokenWithdrawAmt, user, {from: admin});

      balance = await tokenTransferNoReturn.balanceOf(withdrawableInst.address);
      Helper.assertEqual(
        balance,
        initialTokenBalance.sub(tokenWithdrawAmt),
        'unexpected balance in withdrawble contract.'
      );

      balance = await tokenTransferNoReturn.balanceOf(user);
      Helper.assertEqual(balance, tokenWithdrawAmt, 'unexpected balance in user.');
    });

    it('should test withdraw token reject for non admin.', async function () {
      await expectRevert(
        withdrawableInst.withdrawToken(token.address, tokenWithdrawAmt, user, {from: user}),
        'only admin'
      );
    });

    it('should test withdraw token reject when amount too high.', async function () {
      tokenWithdrawAmt = tokenWithdrawAmt.add(initialTokenBalance);
      await expectRevert.unspecified(
        withdrawableInst.withdrawToken(token.address, tokenWithdrawAmt, user, {from: admin})
      );

      let balance = await token.balanceOf(withdrawableInst.address);
      Helper.assertEqual(balance, initialTokenBalance, 'unexpected balance in withdrawble contract.');
    });
  });

  describe('test BNB transfer permissions', async () => {
    beforeEach('deploy a new MockWithdrawable inst with some initial BNB', async function () {
      withdrawableInst = await MockWithdrawable.new({from: admin});
      // transfer some BNB
      await withdrawableInst.send(initialBnbBalance, {from: accounts[4]});
      let balance = await Helper.getBalancePromise(withdrawableInst.address);
      Helper.assertEqual(balance, initialBnbBalance, 'unexpected balance in withdrawable contract.');
    });

    it('should test withdraw bnb success for admin.', async function () {
      // withdraw the bnb from withdrawableInst
      await withdrawableInst.withdrawBnb(bnbWithdrawAmt, user, {from: admin});

      let balance = await Helper.getBalancePromise(withdrawableInst.address);
      Helper.assertEqual(
        balance,
        initialBnbBalance.sub(bnbWithdrawAmt),
        'unexpected balance in withdrawble contract.'
      );
    });

    it('should test withdraw bnb reject for non admin.', async function () {
      // try to withdraw the bnb from withdrawableInst
      await expectRevert(withdrawableInst.withdrawBnb(bnbWithdrawAmt, user, {from: user}), 'only admin');
    });

    it('should test withdraw bnb reject when amount too high.', async function () {
      bnbWithdrawAmt = bnbWithdrawAmt.add(initialBnbBalance);

      // try to withdraw the bnb from withdrawableInst
      await expectRevert.unspecified(withdrawableInst.withdrawBnb(bnbWithdrawAmt, user, {from: admin}));
    });
  });
});
