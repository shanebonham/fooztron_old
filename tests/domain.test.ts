import { describe, expect, it } from 'vitest';
import { goalLines, kickoffLine } from '../src/shared/announcer.ts';
import { DomainError, decide } from '../src/shared/decide.ts';
import { project } from '../src/shared/projection.ts';
import { BASE_RATING, liveWinProbability, perGoalProbability, raceProbability, ratingDelta } from '../src/shared/rating.ts';
import { headToHead, playerStats, teamStats } from '../src/shared/stats.ts';
import type { Command, DomainEvent, Lineup, Side, WorldState } from '../src/shared/types.ts';
import { generateHistory } from '../src/server/simulate.ts';

/** Tiny in-memory command bus for tests. */
function harness() {
  let events: DomainEvent[] = [];
  let world: WorldState = project([]);
  let n = 0;
  const id = () => `id-${++n}`;
  const run = (cmd: Command) => {
    const fresh = decide(world, cmd, id).map((e, i) => ({ ...e, seq: events.length + i + 1, at: new Date(Date.UTC(2026, 0, 1, 12, 0, events.length + i)).toISOString() }) as DomainEvent);
    events = [...events, ...fresh];
    world = project(fresh, world);
    return fresh;
  };
  return { run, get world() { return world; }, get events() { return events; } };
}

function withFour() {
  const h = harness();
  const ids = ['Shane', 'Etienne', 'Ada', 'Grace'].map((name) => {
    const [e] = h.run({ type: 'RegisterPlayer', name });
    return (e as Extract<DomainEvent, { type: 'PlayerRegistered' }>).playerId;
  });
  const lineup: Lineup = { white_offense: ids[0], white_defense: ids[1], blue_offense: ids[2], blue_defense: ids[3] };
  return { h, ids, lineup };
}

function playTo(h: ReturnType<typeof harness>, matchId: string, sequence: Side[]) {
  for (const side of sequence) h.run({ type: 'ScoreGoal', matchId, side, rod: 'three_bar' });
}

describe('decide()', () => {
  it('rejects duplicate player names (case-insensitively)', () => {
    const { h } = withFour();
    expect(() => h.run({ type: 'RegisterPlayer', name: 'shane' })).toThrow(DomainError);
  });

  it('rejects a lineup where one player fills two positions', () => {
    const { h, ids } = withFour();
    expect(() =>
      h.run({ type: 'StartMatch', lineup: { white_offense: ids[0], white_defense: ids[0], blue_offense: ids[2], blue_defense: ids[3] } }),
    ).toThrow(/one position/);
  });

  it('only allows one live match at a time', () => {
    const { h, lineup } = withFour();
    h.run({ type: 'StartMatch', lineup });
    expect(() => h.run({ type: 'StartMatch', lineup })).toThrow(/already in progress/);
  });

  it('ends the match automatically at 10', () => {
    const { h, lineup } = withFour();
    const [start] = h.run({ type: 'StartMatch', lineup });
    const matchId = (start as Extract<DomainEvent, { type: 'MatchStarted' }>).matchId;
    playTo(h, matchId, [...Array(9).fill('blue'), ...Array(10).fill('white')]);
    const m = h.world.matches[matchId];
    expect(m.status).toBe('final');
    expect([m.white, m.blue]).toEqual([10, 9]);
    expect(m.winner).toBe('white');
    expect(h.world.liveMatchId).toBeNull();
    expect(() => h.run({ type: 'ScoreGoal', matchId, side: 'blue', rod: 'goalie' })).toThrow(/not live/);
  });

  it('retracts goals', () => {
    const { h, lineup } = withFour();
    const [start] = h.run({ type: 'StartMatch', lineup });
    const matchId = (start as Extract<DomainEvent, { type: 'MatchStarted' }>).matchId;
    playTo(h, matchId, ['white', 'blue', 'blue']);
    h.run({ type: 'RetractGoal', matchId });
    expect([h.world.matches[matchId].white, h.world.matches[matchId].blue]).toEqual([1, 1]);
  });
});

