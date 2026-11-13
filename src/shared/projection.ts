/**
 * The Projector. Folds the immutable event log into a WorldState.
 *
 * Runs identically on the server (to validate commands) and in every browser
 * (to render). Pure and deterministic: same events in, same world out.
 */
import { ACHIEVEMENTS } from './achievements.ts';
import { freshRating, ratingDelta, whiteExpectation } from './rating.ts';
import type { DomainEvent, Goal, Match, Position, WorldState } from './types.ts';
import { POSITIONS, ROD_ROLE, roleOf, sideOf } from './types.ts';

export const emptyWorld = (): WorldState => ({
  version: 0,
  players: {},
  matches: {},
  matchOrder: [],
  liveMatchId: null,
  ratings: {},
  unlocks: [],
});

const clone = <T>(x: T): T => structuredClone(x);

export function project(events: readonly DomainEvent[], from: WorldState = emptyWorld()): WorldState {
  let s = from;
  for (const e of events) s = apply(s, e);
  return s;
}

/** Applies one event. Mutates a shallow copy for speed; callers should treat results as immutable. */
export function apply(prev: WorldState, e: DomainEvent): WorldState {
  if (e.seq <= prev.version) return prev; // idempotent replay
  const s: WorldState = { ...prev, version: e.seq };

  switch (e.type) {
    case 'PlayerRegistered': {
      s.players = { ...s.players, [e.playerId]: { id: e.playerId, name: e.name, hue: e.hue, retired: false, joinedAt: e.at } };
      s.ratings = { ...s.ratings, [e.playerId]: freshRating() };
      break;
    }
    case 'PlayerRetired':
    case 'PlayerUnretired': {
      const p = s.players[e.playerId];
      if (p) s.players = { ...s.players, [p.id]: { ...p, retired: e.type === 'PlayerRetired' } };
      break;
    }
    case 'MatchStarted': {
      const m: Match = {
        id: e.matchId,
        lineup: e.lineup,
        startedAt: e.at,
        status: 'live',
        goals: [],
        white: 0,
        blue: 0,
        whiteExpectation: whiteExpectation(s.ratings, e.lineup),
        ratingDelta: {},
      };
      s.matches = { ...s.matches, [m.id]: m };
      s.matchOrder = [...s.matchOrder, m.id];
      s.liveMatchId = m.id;
      break;
    }
    case 'GoalScored': {
      const m = s.matches[e.matchId];
      if (!m) break;
      const white = m.white + (e.side === 'white' ? 1 : 0);
      const blue = m.blue + (e.side === 'blue' ? 1 : 0);
      const scorer = `${e.side}_${ROD_ROLE[e.rod]}` as Position;
      const goal: Goal = { side: e.side, rod: e.rod, at: e.at, scorer, white, blue };
      s.matches = { ...s.matches, [m.id]: { ...m, white, blue, goals: [...m.goals, goal] } };
      break;
    }
    case 'GoalRetracted': {
      const m = s.matches[e.matchId];
      if (!m || m.goals.length === 0) break;
      const goals = m.goals.slice(0, -1);
      const last = goals[goals.length - 1];
      s.matches = { ...s.matches, [m.id]: { ...m, goals, white: last?.white ?? 0, blue: last?.blue ?? 0 } };
      break;
    }
    case 'MatchAbandoned': {
      const m = s.matches[e.matchId];
      if (!m) break;
      s.matches = { ...s.matches, [m.id]: { ...m, status: 'abandoned', endedAt: e.at } };
      if (s.liveMatchId === m.id) s.liveMatchId = null;
      break;
    }
    case 'MatchFinished': {
      const m0 = s.matches[e.matchId];
      if (!m0) break;
      const delta = ratingDelta(m0.whiteExpectation, m0.white, m0.blue);
      const ratings = { ...s.ratings };
      const ratingDeltaMap: Record<string, number> = {};
      for (const p of POSITIONS) {
        const id = m0.lineup[p];
        const d = sideOf(p) === 'white' ? delta : -delta;
        const r = clone(ratings[id] ?? freshRating());
        r.overall += d;
        r[roleOf(p)] += d;
        r.peak = Math.max(r.peak, r.overall);
        r.history = [...r.history, { matchId: m0.id, at: e.at, rating: r.overall }];
        ratings[id] = r;
        ratingDeltaMap[id] = d;
      }
      const m: Match = { ...m0, status: 'final', endedAt: e.at, winner: e.winner, ratingDelta: ratingDeltaMap };
      s.ratings = ratings;
      s.matches = { ...s.matches, [m.id]: m };
      if (s.liveMatchId === m.id) s.liveMatchId = null;

      // Achievement engine
      const unlocked = new Set(s.unlocks.map((u) => `${u.playerId}:${u.achievementId}`));
      const fresh = [];
      for (const p of POSITIONS) {
        const playerId = m.lineup[p];
        const career = careerOf(s, playerId);
        for (const a of ACHIEVEMENTS) {
          const key = `${playerId}:${a.id}`;
          if (unlocked.has(key)) continue;
          if (a.check({ state: s, match: m, playerId, position: p, won: sideOf(p) === m.winner, career })) {
            unlocked.add(key);
            fresh.push({ achievementId: a.id, playerId, matchId: m.id, at: e.at });
          }
        }
      }
      if (fresh.length) s.unlocks = [...s.unlocks, ...fresh];
      break;
    }
  }
  return s;
}

/** Finished matches for a player, oldest first. */
export function careerOf(s: WorldState, playerId: string): Match[] {
  const out: Match[] = [];
  for (const id of s.matchOrder) {
    const m = s.matches[id];
    if (m.status === 'final' && POSITIONS.some((p) => m.lineup[p] === playerId)) out.push(m);
  }
  return out;
}

export const finishedMatches = (s: WorldState): Match[] =>
  s.matchOrder.map((id) => s.matches[id]).filter((m) => m.status === 'final');
