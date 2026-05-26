const test = require('node:test');
const assert = require('node:assert/strict');
const { pickSessionPct, pickWeeklyPct, mondayKey } = require('../usage.js');

const blocks = require('./fixtures/blocks-v20.json');
const daily = require('./fixtures/daily-v20.json');

test('mondayKey returns Monday of the given date', () => {
  assert.equal(mondayKey('2026-05-26'), '2026-05-25');
  assert.equal(mondayKey('2026-05-25'), '2026-05-25');
  assert.equal(mondayKey('2026-05-24'), '2026-05-18');
});

test('pickSessionPct compares active block tokens to peak of prior non-gap blocks', () => {
  // active sums to 5000, prior peak (block-old-1) sums to 20000 → 0.25
  assert.equal(pickSessionPct(blocks), 0.25);
});

test('pickSessionPct ignores gap blocks when computing peak', () => {
  // If gaps counted, peak would still be 20000 here, but verify gap is skipped.
  const onlyGaps = { blocks: [
    { isActive: true, isGap: false, tokenCounts: { inputTokens: 100 } },
    { isActive: false, isGap: true, tokenCounts: { inputTokens: 999999 } }
  ]};
  assert.equal(pickSessionPct(onlyGaps), 0);
});

test('pickSessionPct returns 0 when no blocks present', () => {
  assert.equal(pickSessionPct({ blocks: [] }), 0);
});

test('pickWeeklyPct buckets days (using period field) into Monday-start weeks vs prior-4 peak', () => {
  // weeks: 3M, 8M, 4M, 2M (current). Prior peak = 8M. 2/8 = 0.25.
  assert.equal(pickWeeklyPct(daily), 0.25);
});

test('pickWeeklyPct filters daily rows by agent === "all"', () => {
  const mixed = { daily: [
    { agent: 'all', period: '2026-05-04', totalTokens: 1000 },
    { agent: 'codex', period: '2026-05-04', totalTokens: 999999 },
    { agent: 'all', period: '2026-05-11', totalTokens: 2000 },
    { agent: 'all', period: '2026-05-18', totalTokens: 3000 },
    { agent: 'all', period: '2026-05-25', totalTokens: 500 }
  ]};
  // weeks (all-agent): 1000, 2000, 3000, 500 (current). Prior peak = 3000. 500/3000 ≈ 0.1667
  assert.equal(pickWeeklyPct(mixed), 500 / 3000);
});

test('pickWeeklyPct returns 0 when no prior weeks exist', () => {
  assert.equal(pickWeeklyPct({ daily: [{ agent: 'all', period: '2026-05-26', totalTokens: 100 }] }), 0);
});

test('pickWeeklyPct returns 0 on empty input', () => {
  assert.equal(pickWeeklyPct({ daily: [] }), 0);
});
