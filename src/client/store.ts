/**
 * Client state: a live replica of the event log, projected locally.
 * The server is the source of truth; every browser is a read model.
 */
import { create } from 'zustand';
import { apply, project } from '../shared/projection.ts';
import type { Command, DomainEvent, Side, Rod, Unlock, WorldState } from '../shared/types.ts';
import type { ClientMessage, Reaction, ServerMessage } from '../shared/wire.ts';

export type ConnState = 'connecting' | 'live' | 'reconnecting';

export interface GoalSignal {
  seq: number;
  matchId: string;
  side: Side;
  rod: Rod;
}

export interface Toast {
  id: string;
  title: string;
  body?: string;
  emoji?: string;
  tone?: 'info' | 'error' | 'achievement' | 'win';
}

interface Store {
  world: WorldState;
  ready: boolean;
  conn: ConnState;
  spectators: number;
  latency: number | null;
  /** Bumped whenever a live goal arrives (not on initial load). */
  lastGoal: GoalSignal | null;
  /** Bumped on live kickoff / finish so effects can fire. */
  lastKickoff: { seq: number; matchId: string } | null;
  lastFinish: { seq: number; matchId: string } | null;
  lastUnlocks: Unlock[];
  reactions: { id: string; emoji: Reaction; x: number }[];
  toasts: Toast[];
  send: (command: Command) => Promise<void>;
  react: (emoji: Reaction) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

let socket: WebSocket | null = null;
const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
let toastSeq = 0;

export const useStore = create<Store>((set, get) => ({
  world: project([]),
  ready: false,
  conn: 'connecting',
  spectators: 0,
  latency: null,
  lastGoal: null,
  lastKickoff: null,
  lastFinish: null,
  lastUnlocks: [],
  reactions: [],
  toasts: [],

  send: (command) =>
    new Promise<void>((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        // Fall back to HTTP when the socket is down.
        fetch('/api/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) })
          .then((r) => r.json())
          .then((r) => (r.ok ? resolve() : reject(new Error(r.error))))
          .catch(reject);
        return;
      }
      const reqId = crypto.randomUUID();
      pending.set(reqId, { resolve, reject });
      wsSend({ kind: 'command', reqId, command });
    }).catch((err: Error) => {
      get().toast({ title: 'Couldn’t complete that', body: err.message, emoji: '🙅', tone: 'error' });
      throw err;
    }) as Promise<void>,

  react: (emoji) => wsSend({ kind: 'reaction', emoji }),

  toast: (t) => {
    const id = `t${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), t.tone === 'achievement' ? 6000 : 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function wsSend(msg: ClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function ingest(events: DomainEvent[]) {
  const s = useStore.getState();
  let world = s.world;
  const beforeUnlocks = world.unlocks.length;
  let lastGoal = s.lastGoal;
  let lastKickoff = s.lastKickoff;
  let lastFinish = s.lastFinish;
  for (const e of events) {
    if (e.seq <= world.version) continue;
    world = apply(world, e);
    if (e.type === 'GoalScored') lastGoal = { seq: e.seq, matchId: e.matchId, side: e.side, rod: e.rod };
    if (e.type === 'MatchStarted') lastKickoff = { seq: e.seq, matchId: e.matchId };
    if (e.type === 'MatchFinished') lastFinish = { seq: e.seq, matchId: e.matchId };
  }
  useStore.setState({ world, lastGoal, lastKickoff, lastFinish, lastUnlocks: world.unlocks.slice(beforeUnlocks) });
}

let backoff = 500;
export function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}/ws`);
  socket.onopen = () => {
    backoff = 500;
    useStore.setState({ conn: 'live' });
  };
  socket.onclose = () => {
    useStore.setState({ conn: 'reconnecting' });
    for (const p of pending.values()) p.reject(new Error('Connection lost mid-command. Try again.'));
    pending.clear();
    setTimeout(connect, (backoff = Math.min(backoff * 2, 8000)));
  };
  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data) as ServerMessage;
    switch (msg.kind) {
      case 'hello': {
        const s = useStore.getState();
        // Full resync: if we've never loaded, or the server's log is shorter (reset), rebuild.
        const max = msg.events.at(-1)?.seq ?? 0;
        if (!s.ready || max < s.world.version) useStore.setState({ world: project(msg.events), ready: true });
        else ingest(msg.events);
        useStore.setState({ spectators: msg.spectators });
        break;
      }
      case 'events':
        ingest(msg.events);
        break;
      case 'presence':
        useStore.setState({ spectators: msg.spectators });
        break;
      case 'reaction': {
        const r = { id: msg.id, emoji: msg.emoji, x: 5 + Math.random() * 90 };
        useStore.setState((s) => ({ reactions: [...s.reactions.slice(-40), r] }));
        setTimeout(() => useStore.setState((s) => ({ reactions: s.reactions.filter((x) => x.id !== r.id) })), 3200);
        break;
      }
      case 'ack':
        pending.get(msg.reqId)?.resolve();
        pending.delete(msg.reqId);
        break;
      case 'nack':
        pending.get(msg.reqId)?.reject(new Error(msg.error));
        pending.delete(msg.reqId);
        break;
      case 'pong':
        useStore.setState({ latency: Math.round(performance.now() - msg.t) });
        break;
    }
  };
}

setInterval(() => wsSend({ kind: 'ping', t: performance.now() }), 5000);
