// Integration test: runs the *real* installed ccusage binary against a
// synthetic ~/.claude/projects directory, feeds the JSON through our
// parsers, and asserts non-zero results. Catches schema drift on
// any future ccusage bump (the unit tests use static fixtures and
// would not).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pickSessionPct, pickWeeklyPct } = require('../usage.js');

function assistantMsg(date, tokens) {
  return JSON.stringify({
    type: 'assistant',
    uuid: `uuid-${date.getTime()}`,
    timestamp: date.toISOString(),
    sessionId: 'test-session',
    requestId: `req-${date.getTime()}`,
    message: {
      id: `msg-${date.getTime()}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'hi' }],
      usage: {
        input_tokens: tokens.input || 0,
        output_tokens: tokens.output || 0,
        cache_creation_input_tokens: tokens.cacheCreation || 0,
        cache_read_input_tokens: tokens.cacheRead || 0,
      },
    },
  });
}

function buildFakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claudegauge-int-'));
  const projDir = path.join(home, '.claude', 'projects', 'test-project');
  fs.mkdirSync(projDir, { recursive: true });

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const lines = [
    assistantMsg(new Date(now.getTime() - 35 * day), { input: 1000, output: 2000, cacheCreation: 500, cacheRead: 1000 }),
    assistantMsg(new Date(now.getTime() - 28 * day), { input: 5000, output: 10000, cacheCreation: 2000, cacheRead: 5000 }),
    assistantMsg(new Date(now.getTime() - 21 * day), { input: 3000, output: 6000, cacheCreation: 1000, cacheRead: 3000 }),
    assistantMsg(new Date(now.getTime() - 14 * day), { input: 4000, output: 8000, cacheCreation: 1500, cacheRead: 4000 }),
    assistantMsg(new Date(now.getTime() - 7 * day), { input: 2000, output: 4000, cacheCreation: 800, cacheRead: 2000 }),
    assistantMsg(new Date(now.getTime() - 60 * 60 * 1000), { input: 100, output: 200, cacheCreation: 50, cacheRead: 100 }),
  ];

  fs.writeFileSync(path.join(projDir, 'session.jsonl'), lines.join('\n') + '\n');
  return home;
}

function runCcusage(home, args) {
  const cwd = process.cwd();
  const out = execFileSync('npx', ['ccusage', ...args, '--json'], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    cwd,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60_000,
  });
  return JSON.parse(out.toString('utf8'));
}

test('real ccusage output flows through pickSessionPct → non-zero', () => {
  const home = buildFakeHome();
  const blocksJson = runCcusage(home, ['blocks']);
  const pct = pickSessionPct(blocksJson);
  assert.ok(pct > 0, `expected sessionPct > 0, got ${pct}. blocks: ${JSON.stringify(blocksJson).slice(0, 400)}`);
});

test('real ccusage output flows through pickWeeklyPct → non-zero', () => {
  const home = buildFakeHome();
  const dailyJson = runCcusage(home, ['daily']);
  const pct = pickWeeklyPct(dailyJson);
  assert.ok(pct > 0, `expected weeklyPct > 0, got ${pct}. daily: ${JSON.stringify(dailyJson).slice(0, 400)}`);
});
