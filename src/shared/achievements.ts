import type { Match, Position, WorldState } from './types.ts';
import { POSITIONS, WINNING_SCORE, other, roleOf, sideOf } from './types.ts';

export interface AchievementContext {
  state: WorldState;
  match: Match;
  playerId: string;
  position: Position;
  won: boolean;
  /** This player's finished matches, oldest first, including the current one. */
  career: Match[];
}

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  check: (ctx: AchievementContext) => boolean;
}

const myScore = (m: Match, p: Position) => (sideOf(p) === 'white' ? m.white : m.blue);
const theirScore = (m: Match, p: Position) => (sideOf(p) === 'white' ? m.blue : m.white);
const positionIn = (m: Match, playerId: string) => POSITIONS.find((p) => m.lineup[p] === playerId)!;
const didWin = (m: Match, playerId: string) => m.winner === sideOf(positionIn(m, playerId));

function maxDeficit(m: Match, p: Position): number {
  const me = sideOf(p);
  let worst = 0;
  for (const g of m.goals) worst = Math.max(worst, me === 'white' ? g.blue - g.white : g.white - g.blue);
  return worst;
}

function currentStreak(career: Match[], playerId: string): number {
  let n = 0;
  for (let i = career.length - 1; i >= 0 && didWin(career[i], playerId); i--) n++;
  return n;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-blood',
    emoji: '🩸',
    name: 'First Blood',
    description: 'Win your first match.',
    rarity: 'common',
    check: ({ won, career, playerId }) => won && career.filter((m) => didWin(m, playerId)).length === 1,
  },
  {
    id: 'skunk',
    emoji: '🦨',
    name: 'Skunk',
    description: 'Win 10–0.',
    rarity: 'epic',
    check: ({ won, match, position }) => won && theirScore(match, position) === 0,
  },
  {
    id: 'skunked',
    emoji: '🫠',
    name: 'Under The Table',
    description: 'Lose 0–10.',
    rarity: 'rare',
    check: ({ won, match, position }) => !won && myScore(match, position) === 0,
  },
  {
    id: 'ice-cold',
    emoji: '🧊',
    name: 'Ice Cold',
    description: 'Win 10–9.',
    rarity: 'common',
    check: ({ won, match, position }) => won && theirScore(match, position) === WINNING_SCORE - 1,
  },
  {
    id: 'comeback',
    emoji: '🧟',
    name: 'Comeback Kid',
    description: 'Win after trailing by 5 or more.',
    rarity: 'epic',
    check: ({ won, match, position }) => won && maxDeficit(match, position) >= 5,
  },
  {
    id: 'brick-wall',
    emoji: '🧱',
    name: 'Brick Wall',
    description: 'Win on defense while allowing 3 or fewer.',
    rarity: 'rare',
    check: ({ won, match, position }) => won && roleOf(position) === 'defense' && theirScore(match, position) <= 3,
  },
  {
    id: 'goalie-goal',
    emoji: '🚀',
    name: 'Cross-Table Missile',
    description: 'Score from the goalie rod.',
    rarity: 'rare',
    check: ({ match, position }) =>
      match.goals.some((g) => g.side === sideOf(position) && g.rod === 'goalie') && roleOf(position) === 'defense',
  },
  {
    id: 'hat-trick',
    emoji: '🎩',
    name: 'Hat Trick',
    description: 'Score three consecutive 3-bar goals while playing offense.',
    rarity: 'common',
    check: ({ match, position }) => {
      if (roleOf(position) !== 'offense') return false;
      let run = 0;
      for (const g of match.goals) {
        run = g.side === sideOf(position) && g.rod === 'three_bar' ? run + 1 : 0;
        if (run >= 3) return true;
      }
      return false;
    },
  },
  {
    id: 'on-fire',
    emoji: '🔥',
    name: 'Heating Up',
    description: 'Win 5 in a row.',
    rarity: 'rare',
    check: ({ career, playerId }) => currentStreak(career, playerId) === 5,
  },
  {
    id: 'on-fire-10',
    emoji: '☄️',
    name: 'On Fire',
    description: 'Win 10 in a row.',
    rarity: 'legendary',
    check: ({ career, playerId }) => currentStreak(career, playerId) === 10,
  },
  {
    id: 'promiscuous',
    emoji: '💋',
    name: 'Most Promiscuous',
    description: 'Partner with 5 different teammates.',
    rarity: 'rare',
    check: ({ career, playerId }) => {
      const partners = new Set<string>();
      for (const m of career) {
        const p = positionIn(m, playerId);
        partners.add(m.lineup[`${sideOf(p)}_${roleOf(p) === 'offense' ? 'defense' : 'offense'}`]);
      }
      return partners.size === 5;
    },
  },
  {
    id: 'speedrun',
    emoji: '⏱️',
    name: 'Lightning Round',
    description: 'Win a match in under 3 minutes.',
    rarity: 'rare',
    check: ({ won, match }) =>
      won && !!match.endedAt && Date.parse(match.endedAt) - Date.parse(match.startedAt) < 3 * 60_000,
  },
  {
    id: 'marathon',
    emoji: '🐢',
    name: 'Marathon',
    description: 'Play a match lasting over 15 minutes.',
    rarity: 'common',
    check: ({ match }) => !!match.endedAt && Date.parse(match.endedAt) - Date.parse(match.startedAt) > 15 * 60_000,
  },
  {
    id: 'giant-slayer',
    emoji: '🗡️',
    name: 'Giant Slayer',
    description: 'Win with less than a 25% pre-match chance.',
    rarity: 'epic',
    check: ({ won, match, position }) => {
      const exp = sideOf(position) === 'white' ? match.whiteExpectation : 1 - match.whiteExpectation;
      return won && exp < 0.25;
    },
  },
  {
    id: 'choke',
    emoji: '🍾',
    name: 'Bottled It',
    description: 'Lose after leading by 5 or more.',
    rarity: 'rare',
    check: ({ won, match, position }) => !won && maxDeficit(match, positionFor(other(sideOf(position)))) >= 5,
  },
  {
    id: 'founding',
    emoji: '🏛️',
    name: 'Founding Member',
    description: 'Played in the first match ever recorded on Fooztron 2.',
    rarity: 'legendary',
    check: ({ state, match }) => state.matchOrder[0] === match.id,
  },
  {
    id: 'centurion',
    emoji: '💯',
    name: 'Centurion',
    description: 'Play 100 matches.',
    rarity: 'epic',
    check: ({ career }) => career.length === 100,
  },
  {
    id: 'half-k',
    emoji: '🧓',
    name: 'Seasoned Veteran',
    description: 'Play 50 matches.',
    rarity: 'rare',
    check: ({ career }) => career.length === 50,
  },
];

function positionFor(side: 'white' | 'blue'): Position {
  return `${side}_offense`;
}

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
