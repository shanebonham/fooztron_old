/** WebSocket protocol shared by server and client. */
import type { Command, DomainEvent } from './types.ts';

export const REACTIONS = ['🔥', '😱', '👏', '🦨', '💀', '🎉', '😂', '🧊'] as const;
export type Reaction = (typeof REACTIONS)[number];

export type ClientMessage =
  | { kind: 'command'; reqId: string; command: Command }
  | { kind: 'reaction'; emoji: Reaction }
  | { kind: 'ping'; t: number };

export type ServerMessage =
  | { kind: 'hello'; events: DomainEvent[]; spectators: number; serverTime: string }
  | { kind: 'events'; events: DomainEvent[] }
  | { kind: 'presence'; spectators: number }
  | { kind: 'reaction'; emoji: Reaction; id: string }
  | { kind: 'ack'; reqId: string }
  | { kind: 'nack'; reqId: string; error: string }
  | { kind: 'pong'; t: number };
