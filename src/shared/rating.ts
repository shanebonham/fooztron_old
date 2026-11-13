/**
 * FoozRank: a positional, margin-aware Elo variant.
 *
 * Each player carries three ratings: overall, offense and defense. A side's
 * strength is the blend of its offense player's overall + offense rating and
 * its defense player's overall + defense rating. After the match every player
 * on a side moves by the same delta, scaled by the margin of victory so a
 * 10–0 skunk counts for more than a 10–9 squeaker.
 */
import type { Lineup, Rating, Side } from './types.ts';
import { WINNING_SCORE } from './types.ts';

export const BASE_RATING = 1200;
export const K_FACTOR = 32;

export const freshRating = (): Rating => ({
  overall: BASE_RATING,
  offense: BASE_RATING,
  defense: BASE_RATING,
  peak: BASE_RATING,
  history: [],
});

const get = (ratings: Record<string, Rating>, id: string) => ratings[id] ?? freshRating();

export function sideStrength(ratings: Record<string, Rating>, lineup: Lineup, side: Side): number {
  const o = get(ratings, lineup[`${side}_offense`]);
  const d = get(ratings, lineup[`${side}_defense`]);
  return (o.overall + o.offense + d.overall + d.defense) / 4;
}

/** Classic logistic expectation. */
export const expectation = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

export function whiteExpectation(ratings: Record<string, Rating>, lineup: Lineup): number {
  return expectation(sideStrength(ratings, lineup, 'white'), sideStrength(ratings, lineup, 'blue'));
}

/** Margin-of-victory multiplier, borrowed in spirit from FiveThirtyEight's NFL Elo. */
export const movMultiplier = (spread: number) => Math.log(spread + 1) / Math.log(WINNING_SCORE / 2 + 1);

/** Delta applied to each white player (blue gets the negation). */
export function ratingDelta(whiteExp: number, white: number, blue: number): number {
  const actual = white > blue ? 1 : 0;
  const spread = Math.abs(white - blue);
  return K_FACTOR * movMultiplier(spread) * (actual - whiteExp);
}

// ---------------------------------------------------------------------------
// Live win probability
// ---------------------------------------------------------------------------

const choose = (() => {
  const memo = new Map<string, number>();
  return (n: number, k: number): number => {
    if (k < 0 || k > n) return 0;
    const key = `${n},${k}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    memo.set(key, r);
    return r;
  };
})();

/**
 * Probability white wins a race where white needs `a` more goals and blue
 * needs `b`, given each goal independently goes to white with probability p.
 * (Negative binomial: white's a-th goal arrives before blue's b-th.)
 */
export function raceProbability(a: number, b: number, p: number): number {
  if (a <= 0) return 1;
  if (b <= 0) return 0;
  let sum = 0;
  for (let k = 0; k < b; k++) sum += choose(a - 1 + k, k) * Math.pow(p, a) * Math.pow(1 - p, k);
  return Math.min(1, Math.max(0, sum));
}

/** Invert the race-to-10 so the per-goal p reproduces the pre-match Elo expectation. */
export function perGoalProbability(matchExpectation: number): number {
  let lo = 0.0001;
  let hi = 0.9999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (raceProbability(WINNING_SCORE, WINNING_SCORE, mid) < matchExpectation) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** P(white wins) given the pre-match expectation and the current score. */
export function liveWinProbability(matchExpectation: number, white: number, blue: number): number {
  const p = perGoalProbability(matchExpectation);
  return raceProbability(WINNING_SCORE - white, WINNING_SCORE - blue, p);
}
