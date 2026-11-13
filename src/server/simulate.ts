/**
 * Office foosball simulator. Simulates a few months of office foosball with a
 * hidden-skill model so the leaderboards have something to argue about.
 */
import { randomUUID } from 'node:crypto';
import type { Lineup, NewEvent, Rod, Side } from '../shared/types.ts';
import { POSITIONS, WINNING_SCORE } from '../shared/types.ts';

export const DEFAULT_ROSTER = [
  'Shane',
  'Etienne',
  'Daniel',
  'Maeve',
  'Tobias',
  'Yuki',
  'Dex',
  'Harriet',
  'Wendell',
  'Ines',
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROD_WEIGHTS: [Rod, number][] = [
  ['three_bar', 0.56],
  ['five_bar', 0.2],
  ['two_bar', 0.18],
  ['goalie', 0.06],
];

export function generateHistory(roster = DEFAULT_ROSTER, { matches = 180, days = 120, seed = 2012 } = {}) {
  const rand = mulberry32(seed);
  const events: (NewEvent & { at: string })[] = [];
  const start = Date.now() - days * 86_400_000;
  const iso = (t: number) => new Date(t).toISOString();

  const skill = new Map<string, { off: number; def: number; activity: number }>();
  const ids: string[] = [];
  roster.forEach((name, i) => {
    const id = randomUUID();
    ids.push(id);
    skill.set(id, { off: rand() * 2 - 1, def: rand() * 2 - 1, activity: 0.3 + rand() });
    events.push({ type: 'PlayerRegistered', playerId: id, name, hue: Math.round((i * 360) / roster.length + rand() * 20) % 360, at: iso(start - 86_400_000 + i * 60_000) });
  });

  const weightedPick = (exclude: Set<string>) => {
    const pool = ids.filter((id) => !exclude.has(id));
    const total = pool.reduce((n, id) => n + skill.get(id)!.activity, 0);
    let r = rand() * total;
    for (const id of pool) if ((r -= skill.get(id)!.activity) <= 0) return id;
    return pool[pool.length - 1];
  };

  let t = start;
  for (let i = 0; i < matches; i++) {
    // Advance to a plausible lunchtime/afternoon slot on a weekday.
    t += (days * 86_400_000) / matches * (0.5 + rand());
    const d = new Date(t);
    if (d.getDay() === 0 || d.getDay() === 6) t += 2 * 86_400_000;
    const day = new Date(t);
    day.setHours(11 + Math.floor(rand() * 7), Math.floor(rand() * 60), 0, 0);
    let clock = day.getTime();

    const chosen = new Set<string>();
    const four = Array.from({ length: 4 }, () => {
      const id = weightedPick(chosen);
      chosen.add(id);
      return id;
    });
    const lineup = Object.fromEntries(POSITIONS.map((p, k) => [p, four[k]])) as Lineup;
    const matchId = randomUUID();
    events.push({ type: 'MatchStarted', matchId, lineup, at: iso(clock) });

    const strength = (side: Side) => skill.get(lineup[`${side}_offense`])!.off + skill.get(lineup[`${side}_defense`])!.def;
    const pWhite = 1 / (1 + Math.exp(-(strength('white') - strength('blue')) * 0.9));
    let w = 0;
    let b = 0;
    const pace = 20_000 + rand() * 50_000;
    while (w < WINNING_SCORE && b < WINNING_SCORE) {
      clock += pace * (0.3 + rand() * 1.4);
      const side: Side = rand() < pWhite ? 'white' : 'blue';
      side === 'white' ? w++ : b++;
      let r = rand();
      const rod = ROD_WEIGHTS.find(([, wgt]) => (r -= wgt) <= 0)?.[0] ?? 'three_bar';
      events.push({ type: 'GoalScored', matchId, side, rod, at: iso(clock) });
    }
    events.push({ type: 'MatchFinished', matchId, winner: w > b ? 'white' : 'blue', at: iso(clock + 1000) });
    t = clock;
  }
  // Weekend-skipping can drift past "now"; slide the whole timeline so the last game ended yesterday-ish.
  const last = Date.parse(events[events.length - 1].at);
  const shift = Math.min(0, Date.now() - 20 * 3_600_000 - last);
  return events.map((e) => ({ ...e, at: iso(Date.parse(e.at) + shift) }));
}

