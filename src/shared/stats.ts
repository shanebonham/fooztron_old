/**
 * Player and team statistics. Includes every statistic from the Fooztron 1
 * `Player` and `Team` models with identical semantics, plus newer metrics.
 */
import { careerOf, finishedMatches } from './projection.ts';
import type { Match, Player, Position, Role, Side, WorldState } from './types.ts';
import { POSITIONS, roleOf, sideOf } from './types.ts';

export interface PlayerStats {
  player: Player;
  rating: number;
  peak: number;
  offenseRating: number;
  defenseRating: number;
  games: number;
  wins: number;
  losses: number;
  /** `Player#record` — win fraction. */
  record: number;
  recordByRole: Record<Role, { games: number; wins: number; record: number }>;
  recordBySide: Record<Side, { games: number; wins: number; record: number }>;
  /** `Player#average_winning_spread` */
  averageWinningSpread: number;
  /** `Player#average_losing_spread` */
  averageLosingSpread: number;
  /** `Player#total_points_scored` (team points) */
  totalPointsScored: number;
  /** `Player#total_points_allowed` */
  totalPointsAllowed: number;
  /** `Player#average_points_allowed(true)` — only games on defense. */
  averagePointsAllowedOnDefense: number;
  /** Distinct defenders partnered while on offense (`teams_as_offense.count`). */
  partnersAsOffense: number;
  /** Distinct offenders partnered while on defense (`teams_as_defense.count`). */
  partnersAsDefense: number;
  /** Goals credited personally via rod ownership. */
  goalsCredited: number;
  streak: { kind: 'W' | 'L' | '-'; length: number };
  longestWinStreak: number;
  /** Win % adjusted for how often each colour wins overall. */
  colorWeightedRecord: number;
  form: ('W' | 'L')[];
  nemesis?: { id: string; losses: number };
  bestPartner?: { id: string; wins: number; games: number };
}

export interface TeamStats {
  key: string;
  offense: Player;
  defense: Player;
  games: number;
  wins: number;
  record: number;
}

const positionOf = (m: Match, id: string): Position => POSITIONS.find((p) => m.lineup[p] === id)!;
const partnerPos = (p: Position): Position => `${sideOf(p)}_${roleOf(p) === 'offense' ? 'defense' : 'offense'}` as Position;
const oppPositions = (p: Position): Position[] => POSITIONS.filter((q) => sideOf(q) !== sideOf(p));

export function colorWinRates(s: WorldState): Record<Side, number> {
  const ms = finishedMatches(s);
  const white = ms.filter((m) => m.winner === 'white').length;
  const n = ms.length || 1;
  return { white: white / n, blue: (ms.length - white) / n };
}

export function playerStats(s: WorldState, playerId: string): PlayerStats {
  const player = s.players[playerId];
  const rating = s.ratings[playerId];
  const career = careerOf(s, playerId);
  const colorRates = colorWinRates(s);

  let wins = 0;
  let winSpread = 0;
  let loseSpread = 0;
  let scored = 0;
  let allowed = 0;
  let defGames = 0;
  let defAllowed = 0;
  let credited = 0;
  let weightedWins = 0;
  let weightedGames = 0;
  const byRole = { offense: { games: 0, wins: 0, record: 0 }, defense: { games: 0, wins: 0, record: 0 } };
  const bySide = { white: { games: 0, wins: 0, record: 0 }, blue: { games: 0, wins: 0, record: 0 } };
  const partnersO = new Set<string>();
  const partnersD = new Set<string>();
  const lostTo = new Map<string, number>();
  const withPartner = new Map<string, { wins: number; games: number }>();
  const form: ('W' | 'L')[] = [];
  let longest = 0;
  let run = 0;

  for (const m of career) {
    const p = positionOf(m, playerId);
    const side = sideOf(p);
    const role = roleOf(p);
    const won = m.winner === side;
    const mine = side === 'white' ? m.white : m.blue;
    const theirs = side === 'white' ? m.blue : m.white;
    const spread = Math.abs(m.white - m.blue);

    byRole[role].games++;
    bySide[side].games++;
    scored += mine;
    allowed += theirs;
    if (role === 'defense') {
      defGames++;
      defAllowed += theirs;
      partnersD.add(m.lineup[partnerPos(p)]);
    } else {
      partnersO.add(m.lineup[partnerPos(p)]);
    }
    credited += m.goals.filter((g) => g.scorer === p).length;

    const partner = m.lineup[partnerPos(p)];
    const wp = withPartner.get(partner) ?? { wins: 0, games: 0 };
    wp.games++;

    // Weight: a win on the less-successful colour is worth more.
    const colorRate = colorRates[side] || 0.5;
    weightedGames += 0.5 / colorRate;
    if (won) {
      wins++;
      winSpread += spread;
      byRole[role].wins++;
      bySide[side].wins++;
      wp.wins++;
      weightedWins += 0.5 / colorRate;
      run++;
      longest = Math.max(longest, run);
    } else {
      loseSpread += spread;
      run = 0;
      for (const op of oppPositions(p)) lostTo.set(m.lineup[op], (lostTo.get(m.lineup[op]) ?? 0) + 1);
    }
    withPartner.set(partner, wp);
    form.push(won ? 'W' : 'L');
  }

  const games = career.length;
  const losses = games - wins;
  for (const r of [byRole.offense, byRole.defense, bySide.white, bySide.blue]) r.record = r.games ? r.wins / r.games : 0;

  let streak: PlayerStats['streak'] = { kind: '-', length: 0 };
  if (form.length) {
    const last = form[form.length - 1];
    let n = 0;
    for (let i = form.length - 1; i >= 0 && form[i] === last; i--) n++;
    streak = { kind: last, length: n };
  }

  const nemesis = [...lostTo.entries()].sort((a, b) => b[1] - a[1])[0];
  const best = [...withPartner.entries()]
    .filter(([, v]) => v.games >= 3)
    .sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games || b[1].games - a[1].games)[0];

  return {
    player,
    rating: rating?.overall ?? 1200,
    peak: rating?.peak ?? 1200,
    offenseRating: rating?.offense ?? 1200,
    defenseRating: rating?.defense ?? 1200,
    games,
    wins,
    losses,
    record: games ? wins / games : 0,
    recordByRole: byRole,
    recordBySide: bySide,
    averageWinningSpread: wins ? winSpread / wins : 0,
    averageLosingSpread: losses ? loseSpread / losses : 0,
    totalPointsScored: scored,
    totalPointsAllowed: allowed,
    averagePointsAllowedOnDefense: defGames ? defAllowed / defGames : 0,
    partnersAsOffense: partnersO.size,
    partnersAsDefense: partnersD.size,
    goalsCredited: credited,
    streak,
    longestWinStreak: longest,
    colorWeightedRecord: weightedGames ? weightedWins / weightedGames : 0,
    form: form.slice(-10),
    nemesis: nemesis ? { id: nemesis[0], losses: nemesis[1] } : undefined,
    bestPartner: best ? { id: best[0], ...best[1] } : undefined,
  };
}