describe('FoozRank', () => {
  it('a race between equals is a coin flip', () => {
    expect(raceProbability(10, 10, 0.5)).toBeCloseTo(0.5, 10);
  });

  it('perGoalProbability inverts the race', () => {
    for (const e of [0.1, 0.35, 0.5, 0.8]) expect(raceProbability(10, 10, perGoalProbability(e))).toBeCloseTo(e, 6);
  });

  it('live win probability moves with the score', () => {
    expect(liveWinProbability(0.5, 9, 0)).toBeGreaterThan(0.99);
    expect(liveWinProbability(0.5, 0, 9)).toBeLessThan(0.01);
    expect(liveWinProbability(0.5, 5, 5)).toBeCloseTo(0.5, 6);
  });

  it('skunks are worth more than squeakers, upsets more than expected wins', () => {
    expect(ratingDelta(0.5, 10, 0)).toBeGreaterThan(ratingDelta(0.5, 10, 9));
    expect(ratingDelta(0.2, 10, 5)).toBeGreaterThan(ratingDelta(0.8, 10, 5));
    expect(ratingDelta(0.5, 3, 10)).toBeLessThan(0);
  });

  it('is zero-sum across the table', () => {
    const { h, lineup, ids } = withFour();
    const [start] = h.run({ type: 'StartMatch', lineup });
    playTo(h, (start as Extract<DomainEvent, { type: 'MatchStarted' }>).matchId, Array(10).fill('blue'));
    const total = ids.reduce((n, id) => n + h.world.ratings[id].overall, 0);
    expect(total).toBeCloseTo(4 * BASE_RATING, 8);
  });
});

describe('version 1 stats', () => {
  it('computes record, spreads, partners and team record', () => {
    const { h, lineup, ids } = withFour();
    const play = (l: Lineup, seq: Side[]) => {
      const [s] = h.run({ type: 'StartMatch', lineup: l });
      playTo(h, (s as Extract<DomainEvent, { type: 'MatchStarted' }>).matchId, seq);
    };
    play(lineup, Array(10).fill('white')); // Shane/Etienne win 10-0
    play(lineup, [...Array(5).fill('white'), ...Array(10).fill('blue')]); // lose 5-10
    play({ ...lineup, white_defense: ids[2], blue_offense: ids[1] }, [...Array(8).fill('blue'), ...Array(10).fill('white')]); // win 10-8 with Ada

    const shane = playerStats(h.world, ids[0]);
    expect(shane.games).toBe(3);
    expect(shane.wins).toBe(2);
    expect(shane.record).toBeCloseTo(2 / 3);
    expect(shane.averageWinningSpread).toBeCloseTo((10 + 2) / 2);
    expect(shane.averageLosingSpread).toBe(5);
    expect(shane.totalPointsScored).toBe(25);
    expect(shane.partnersAsOffense).toBe(2);
    expect(shane.streak).toEqual({ kind: 'W', length: 1 });

    const team = teamStats(h.world).find((t) => t.offense.id === ids[0] && t.defense.id === ids[1])!;
    expect(team.games).toBe(2);
    expect(team.record).toBe(0.5);

    expect(headToHead(h.world, ids[0], ids[3]).games).toBe(3);

    const unlocked = h.world.unlocks.filter((u) => u.playerId === ids[0]).map((u) => u.achievementId);
    expect(unlocked).toContain('skunk');
    expect(unlocked).toContain('first-blood');
    expect(unlocked).toContain('founding');
  });
});

describe('announcer', () => {
  it('narrates kickoffs, goals and wins', () => {
    const { h, lineup } = withFour();
    const [s] = h.run({ type: 'StartMatch', lineup });
    const matchId = (s as Extract<DomainEvent, { type: 'MatchStarted' }>).matchId;
    expect(kickoffLine(h.world.matches[matchId], h.world.players)).toMatch(/Shane/);
    playTo(h, matchId, Array(10).fill('blue'));
    const lines = goalLines(h.world.matches[matchId], h.world.players);
    expect(lines.join(' ')).toMatch(/skunk/i);
  });
});

describe('seed simulator', () => {
  it('produces a projectable, valid history', () => {
    const raw = generateHistory(undefined, { matches: 40 });
    const events = raw.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent);
    const world = project(events);
    const finals = Object.values(world.matches).filter((m) => m.status === 'final');
    expect(finals.length).toBe(40);
    for (const m of finals) expect(Math.max(m.white, m.blue)).toBe(10);
  });
});
