#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { renderGauge } = require('./render.js');
const { getUsage } = require('./usage.js');

const LOG_PATH = path.join(__dirname, 'plugin.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n';
  try { fs.appendFileSync(LOG_PATH, line); } catch {}
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('-') && i + 1 < argv.length) {
      out[a.replace(/^-+/, '')] = argv[++i];
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const port = Number(args.port);
const pluginUUID = args.pluginUUID;
const registerEvent = args.registerEvent;

if (!port || !pluginUUID || !registerEvent) {
  log('missing args, exiting', args);
  process.exit(1);
}

log('starting', { port, pluginUUID, registerEvent });

const ws = new WebSocket(`ws://127.0.0.1:${port}`);
const contexts = new Set();
let cached = { sessionPct: 0, weeklyPct: 0 };

function send(msg) {
  try {
    ws.send(JSON.stringify(msg));
  } catch (e) {
    log('send failed', e.message);
  }
}

function drawAll() {
  const image = renderGauge(cached);
  for (const context of contexts) {
    send({ event: 'setImage', context, payload: { image, target: 0 } });
  }
}

async function refresh() {
  try {
    const u = await getUsage();
    cached = { sessionPct: u.sessionPct, weeklyPct: u.weeklyPct };
    log('usage', cached);
    drawAll();
  } catch (e) {
    log('refresh failed', e.message);
  }
}

ws.on('open', () => {
  log('ws open');
  send({ event: registerEvent, uuid: pluginUUID });
  refresh();
  setInterval(refresh, 60_000);
});

ws.on('message', (data) => {
  let evt;
  try { evt = JSON.parse(data.toString()); } catch { return; }
  log('event', evt.event, evt.context || '');

  if (evt.event === 'willAppear') {
    contexts.add(evt.context);
    send({ event: 'setImage', context: evt.context, payload: { image: renderGauge(cached), target: 0 } });
  } else if (evt.event === 'willDisappear') {
    contexts.delete(evt.context);
  } else if (evt.event === 'keyDown') {
    refresh();
  }
});

ws.on('close', () => { log('ws close'); process.exit(0); });
ws.on('error', (e) => { log('ws error', e.message); });
