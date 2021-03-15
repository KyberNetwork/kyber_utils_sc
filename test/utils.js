const MockUtils = artifacts.require('MockUtils.sol');
const Helper = require('./helper.js');
const TestToken = artifacts.require('Token.sol');
const TokenNoDecimals = artifacts.require('TokenNoDecimals.sol');
const {expectRevert} = require('@openzeppelin/test-helpers');
const BN = web3.utils.BN;
const {BPS, precisionUnits, bnbDecimals, bnbAddress, MAX_QTY, MAX_RATE} = require('./helper.js');

const MAX_DECIMALS = 18;
const MAX_DECIMAL_DIFF = 18;

contract('Utils', function (accounts) {
  before('should init global', async function () {
    utils = await MockUtils.new();
  });

  it('check constant variable', async function () {
    Helper.assertEqual(await utils.mockGetPrecision(), precisionUnits, 'precision is not correct');
    Helper.assertEqual(await utils.mockGetMaxRate(), MAX_RATE, 'maxrate is not correct');
    Helper.assertEqual(await utils.mockGetMaxQty(), MAX_QTY, 'max qty is not correct');
    Helper.assertEqual(await utils.mockGetMaxDecimals(), MAX_DECIMALS, 'max decimals is not correct');
    Helper.assertEqual(await utils.mockGetBnbDecimals(), bnbDecimals, 'bnb decimal is not correct');
    Helper.assertEqual(await utils.mockGetBPS(), BPS, 'bps is not correct');
    Helper.assertEqual(await utils.mockGetBnbTokenAddress(), bnbAddress, 'bnb address is not correct');
  });

  describe('test get balance', async function () {
    it('test get bnb balance', async function () {
      user = accounts[9];
      let balanceBnb = await Helper.getBalancePromise(user);
      balance = await utils.mockGetBalance(bnbAddress, user);
      Helper.assertEqual(balance, balanceBnb);
    });

    it('test get token balance', async function () {
      let token = await TestToken.new('regular', 'reg', 16);
      let tokenBalance = 600;
      let user = accounts[8];

      await token.transfer(user, tokenBalance);

      let balance = await utils.mockGetBalance(token.address, user);
      Helper.assertEqual(balance, tokenBalance);
    });
  });

  describe('test get decimals', async function () {
    it('should check get decimals for bnb', async function () {
      Helper.assertEqual(await utils.mockGetSetDecimals.call(bnbAddress), bnbDecimals);
      Helper.assertEqual(await utils.mockGetDecimals(bnbAddress), bnbDecimals);
    });

    it('should check get decimals for normal token', async function () {
      let token = await TestToken.new('regular', 'reg', 16);
      Helper.assertEqual(await utils.mockGetDecimals(token.address), 16);
      Helper.assertEqual(await utils.mockGetDecimalsMap(token.address), 0);
      Helper.assertEqual(await utils.mockGetSetDecimals.call(token.address), 16);
      await utils.mockGetSetDecimals(token.address);
      Helper.assertEqual(await utils.mockGetDecimalsMap.call(token.address), 16);
    });

    it('should check get update decimals for normal token', async function () {
      let token = await TestToken.new('regular', 'reg', 16);
      Helper.assertEqual(await utils.mockGetSetDecimals.call(token.address), 16);
      // check gas consumtion and memory change
      Helper.assertEqual(await utils.mockGetDecimalsMap(token.address), 0);
      let tx1 = await utils.mockGetSetDecimals(token.address);
      Helper.assertEqual(await utils.mockGetDecimalsMap.call(token.address), 16);
      let tx2 = await utils.mockGetSetDecimals(token.address);
      Helper.assertGreater(tx1.receipt.gasUsed, tx2.receipt.gasUsed);
    });

    it('should check get decimals for token without decimals API. see reverts', async function () {
      let tokenNoDecimals = await TokenNoDecimals.new('noDec', 'dec', 18);

      // now get decimals to see values
      await expectRevert.unspecified(utils.mockGetSetDecimals(tokenNoDecimals.address));
      await expectRevert.unspecified(utils.mockGetDecimals(tokenNoDecimals.address));
    });
  });

  describe('check dst qty calculation', async function () {
    before(async function () {
      token1 = await TestToken.new('Token1', '1', 10);
      token2 = await TestToken.new('Token2', '2', 20);
    });

    it('check dest qty calculation for dest decimals > src decimals', async function () {
      let srcQty = MAX_QTY.div(new BN(2));
      let rate = MAX_RATE;

      let srcDecimal = await token1.decimals();
      let dstDecimal = await token2.decimals();
      let srcAddress = token1.address;
      let dstAddress = token2.address;

      let expectedDestQty = Helper.calcDstQty(srcQty, srcDecimal, dstDecimal, rate);
      let reportedDstQty = await utils.mockCalcDstQty(srcQty, srcDecimal, dstDecimal, rate);
      Helper.assertEqual(expectedDestQty, reportedDstQty, 'unexpected dst qty');
      Helper.assertEqual(
        expectedDestQty,
        await utils.mockCalcDestAmount(srcAddress, dstAddress, srcQty, rate),
        'unexpected destamount'
      );
    });

    it('check dest qty calculation for dest decimals < src decimals.', async function () {
      let srcQty = MAX_QTY.div(new BN(2));
      let rate = MAX_RATE;

      let srcDecimal = await token2.decimals();
      let dstDecimal = await token1.decimals();
      let srcAddress = token2.address;
      let dstAddress = token1.address;

      expectedDestQty = Helper.calcDstQty(srcQty, srcDecimal, dstDecimal, rate);
      reportedDstQty = await utils.mockCalcDstQty(srcQty, srcDecimal, dstDecimal, rate);
      Helper.assertEqual(expectedDestQty, reportedDstQty, 'unexpected dst qty');
      Helper.assertEqual(
        expectedDestQty,
        await utils.mockCalcDestAmount(srcAddress, dstAddress, srcQty, rate),
        'unexpected destamount'
      );
    });

    it('check dest qty calculation revert for > MAX_QTY.', async function () {
      let srcDecimal = 10;
      let dstDecimal = 20;
      let rate = MAX_RATE;
      let srcQty = MAX_QTY.add(new BN(1));
      await expectRevert(utils.mockCalcDstQty(srcQty, srcDecimal, dstDecimal, rate), 'srcQty > MAX_QTY');
    });

    it('check dest qty calculation revert for > MAX_RATE.', async function () {
      let srcDecimal = 10;
      let dstDecimal = 20;
      let rate = MAX_RATE.add(new BN(1));
      let srcQty = MAX_QTY;
      await expectRevert(utils.mockCalcDstQty(srcQty, srcDecimal, dstDecimal, rate), 'rate > MAX_RATE');
    });
  });

  describe('check src qty calculation', async function () {
    before(async function () {
      token1 = await TestToken.new('Token1', '1', 10);
      token2 = await TestToken.new('Token2', '2', 20);
    });

    it('check src qty calculation for dest decimals > src decimals', async function () {
      let dstQty = MAX_QTY.div(new BN(2));
      let rate = MAX_RATE;

      let srcDecimal = await token1.decimals();
      let dstDecimal = await token2.decimals();
      let srcAddress = token1.address;
      let dstAddress = token2.address;

      let expectedSrcQty = Helper.calcSrcQty(dstQty, srcDecimal, dstDecimal, rate);
      let reportedDstQty = await utils.mockCalcSrcQty(dstQty, srcDecimal, dstDecimal, rate);
      Helper.assertEqual(expectedSrcQty, reportedDstQty, 'unexpected dst qty');
      Helper.assertEqual(
        expectedSrcQty,
        await utils.mockCalcSrcAmount(srcAddress, dstAddress, dstQty, rate),
        'unexpected srcAmount'
      );
    });

    it('check src qty calculation for src decimals > dest decimals', async function () {
      let dstQty = MAX_QTY.div(new BN(2));
      let rate = MAX_RATE;

      let srcDecimal = await token2.decimals();
      let dstDecimal = await token1.decimals();
      let srcAddress = token2.address;
      let dstAddress = token1.address;

      expectedSrcQty = Helper.calcSrcQty(dstQty, srcDecimal, dstDecimal, rate);
      reportedDstQty = await utils.mockCalcSrcQty(dstQty, srcDecimal, dstDecimal, rate);
      Helper.assertEqual(expectedSrcQty, reportedDstQty, 'unexpected dst qty');
      Helper.assertEqual(
        expectedSrcQty,
        await utils.mockCalcSrcAmount(srcAddress, dstAddress, dstQty, rate),
        'unexpected srcAmount'
      );
    });

    it('check src qty calculation revert for > MAX_RATE.', async function () {
      let srcDecimal = await token1.decimals();
      let dstDecimal = await token2.decimals();
      let dstQty = MAX_QTY.div(new BN(2));
      let rate = MAX_RATE.add(new BN(1));
      await expectRevert(utils.mockCalcSrcQty(dstQty, srcDecimal, dstDecimal, rate), 'rate > MAX_RATE');
    });
    it('check src qty calculation revert for > MAX_QTY.', async function () {
      let srcDecimal = await token1.decimals();
      let dstDecimal = await token2.decimals();
      let dstQty = MAX_QTY.add(new BN(1));
      let rate = MAX_RATE;

      await expectRevert(utils.mockCalcSrcQty(dstQty, srcDecimal, dstDecimal, rate), 'dstQty > MAX_QTY');
    });
  });

  describe('should check when decimals diff > 18 calc reverted.', async function () {
    before(function () {
      smallDecimal = 10;
      bigDecimal = smallDecimal + MAX_DECIMAL_DIFF + 1;
    });

    it('cal dst qty dst - src > MAX_DECIMALS', async function () {
      await expectRevert(utils.mockCalcDstQty(30, smallDecimal, bigDecimal, 1500), 'dst - src > MAX_DECIMALS');
    });

    it('cal dst qty src - dst > MAX_DECIMALS', async function () {
      await expectRevert(utils.mockCalcDstQty(30, bigDecimal, smallDecimal, 1500), 'src - dst > MAX_DECIMALS');
    });

    it('cal src qty dst - src > MAX_DECIMALS', async function () {
      await expectRevert(utils.mockCalcSrcQty(30, smallDecimal, bigDecimal, 1500), 'dst - src > MAX_DECIMALS');
    });
    it('cal src qty src - dst > MAX_DECIMALS', async function () {
      await expectRevert(utils.mockCalcSrcQty(30, bigDecimal, smallDecimal, 1500), 'src - dst > MAX_DECIMALS');
    });
  });

  describe('test calc rate', async function () {
    it('test calc rate from qty.', async function () {
      let srcDecimal = 15;
      let destDecimal = 17;
      let srcQty = 531;
      let destQty = 11531;

      let expectedRate = Helper.calcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);
      let rxRate = await utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);

      Helper.assertEqual(rxRate, expectedRate);
    });

    it('test calc rate from qty. other numbers', async function () {
      let srcDecimal = 15;
      let destDecimal = 9;
      let srcQty = 5313535;
      let destQty = 11531;

      let expectedRate = Helper.calcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);
      let rxRate = await utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);

      Helper.assertEqual(rxRate, expectedRate);
    });

    it('test calc functionality with high src quantity.', async function () {
      let srcDecimal = 15;
      let destDecimal = 17;
      let srcQty = MAX_QTY;
      let destQty = 11531;

      let expectedRate = Helper.calcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);
      let rxRate = await utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);

      Helper.assertEqual(rxRate, expectedRate);
    });

    it('test calc function revert when srcAmount > MAX_QTY', async function () {
      let srcDecimal = 15;
      let destDecimal = 17;
      let srcQty = MAX_QTY.add(new BN(1));
      let destQty = 11531;

      await expectRevert(utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal), 'srcAmount > MAX_QTY');
    });

    it('test calc functionality with high dest quantity.', async function () {
      let srcDecimal = 15;
      let destDecimal = 17;
      let srcQty = 1;
      let destQty = MAX_QTY;

      let expectedRate = Helper.calcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);
      let rxRate = await utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);

      Helper.assertEqual(rxRate, expectedRate);
    });

    it('test calc function revert when destAmount > MAX_QTY', async function () {
      let srcDecimal = 15;
      let destDecimal = 17;
      let srcQty = 1;
      let destQty = MAX_QTY.add(new BN(1));

      await expectRevert(utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal), 'destAmount > MAX_QTY');
    });

    it('test calc functionality with high decimal diff destDecimal > srcDecimal.', async function () {
      let srcDecimal = 4;
      let destDecimal = srcDecimal + MAX_DECIMAL_DIFF;
      let srcQty = 795;
      let destQty = 9853;

      let expectedRate = Helper.calcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);
      let rxRate = await utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);

      Helper.assertEqual(rxRate, expectedRate);
    });

    it('test calc functionality with high decimal diff destDecimal > srcDecimal check revert.', async function () {
      let srcDecimal = 4;
      let destDecimal = srcDecimal + MAX_DECIMAL_DIFF + 1;
      let srcQty = 795;
      let destQty = 9853;

      await expectRevert(
        utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal),
        'dst - src > MAX_DECIMALS'
      );
    });

    it('test calc functionality with high decimal diff srcDecimal > destDecimal.', async function () {
      let destDecimal = 9;
      let srcDecimal = destDecimal + MAX_DECIMAL_DIFF;
      let srcQty = 795;
      let destQty = 9853;

      //should work with max decimal diff.
      let expectedRate = Helper.calcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);
      let rxRate = await utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal);
      Helper.assertEqual(rxRate, expectedRate);
    });

    it('test calc functionality with high decimal diff srcDecimal > destDecimal check revert.', async function () {
      let destDecimal = 9;
      let srcDecimal = destDecimal + MAX_DECIMAL_DIFF + 1;
      let srcQty = 795;
      let destQty = 9853;
      await expectRevert(
        utils.mockCalcRateFromQty(srcQty, destQty, srcDecimal, destDecimal),
        'src - dst > MAX_DECIMALS'
      );
    });
  });

  it('test min of', async function () {
    Helper.assertEqual(3, await utils.mockMinOf(3, 10));
    Helper.assertEqual(3, await utils.mockMinOf(10, 3));
  });
});
