/**
 * Play-by-play commentary generated from match state. Deterministic for a
 * given seed.
 */
import type { Match, Player } from './types.ts';
import { ROD_LABEL, WINNING_SCORE, other } from './types.ts';

const pick = <T>(xs: readonly T[], seed: number) => xs[Math.abs(Math.floor(seed)) % xs.length];

const GOAL_LINES = [
  '{scorer} with the {rod} — GOAL!',
  'OH MY. {scorer} from the {rod}. Unstoppable.',
  'Rattled the back of the net! {scorer}!',
  '{scorer} finds the corner. Goal.',
  'Clinical finish from {scorer}.',
  'The {rod} delivers! {scorer} with the finish!',
  '{scorer} threads the needle!',
  '{scorer} beats {victim}. Goal.',
];
const GOALIE_LINES = [
  'From the goalie rod! {scorer} scores the length of the table!',
  'A full-table strike from {scorer}!',
];
const MATCH_POINT = ['Match point, {side}!', '{side} is one goal from glory.', 'Next goal wins it for {side}!'];
const TIED = ['All square at {score}.', 'Dead even, {score}.', 'Tied up at {score}. Tension.'];
const SKUNK_WATCH = ['{side} is still looking for a first goal.', 'Skunk watch for {side}.'];
const COMEBACK = ['{side} are clawing back!', 'Do not count out {side}!'];
const WIN_LINES = [
  '{side} wins it, {score}! {o} and {d}, take a bow.',
  'Game over! {o} and {d} take it {score}.',
  'That is the match! {side} — {score}.',
];
const SKUNK_WIN = ['A skunk! {side} wins {score}!', 'Ten to nothing. {o} and {d} with a shutout.'];
const KICKOFF = [
  'Welcome to Fooztron. {wo} and {wd} on white, {bo} and {bd} on blue. The model gives white {pct} percent.',
  'Tonight’s main event: {wo} and {wd} versus {bo} and {bd}. Win probability: white {pct} percent.',
];

const fill = (t: string, vars: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const sideName = (s: 'white' | 'blue') => (s === 'white' ? 'White' : 'Blue');

export function kickoffLine(m: Match, players: Record<string, Player>, seed = 0): string {
  const n = (pos: keyof Match['lineup']) => players[m.lineup[pos]]?.name ?? '???';
  return fill(pick(KICKOFF, seed), {
    wo: n('white_offense'),
    wd: n('white_defense'),
    bo: n('blue_offense'),
    bd: n('blue_defense'),
    pct: Math.round(m.whiteExpectation * 100),
  });
}

/** Commentary for the latest goal in `m`. Returns 1–2 lines. */
export function goalLines(m: Match, players: Record<string, Player>, seed = m.goals.length): string[] {
  const g = m.goals[m.goals.length - 1];
  if (!g) return [];
  const scorer = players[m.lineup[g.scorer]]?.name ?? 'Somebody';
  const victimPos = `${other(g.side)}_defense` as const;
  const victim = players[m.lineup[victimPos]]?.name ?? 'the defense';
  const lines = [fill(pick(g.rod === 'goalie' ? GOALIE_LINES : GOAL_LINES, seed), { scorer, rod: ROD_LABEL[g.rod], victim })];
  const score = `${Math.max(g.white, g.blue)} to ${Math.min(g.white, g.blue)}`;

  if (g.white === WINNING_SCORE || g.blue === WINNING_SCORE) {
    const side = g.white === WINNING_SCORE ? 'white' : 'blue';
    const o = players[m.lineup[`${side}_offense`]]?.name;
    const d = players[m.lineup[`${side}_defense`]]?.name;
    const skunk = Math.min(g.white, g.blue) === 0;
    lines.push(fill(pick(skunk ? SKUNK_WIN : WIN_LINES, seed), { side: sideName(side), score, o: o ?? '', d: d ?? '' }));
  } else if (g.white === WINNING_SCORE - 1 || g.blue === WINNING_SCORE - 1) {
    const side = g.white === WINNING_SCORE - 1 && g.side === 'white' ? 'white' : g.blue === WINNING_SCORE - 1 && g.side === 'blue' ? 'blue' : null;
    if (side) lines.push(fill(pick(MATCH_POINT, seed), { side: sideName(side) }));
  } else if (g.white === g.blue) {
    lines.push(fill(pick(TIED, seed), { score: g.white }));
  } else if (Math.min(g.white, g.blue) === 0 && Math.max(g.white, g.blue) >= 6) {
    lines.push(fill(pick(SKUNK_WATCH, seed), { side: sideName(g.white === 0 ? 'white' : 'blue') }));
  } else {
    const prev = m.goals[m.goals.length - 2];
    if (prev && prev.side === g.side && m.goals.length >= 3) {
      const trailing = g.white < g.blue ? 'white' : g.blue < g.white ? 'blue' : null;
      if (trailing === g.side) lines.push(fill(pick(COMEBACK, seed), { side: sideName(g.side) }));
    }
  }
  return lines;
}
