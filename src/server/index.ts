/**
 * Fooztron server: command and event gateway
 *
 *   POST /api/commands   → validate via `decide`, append, broadcast
 *   GET  /api/events     → the full event log
 *   GET  /api/health     → liveness
 *   GET  /metrics        → Prometheus exposition format
 *   WS   /ws             → real-time event stream, presence, reactions
 */
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { DomainError, decide } from '../shared/decide.ts';
import { apply, project } from '../shared/projection.ts';
import type { Command, DomainEvent, WorldState } from '../shared/types.ts';
import type { ClientMessage, ServerMessage } from '../shared/wire.ts';
import { REACTIONS } from '../shared/wire.ts';
import { EventStore } from './eventStore.ts';
import { seed } from './seed.ts';

const PORT = Number(process.env.FOOZTRON_PORT ?? process.env.PORT ?? 4010);
const DB = process.env.FOOZTRON_DB ?? 'data/fooztron.db';
const DIST = resolve('dist');
const started = Date.now();

const store = new EventStore(DB);
if (store.count() === 0 && process.env.FOOZTRON_SEED !== 'none') {
  seed(store);
  console.log(`🌱 Empty database — seeded ${store.count()} demo events.`);
}

let world: WorldState = project(store.all());
const metrics = { commands: 0, rejected: 0, reactions: 0, wsMessages: 0 };

function handle(cmd: Command): DomainEvent[] {
  metrics.commands++;
  const events = store.append(decide(world, cmd, randomUUID));
  for (const e of events) world = apply(world, e);
  return events;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new DomainError('Request body too large.');
  }
  return JSON.parse(raw || '{}');
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) return json(res, 403, { error: 'Forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html'); // SPA fallback
  if (!existsSync(file)) return json(res, 404, { error: 'Run `npm run build` first, or use `npm run dev`.' });
  const immutable = file.includes(`${DIST}/assets/`);
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  try {
    if (path === '/api/health') return json(res, 200, { ok: true, version: world.version, uptime: (Date.now() - started) / 1000 });
    if (path === '/api/events' && req.method === 'GET') return json(res, 200, store.all());
    if (path === '/api/commands' && req.method === 'POST') {
      const events = handle((await readBody(req)) as Command);
      return json(res, 200, { ok: true, events });
    }
    if (path === '/metrics') {
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
      const finals = Object.values(world.matches).filter((m) => m.status === 'final');
      return res.end(
        [
          '# HELP fooztron_events_total Events in the log.',
          '# TYPE fooztron_events_total counter',
          `fooztron_events_total ${world.version}`,
          '# HELP fooztron_matches_total Finished matches.',
          '# TYPE fooztron_matches_total counter',
          `fooztron_matches_total ${finals.length}`,
          '# HELP fooztron_goals_total Goals scored, by side.',
          '# TYPE fooztron_goals_total counter',
          `fooztron_goals_total{side="white"} ${finals.reduce((n, m) => n + m.white, 0)}`,
          `fooztron_goals_total{side="blue"} ${finals.reduce((n, m) => n + m.blue, 0)}`,
          '# HELP fooztron_match_live Whether a match is in progress.',
          '# TYPE fooztron_match_live gauge',
          `fooztron_match_live ${world.liveMatchId ? 1 : 0}`,
          '# HELP fooztron_spectators Connected WebSocket clients.',
          '# TYPE fooztron_spectators gauge',
          `fooztron_spectators ${wss.clients.size}`,
          '# HELP fooztron_commands_total Commands received.',
          '# TYPE fooztron_commands_total counter',
          `fooztron_commands_total ${metrics.commands}`,
          `fooztron_commands_rejected_total ${metrics.rejected}`,
          `fooztron_reactions_total ${metrics.reactions}`,
          '',
        ].join('\n'),
      );
    }
    if (path.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
    return serveStatic(req, res);
  } catch (err) {
    if (err instanceof DomainError || err instanceof SyntaxError) {
      metrics.rejected++;
      return json(res, 422, { ok: false, error: err.message });
    }
    console.error(err);
    return json(res, 500, { ok: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// WebSockets
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server, path: '/ws' });
const send = (ws: WebSocket, msg: ServerMessage) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
const broadcast = (msg: ServerMessage) => {
  const raw = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(raw);
};
const broadcastPresence = () => broadcast({ kind: 'presence', spectators: wss.clients.size });

store.subscribe((events) => broadcast({ kind: 'events', events }));

const lastReaction = new WeakMap<WebSocket, number>();

wss.on('connection', (ws) => {
  send(ws, { kind: 'hello', events: store.all(), spectators: wss.clients.size, serverTime: new Date().toISOString() });
  broadcastPresence();
  ws.on('close', broadcastPresence);
  ws.on('message', (raw) => {
    metrics.wsMessages++;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.kind === 'command') {
      try {
        handle(msg.command);
        send(ws, { kind: 'ack', reqId: msg.reqId });
      } catch (err) {
        metrics.rejected++;
        send(ws, { kind: 'nack', reqId: msg.reqId, error: err instanceof Error ? err.message : 'Rejected' });
      }
    } else if (msg.kind === 'reaction' && REACTIONS.includes(msg.emoji)) {
      const now = Date.now();
      if (now - (lastReaction.get(ws) ?? 0) < 150) return; // rate limit per connection
      lastReaction.set(ws, now);
      metrics.reactions++;
      broadcast({ kind: 'reaction', emoji: msg.emoji, id: randomUUID() });
    } else if (msg.kind === 'ping') {
      send(ws, { kind: 'pong', t: msg.t });
    }
  });
});

server.listen(PORT, () => {
  console.log(`
  ███████╗ ██████╗  ██████╗ ███████╗████████╗██████╗  ██████╗ ███╗   ██╗
  ██╔════╝██╔═══██╗██╔═══██╗╚══███╔╝╚══██╔══╝██╔══██╗██╔═══██╗████╗  ██║
  █████╗  ██║   ██║██║   ██║  ███╔╝    ██║   ██████╔╝██║   ██║██╔██╗ ██║
  ██╔══╝  ██║   ██║██║   ██║ ███╔╝     ██║   ██╔══██╗██║   ██║██║╚██╗██║
  ██║     ╚██████╔╝╚██████╔╝███████╗   ██║   ██║  ██║╚██████╔╝██║ ╚████║  2
  ╚═╝      ╚═════╝  ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
  Real-time foosball scoring

  ➜  http://localhost:${PORT}   (${world.version} events, ${Object.keys(world.players).length} players)
`);
});

const shutdown = () => {
  wss.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