export function allPlayerStats(s: WorldState, { includeRetired = false, minGames = 0 } = {}): PlayerStats[] {
  return Object.values(s.players)
    .filter((p) => includeRetired || !p.retired)
    .map((p) => playerStats(s, p.id))
    .filter((st) => st.games >= minGames);
}

export function teamStats(s: WorldState): TeamStats[] {
  const teams = new Map<string, TeamStats>();
  for (const m of finishedMatches(s)) {
    for (const side of ['white', 'blue'] as const) {
      const o = m.lineup[`${side}_offense`];
      const d = m.lineup[`${side}_defense`];
      const key = `${o}>${d}`;
      const t = teams.get(key) ?? { key, offense: s.players[o], defense: s.players[d], games: 0, wins: 0, record: 0 };
      t.games++;
      if (m.winner === side) t.wins++;
      t.record = t.wins / t.games;
      teams.set(key, t);
    }
  }
  return [...teams.values()];
}

export interface HeadToHead {
  games: number;
  aWins: number;
  bWins: number;
  matches: Match[];
}

/** Matches where a and b were on opposite sides. */
export function headToHead(s: WorldState, a: string, b: string): HeadToHead {
  const out: HeadToHead = { games: 0, aWins: 0, bWins: 0, matches: [] };
  for (const m of careerOf(s, a)) {
    const pb = POSITIONS.find((p) => m.lineup[p] === b);
    if (!pb) continue;
    const pa = positionOf(m, a);
    if (sideOf(pa) === sideOf(pb)) continue;
    out.games++;
    out.matches.push(m);
    if (m.winner === sideOf(pa)) out.aWins++;
    else out.bWins++;
  }
  return out;
}

/** Global records for the hall of fame. */
export function records(s: WorldState) {
  const ms = finishedMatches(s);
  const dur = (m: Match) => Date.parse(m.endedAt!) - Date.parse(m.startedAt);
  const byDuration = [...ms].sort((a, b) => dur(a) - dur(b));
  const rodCounts: Record<string, number> = {};
  for (const m of ms) for (const g of m.goals) rodCounts[g.rod] = (rodCounts[g.rod] ?? 0) + 1;
  const upset = [...ms].sort((a, b) => winnerExp(a) - winnerExp(b))[0];
  return {
    totalMatches: ms.length,
    totalGoals: ms.reduce((n, m) => n + m.white + m.blue, 0),
    skunks: ms.filter((m) => Math.min(m.white, m.blue) === 0).length,
    fastest: byDuration[0],
    longest: byDuration[byDuration.length - 1],
    biggestUpset: upset,
    rodCounts,
    colorRates: colorWinRates(s),
  };
}

export const winnerExp = (m: Match) => (m.winner === 'white' ? m.whiteExpectation : 1 - m.whiteExpectation);
