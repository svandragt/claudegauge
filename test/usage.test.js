const test = require('node:test');
const assert = require('node:assert/strict');
const { pickSessionPct, pickWeeklyPct, mondayKey } = require('../usage.js');

const blocks = require('./fixtures/blocks.json');
const daily = require('./fixtures/daily.json');

test('mondayKey returns Monday of the given date', () => {
  assert.equal(mondayKey('2026-05-26'), '2026-05-25');
  assert.equal(mondayKey('2026-05-25'), '2026-05-25');
  assert.equal(mondayKey('2026-05-24'), '2026-05-18');
});

test('pickSessionPct prefers usagePercent on the active block', () => {
  assert.equal(pickSessionPct(blocks), 0.425);
});

test('pickSessionPct returns 0 when no blocks present', () => {
  assert.equal(pickSessionPct({ blocks: [] }), 0);
});

test('pickWeeklyPct buckets days into Monday-start weeks and compares to peak of prior weeks', () => {
  // weeks: 3M, 8M, 4M, 2M (current). Prior peak = 8M. 2/8 = 0.25.
  assert.equal(pickWeeklyPct(daily), 0.25);
});

test('pickWeeklyPct returns 0 when no prior weeks exist', () => {
  assert.equal(pickWeeklyPct({ daily: [{ date: '2026-05-26', totalTokens: 100 }] }), 0);
});

test('pickWeeklyPct returns 0 on empty input', () => {
  assert.equal(pickWeeklyPct({ daily: [] }), 0);
});
