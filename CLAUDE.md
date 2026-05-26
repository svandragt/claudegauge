# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Stream Deck / OpenDeck plugin that renders one key as a fill gauge of current Claude usage:

- **Background (yellow, low opacity)** = current-week tokens / max(prior 4 weeks tokens).
- **Foreground (green→red)** = current 5-hour block tokens, as % of the peak of prior non-gap blocks.

Both metrics are derived from the user's own ccusage history — no plan-quota detection, no tunable constants. Target host is **OpenDeck (deb install)**; the manifest is also Elgato Stream Deck compatible.

## Commands

All commands assume you are inside `com.vandragt.claudegauge.sdPlugin/`. devbox provides node 22; `make` is the entry point.

- `make deps` — devbox install + `npm install`.
- `make test` (alias `make usage`) — runs `usage.js` once, prints `{sessionPct, weeklyPct}`. Use this to sanity-check ccusage integration against your real data without touching OpenDeck.
- `npm test` — runs unit tests (`test/usage.test.js`, `test/render.test.js`) plus the integration test (`test/usage.integration.test.js`) that builds a synthetic `~/.claude/projects/` in a tmp HOME and runs the real installed ccusage against it. This is what CI runs; the integration test is the tripwire that catches ccusage JSON-shape drift on dependabot bumps (the previous CLI-flag grep was insufficient — v18→v20 passed the grep while both metrics returned 0).
- `make icons` — regenerate `actions/gauge.svg` from `render.js` and rasterize the manifest PNGs (`icon.png`, `icon@2x.png`, `actions/gauge.png`, `actions/gauge@2x.png`). Requires ImageMagick `convert`.
- `make install` — copy the folder to `~/.config/opendeck/plugins/com.vandragt.claudegauge.sdPlugin`.
- `make uninstall` / `make reinstall` / `make restart` — manage the installed copy and the OpenDeck process.
- `make logs` — `tail -f` the installed plugin's `plugin.log`.

To run a single piece of logic ad-hoc, prefer `devbox run -- node -e '...'` over bare `node` — the host's `node` may not be on PATH inside OpenDeck's spawn environment.

## Architecture

Four files do all the work; each has one job.

- **`manifest.json`** — declares the plugin (`CodePath: run.sh`) and one Action `com.vandragt.claudegauge.gauge`. `CodePathWin` points at `plugin.js` directly for the Windows path that doesn't have the wrapper.
- **`run.sh`** — the entry the host actually spawns. Resolves `node` via `devbox run --` if devbox is on PATH, otherwise falls back to bare `node`. This indirection exists because the user's `node` lives in a devbox profile that isn't on OpenDeck's launch PATH.
- **`plugin.js`** — WebSocket loop. Parses the four CLI args the host passes (`-port -pluginUUID -registerEvent -info`), connects to `ws://127.0.0.1:<port>`, sends `{event: registerEvent, uuid: pluginUUID}` to identify itself. Maintains `contexts: Set<string>` of currently-visible keys (added on `willAppear`, removed on `willDisappear`). On a 60s `setInterval`, calls `getUsage()` and broadcasts `setImage` to every context with the rendered SVG. Every line goes to `plugin.log` next to the script.
- **`render.js`** — pure function `renderGauge({weeklyPct, sessionPct, label})` → `data:image/svg+xml;base64,...`. Two stacked `<rect>`s clipped to a rounded rectangle. No canvas dependency.
- **`usage.js`** — spawns `npx -y ccusage@<version> blocks --json` and `... daily --json` in parallel via `execFile`, parses results in `pickSessionPct` / `pickWeeklyPct`. The ccusage version is sourced from `package.json` devDependencies so dependabot can bump it in one place. `pickSessionPct` finds the `isActive` block and computes its tokens vs the peak of prior non-gap blocks. `pickWeeklyPct` buckets daily rows (filtered to `agent === 'all'`) into Monday-start weeks via `mondayKey` and compares the current week to the peak of the prior 4. Both percentages are derived from history — no `--active`, no `--token-limit`, no `usagePercent` field reliance, because ccusage has dropped each of those between majors. Importable (`getUsage`) and runnable (`if (require.main === module)`).

The host→plugin contract is the Elgato Stream Deck WebSocket SDK; OpenDeck implements the same protocol. Key events to care about: `willAppear` (capture `context`), `willDisappear` (drop it), `keyDown` (POC uses this to trigger an immediate refresh). Key commands: `setImage` with a data-URI payload and `target: 0`.

## Constraints and gotchas

- **No plan-quota detection.** Both percentages are relative to the user's own history. Cold-start (less than 4 prior weeks of data) will pin the weekly bar near 100%.
- **ccusage is a devDependency and pinned in `package.json`.** `npx` resolves it from `node_modules` so no per-run network fetch; dependabot manages bumps. Don't downgrade to `ccusage@latest` — that's how the v20 breakage slipped in.
- **OpenDeck is `deb`-installed** here. Plugins dir is `~/.config/opendeck/plugins/`, not the Flatpak path. Do not reintroduce `flatpak override` logic.
- **Don't tune constants.** A previous iteration of the plan used `SESSION_CAP` / `WEEKLY_CAP` magic numbers — the user explicitly rejected hand-tuning. Keep both fill levels derived from history.
- **Don't use undocumented Anthropic APIs** (e.g. reusing the local OAuth token to read rate-limit response headers). ccusage is the sanctioned data source for this project. See `~/.claude/projects/.../memory/feedback_no_undocumented_apis.md`.
- **Icon paths in `manifest.json` are extensionless** — the host picks `.png` / `@2x.png`. Regenerate via `make icons`, never hand-edit the PNGs.
- **Logs land in two places:** `plugin.log` next to the *installed* copy (after `make install`), and OpenDeck's own logs at `~/.config/opendeck/logs/`. The dev tree's `plugin.log` is only written when running the script in-place.
