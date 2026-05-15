# Claude Gauge

[github.com/svandragt/claudegauge](https://github.com/svandragt/claudegauge)

An [OpenDeck](https://github.com/nekename/OpenDeck) / Elgato Stream Deck plugin that turns one key into a fill gauge of your current Claude usage.

- **Background fill (yellow)** — current week's tokens vs. the peak of your prior 4 weeks.
- **Foreground fill (green → red)** — current 5-hour block vs. your historical peak block.

Both numbers come from [ccusage](https://github.com/ryoppippi/ccusage), which reads `~/.claude/projects/**/*.jsonl` locally. No Anthropic API calls, no tokens, no plan-quota knowledge — both bars are relative to your own usage history.

## Requirements

- **Node.js 18+** on PATH.
- **OpenDeck** (Linux deb / Flatpak) or **Elgato Stream Deck** software.
- The first run downloads `ccusage` via `npx`; needs network once.

## Install

### OpenDeck (Linux, deb)

```sh
git clone https://github.com/svandragt/claudegauge.git com.vandragt.claudegauge.sdPlugin
cd com.vandragt.claudegauge.sdPlugin
npm install
cp -r . ~/.config/opendeck/plugins/com.vandragt.claudegauge.sdPlugin
```

Restart OpenDeck, then drag **Claude Gauge** onto a key.

### OpenDeck (Flatpak)

Same as above, but the plugins dir is `~/.var/app/me.amankhanna.opendeck/data/opendeck/plugins/`. You'll also need to grant read access to your Claude data:

```sh
flatpak override --user --filesystem=~/.claude:ro me.amankhanna.opendeck
flatpak override --user --filesystem=~/.config/claude:ro me.amankhanna.opendeck
```

### Elgato Stream Deck

Zip the folder, rename to `claudegauge.streamDeckPlugin`, double-click to install.

## How it works

```
OpenDeck/Elgato host  ─spawn─►  run.sh  ─exec─►  node plugin.js
                                                    │
                              websocket on 127.0.0.1:<port>
                                                    │
                                            ┌───────┴───────┐
                                            │   plugin.js   │  drives the WS, polls every 60s
                                            └──┬─────────┬──┘
                                               │         │
                                          render.js   usage.js
                                          (SVG icon)  (spawns ccusage)
```

Per the [Stream Deck WebSocket SDK](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/), the host launches `run.sh` with `-port`, `-pluginUUID`, `-registerEvent`, `-info` flags. `plugin.js` connects back, registers itself, tracks visible keys via `willAppear` / `willDisappear`, and pushes a fresh SVG to every visible key on a 60-second loop.

## Configuration

None. Both fill levels are derived from your ccusage history. If you have less than four weeks of usage data the weekly bar will pin near 100% until history builds up.

## Troubleshooting

Logs are written next to the installed plugin: `plugin.log` (and OpenDeck's own logs at `~/.config/opendeck/logs/`).

- **"no 'node' on PATH"** in `plugin.log` — install Node or expose your existing install to the host's spawn environment.
- **`ccusage … failed`** — make sure `~/.claude/projects/` exists and has at least one session JSONL. For Flatpak OpenDeck, check the filesystem overrides above.

## License

MIT — see [LICENSE](LICENSE).

## Author

Sander van Dragt &lt;sander@vandragt.com&gt; — <https://vandragt.com>
