const { execFile } = require('node:child_process');

const CCUSAGE_VERSION = '18.0.11';

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
  const active = blocks.find(b => b.isActive) || blocks[blocks.length - 1];
  if (!active) return 0;

  if (typeof active.usagePercent === 'number') return active.usagePercent / 100;
  if (active.projection && typeof active.projection.percentUsed === 'number') return active.projection.percentUsed / 100;

  const limit = active.tokenLimitStatus && active.tokenLimitStatus.limit;
  if (limit) return sumTokens(active.tokenCounts) / limit;

  let peak = 0;
  for (const b of blocks) {
    if (b === active) continue;
    peak = Math.max(peak, sumTokens(b.tokenCounts));
  }
  if (peak === 0) return 0;
  return sumTokens(active.tokenCounts) / peak;
}

function pickWeeklyPct(weeklyJson) {
  const weeks = weeklyJson.weekly || weeklyJson.weeks || weeklyJson.data || [];
  if (!Array.isArray(weeks) || weeks.length === 0) return 0;

  const sorted = [...weeks].sort((a, b) => String(a.week || a.date || '').localeCompare(String(b.week || b.date || '')));
  const current = sorted[sorted.length - 1];
  const prior = sorted.slice(-5, -1);
  if (prior.length === 0) return 0;

  const currentTokens = current.totalTokens ?? sumTokens(current);
  const peak = Math.max(...prior.map(w => w.totalTokens ?? sumTokens(w)));
  if (!peak) return 0;
  return currentTokens / peak;
}

async function getUsage() {
  const [blocksJson, weeklyJson] = await Promise.all([
    runCcusage(['blocks', '--active', '--token-limit', 'max']),
    runCcusage(['weekly', '--start-of-week', 'monday']),
  ]);
  return {
    sessionPct: pickSessionPct(blocksJson),
    weeklyPct: pickWeeklyPct(weeklyJson),
    raw: { blocksJson, weeklyJson },
  };
}

module.exports = { getUsage, pickSessionPct, pickWeeklyPct };

if (require.main === module) {
  getUsage().then(u => {
    console.log(JSON.stringify({ sessionPct: u.sessionPct, weeklyPct: u.weeklyPct }, null, 2));
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
