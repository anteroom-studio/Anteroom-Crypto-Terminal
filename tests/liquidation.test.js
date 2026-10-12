import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePressureMap, observedLiquidationsInWindow, recordLiquidationEvent } from '../src/logic/zaiEngine.js';

function market() {
  return {
    lastPrice: 100,
    openInterestUsd: 1_000_000,
    oiDeltaPct: 0,
    stableHistory: [0],
    estimatedLiqLong: 0,
    estimatedLiqShort: 0,
    observedLiqLong: 0,
    observedLiqShort: 0,
    liqWindowStart: 1_000,
  };
}

test('recalculating modeled pressure cannot rewrite exchange observations', () => {
  const m = market();
  m.observedLiqLong = 123;
  m.observedLiqShort = 456;
  estimatePressureMap({ symbol: 'ETH', market: m });
  assert.equal(m.estimatedLiqLong, 240_000);
  assert.equal(m.estimatedLiqShort, 220_000);
  assert.equal(m.observedLiqLong, 123);
  assert.equal(m.observedLiqShort, 456);
});

test('SELL and BUY forceOrder events count separately and never change the estimate', () => {
  const m = market();
  m.estimatedLiqLong = 1234;
  m.estimatedLiqShort = 5678;
  assert.equal(recordLiquidationEvent(m, { S: 'SELL', ap: '200', q: '2' }, 2_000), true);
  assert.equal(recordLiquidationEvent(m, { S: 'BUY', ap: '180', q: '3' }, 3_000), true);
  assert.deepEqual(observedLiquidationsInWindow(m, 3_000), { long: 400, short: 540 });
  assert.equal(m.estimatedLiqLong, 1234);
  assert.equal(m.estimatedLiqShort, 5678);
});

test('stale observations vanish from the displayed window and the next event starts a new one', () => {
  const m = market();
  recordLiquidationEvent(m, { S: 'SELL', p: '100', q: '1' }, 1_200);
  assert.deepEqual(observedLiquidationsInWindow(m, 901_001), { long: 0, short: 0 });
  assert.equal(recordLiquidationEvent(m, { S: 'BUY', p: '150', q: '2' }, 901_001), true);
  assert.deepEqual(observedLiquidationsInWindow(m, 901_002), { long: 0, short: 300 });
  assert.equal(m.liqWindowStart, 901_001);
});

test('invalid or malformed stream entries are not recorded', () => {
  const m = market();
  for (const order of [null, {}, { S: 'HOLD', p: 100, q: 2 }, { S: 'BUY', p: -1, q: 2 }, { S: 'SELL', p: 100, q: 'oops' }]) {
    assert.equal(recordLiquidationEvent(m, order, 2_000), false);
  }
  assert.equal(m.observedLiqLong, 0);
  assert.equal(m.observedLiqShort, 0);
});
