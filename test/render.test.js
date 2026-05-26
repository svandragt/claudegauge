const test = require('node:test');
const assert = require('node:assert/strict');
const { renderGauge } = require('../render.js');

test('renderGauge returns a base64 data URI for an SVG', () => {
  const uri = renderGauge({ weeklyPct: 0.5, sessionPct: 0.5 });
  assert.match(uri, /^data:image\/svg\+xml;base64,/);
  const svg = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
  assert.match(svg, /<svg[\s\S]*<\/svg>/);
});

test('renderGauge clamps out-of-range percentages without throwing', () => {
  assert.doesNotThrow(() => renderGauge({ weeklyPct: -1, sessionPct: 5 }));
  assert.doesNotThrow(() => renderGauge({ weeklyPct: 0, sessionPct: 0 }));
  assert.doesNotThrow(() => renderGauge({ weeklyPct: 1, sessionPct: 1 }));
});
