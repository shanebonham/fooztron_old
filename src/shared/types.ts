/**
 * Fooztron domain types.
 *
 * Positions, sides and the first-to-10 rule are carried over unchanged from
 * Fooztron 1 so that historical semantics are preserved.
 */

export type Side = 'white' | 'blue';
export type Role = 'offense' | 'defense';
/** Same order as `PlayedPosition.as_enum :position` in Fooztron 1. */
export type Position = 'white_offense' | 'white_defense' | 'blue_offense' | 'blue_defense';
export const POSITIONS: readonly Position[] = ['white_offense', 'white_defense', 'blue_offense', 'blue_defense'];

/** The four rods a single side controls, from its own goal outward. */
export type Rod = 'goalie' | 'two_bar' | 'five_bar' | 'three_bar';
export const RODS: readonly Rod[] = ['goalie', 'two_bar', 'five_bar', 'three_bar'];
export const ROD_LABEL: Record<Rod, string> = {
  goalie: 'Goalie',
  two_bar: '2-Bar',
  five_bar: '5-Bar',
  three_bar: '3-Bar',
};
export const ROD_ROLE: Record<Rod, Role> = {
  goalie: 'defense',
  two_bar: 'defense',
  five_bar: 'offense',
  three_bar: 'offense',
};

export type Lineup = Record<Position, string>;

/** Matches end when either side reaches this score (Fooztron 1: `validate :one_score_must_be_ten`). */
export const WINNING_SCORE = 10;

export const sideOf = (p: Position): Side => p.split('_')[0] as Side;
export const roleOf = (p: Position): Role => p.split('_')[1] as Role;
export const pos = (side: Side, role: Role): Position => `${side}_${role}` as Position;
export const other = (s: Side): Side => (s === 'white' ? 'blue' : 'white');

// ---------------------------------------------------------------------------
// Events (the single source of truth — everything else is a projection)
// ---------------------------------------------------------------------------

interface EventBase {
  /** Monotonic sequence number assigned by the event store. */
  seq: number;
  /** ISO-8601 timestamp. */
  at: string;
}

export type DomainEvent = EventBase &
  (
    | { type: 'PlayerRegistered'; playerId: string; name: string; hue: number }
    | { type: 'PlayerRetired'; playerId: string } // Fooztron 1: `hidden = true`
    | { type: 'PlayerUnretired'; playerId: string }
    | { type: 'MatchStarted'; matchId: string; lineup: Lineup }
    | { type: 'GoalScored'; matchId: string; side: Side; rod: Rod }
    | { type: 'GoalRetracted'; matchId: string }
    | { type: 'MatchFinished'; matchId: string; winner: Side }
    | { type: 'MatchAbandoned'; matchId: string }
  );

export type EventType = DomainEvent['type'];
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewEvent = DistributiveOmit<DomainEvent, 'seq' | 'at'>;

// ---------------------------------------------------------------------------
// Commands (intent — may be rejected)
// ---------------------------------------------------------------------------

export type Command =
  | { type: 'RegisterPlayer'; name: string }
  | { type: 'RetirePlayer'; playerId: string }
  | { type: 'UnretirePlayer'; playerId: string }
  | { type: 'StartMatch'; lineup: Lineup }
  | { type: 'ScoreGoal'; matchId: string; side: Side; rod: Rod }
  | { type: 'RetractGoal'; matchId: string }
  | { type: 'AbandonMatch'; matchId: string };

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export interface Player {
  id: string;
  name: string;
  hue: number;
  retired: boolean;
  joinedAt: string;
}

export interface Goal {
  side: Side;
  rod: Rod;
  at: string;
  /** Position of the player credited, derived from which rod they control. */
  scorer: Position;
  white: number;
  blue: number;
}

export type MatchStatus = 'live' | 'final' | 'abandoned';

export interface Match {
  id: string;
  lineup: Lineup;
  startedAt: string;
  endedAt?: string;
  status: MatchStatus;
  goals: Goal[];
  white: number;
  blue: number;
  winner?: Side;
  /** Pre-match probability that white wins, frozen at kickoff. */
  whiteExpectation: number;
  /** Rating change per player id, filled in when the match is final. */
  ratingDelta: Record<string, number>;
}

export interface Rating {
  overall: number;
  offense: number;
  defense: number;
  peak: number;
  history: { matchId: string; at: string; rating: number }[];
}

export interface Unlock {
  achievementId: string;
  playerId: string;
  matchId: string;
  at: string;
}

export interface WorldState {
  /** Last applied sequence number. */
  version: number;
  players: Record<string, Player>;
  matches: Record<string, Match>;
  /** Match ids in chronological order of kickoff. */
  matchOrder: string[];
  liveMatchId: string | null;
  ratings: Record<string, Rating>;
  unlocks: Unlock[];
}
