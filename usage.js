const { execFile } = require('node:child_process');

const CCUSAGE_VERSION = require('./package.json').devDependencies.ccusage;

function runCcusage(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    execFile('npx', ['-y', `ccusage@${CCUSAGE_VERSION}`, ...args, '--json'], { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`ccusage ${args.join(' ')} failed: ${err.message}\n${stderr}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`ccusage ${args.join(' ')} JSON parse failed: ${e.message}\n--- stdout ---\n${stdout}`));
      }
    });
  });
}

function sumTokens(tc) {
  if (!tc) return 0;
  return (tc.inputTokens || 0) + (tc.outputTokens || 0) +
         (tc.cacheCreationInputTokens || 0) + (tc.cacheReadInputTokens || 0);
}

function pickSessionPct(blocksJson) {
  const blocks = blocksJson.blocks || [];
  const active = blocks.find(b => b.isActive);
  if (!active) return 0;

  let peak = 0;
  for (const b of blocks) {
    if (b === active || b.isGap) continue;
    peak = Math.max(peak, sumTokens(b.tokenCounts));
  }
  if (peak === 0) return 0;
  return sumTokens(active.tokenCounts) / peak;
}

function mondayKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay();
  const offset = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function pickWeeklyPct(dailyJson) {
  const days = dailyJson.daily || [];
  if (!Array.isArray(days) || days.length === 0) return 0;

  const byWeek = new Map();
  for (const day of days) {
    if (day.agent && day.agent !== 'all') continue;
    const date = day.period || day.date;
    if (!date) continue;
    const key = mondayKey(date);
    const tokens = day.totalTokens ?? sumTokens(day);
    byWeek.set(key, (byWeek.get(key) || 0) + tokens);
  }

  const sorted = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return 0;

  const current = sorted[sorted.length - 1][1];
  const prior = sorted.slice(-5, -1);
  if (prior.length === 0) return 0;

  const peak = Math.max(...prior.map(([, t]) => t));
  if (!peak) return 0;
  return current / peak;
}

async function getUsage() {
  const [blocksJson, dailyJson] = await Promise.all([
    runCcusage(['blocks']),
    runCcusage(['daily']),
  ]);
  return {
    sessionPct: pickSessionPct(blocksJson),
    weeklyPct: pickWeeklyPct(dailyJson),
    raw: { blocksJson, dailyJson },
  };
}

module.exports = { getUsage, pickSessionPct, pickWeeklyPct, mondayKey };

if (require.main === module) {
  getUsage().then(u => {
    console.log(JSON.stringify({ sessionPct: u.sessionPct, weeklyPct: u.weeklyPct }, null, 2));
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
