/**
 * Command → Event decision function. Business rules live here.
 * Throws DomainError when a command violates a rule.
 */
import type { Command, NewEvent, WorldState } from './types.ts';
import { POSITIONS, WINNING_SCORE } from './types.ts';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

const must = (cond: unknown, msg: string): void => {
  if (!cond) throw new DomainError(msg);
};

export function decide(s: WorldState, cmd: Command, newId: () => string): NewEvent[] {
  switch (cmd.type) {
    case 'RegisterPlayer': {
      const name = cmd.name?.trim();
      must(name, 'Player name is required.');
      must(name.length <= 32, 'Player names can be at most 32 characters.');
      const taken = Object.values(s.players).some((p) => p.name.toLowerCase() === name.toLowerCase());
      must(!taken, `A player named ${name} already exists.`);
      return [{ type: 'PlayerRegistered', playerId: newId(), name, hue: Math.floor(Math.random() * 360) }];
    }
    case 'RetirePlayer':
    case 'UnretirePlayer': {
      must(s.players[cmd.playerId], 'No such player.');
      return [{ type: cmd.type === 'RetirePlayer' ? 'PlayerRetired' : 'PlayerUnretired', playerId: cmd.playerId }];
    }
    case 'StartMatch': {
      must(!s.liveMatchId, 'A match is already in progress.');
      const ids = POSITIONS.map((p) => cmd.lineup?.[p]);
      must(ids.every((id) => id && s.players[id]), 'All four positions must be filled by registered players.');
      must(new Set(ids).size === 4, 'Each player can only fill one position.');
      must(ids.every((id) => !s.players[id!].retired), 'Retired players cannot be added to a match.');
      return [{ type: 'MatchStarted', matchId: newId(), lineup: cmd.lineup }];
    }
    case 'ScoreGoal': {
      const m = s.matches[cmd.matchId];
      must(m && m.status === 'live', 'That match is not live.');
      must(cmd.side === 'white' || cmd.side === 'blue', 'Side must be white or blue.');
      const out: NewEvent[] = [{ type: 'GoalScored', matchId: m.id, side: cmd.side, rod: cmd.rod ?? 'three_bar' }];
      const next = cmd.side === 'white' ? m.white + 1 : m.blue + 1;
      if (next >= WINNING_SCORE) out.push({ type: 'MatchFinished', matchId: m.id, winner: cmd.side });
      return out;
    }
    case 'RetractGoal': {
      const m = s.matches[cmd.matchId];
      must(m && m.status === 'live', 'Goals can only be undone during a live match.');
      must(m.goals.length > 0, 'There are no goals to undo.');
      return [{ type: 'GoalRetracted', matchId: m.id }];
    }
    case 'AbandonMatch': {
      const m = s.matches[cmd.matchId];
      must(m && m.status === 'live', 'That match is not live.');
      return [{ type: 'MatchAbandoned', matchId: m.id }];
    }
    default:
      throw new DomainError(`Unknown command ${(cmd as { type: string }).type}`);
  }
}
