# ADR 0001: Event sourcing

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Fooztron 1 stored final scores as columns on `games` and linked players through `played_positions`. Several planned features need information that model does not keep:

- goal-by-goal win probability
- match replays
- recomputing ratings when the rating formula changes
- correcting mis-recorded goals without losing the audit trail

## Decision

Store an append-only log of domain events (`MatchStarted`, `GoalScored`, `GoalRetracted`, `MatchFinished`, …) in SQLite. Derive all other state by folding the log with a pure `project()` function. Validate commands with a pure `decide()` function against the projected state.

The domain module (`src/shared`) runs on both server and client.

## Consequences

- Every derived view, including ratings, statistics and achievements, can be rebuilt from the log.
- Rating formula changes apply to all historical matches on the next start.
- Corrections are recorded as new events. History is never edited.
- The full log is replayed on start-up. At expected volumes this takes milliseconds. Snapshots can be added if that changes.
