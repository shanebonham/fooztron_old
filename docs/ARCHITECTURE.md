# Architecture

## Principles

1. **The event log is the truth.** Everything else is a cache that can be rebuilt by replaying it.
2. **One domain, two runtimes.** `src/shared` runs unchanged on the server (to validate) and in the browser (to render).
3. **Every screen is live.** No polling and no refresh buttons.
4. **Compatibility with version 1.** Match rules, positions and leaderboard semantics are unchanged.

## Write path

```
client ──ScoreGoal──▶ server.handle()
                         │
                         ├─ decide(world, cmd) ──▶ NewEvent[]   (throws DomainError on rule violations)
                         ├─ store.append(events)  ─▶ SQLite, one transaction, assigns seq + timestamp
                         ├─ world = apply(world, e) for each
                         └─ broadcast { kind: 'events', events } to every socket
```

Scoring the 10th goal emits two events atomically: `GoalScored` and `MatchFinished`. The server, not the client, decides when a match is over.

## Read path

Each browser receives the full log on connect (`hello`) and then incremental `events`. `project()` folds them into a `WorldState`:

| Slice | Built from |
|---|---|
| `players` | `PlayerRegistered`, `PlayerRetired`, `PlayerUnretired` |
| `matches` | `MatchStarted`, `GoalScored`, `GoalRetracted`, `MatchFinished`, `MatchAbandoned` |
| `ratings` | `MatchFinished`: FoozRank update for all four players |
| `unlocks` | `MatchFinished`: the achievement engine evaluates all 18 rules |

Derived statistics (`stats.ts`) are computed on demand from `WorldState`, not stored.

## FoozRank

- Three ratings per player: overall, offense and defense, all starting at 1200.
- A side's strength is `(O.overall + O.offense + D.overall + D.defense) / 4`.
- Expectation is the standard logistic, `1 / (1 + 10^((Rb − Ra) / 400))`.
- Delta is `K · MOV(spread) · (actual − expected)` with `K = 32` and `MOV = ln(spread + 1) / ln(6)`.
- Both players on a side receive the same delta, applied to their overall rating and to their positional rating. The system is zero-sum.

### Live win probability

The Elo expectation `E` is a match-level probability. To update it goal by goal, we find the per-goal probability `p` such that a race to 10 between equally-started sides has white winning with probability `E`. That race is a negative binomial:

```
P(white wins | needs a, blue needs b) = Σ_{k=0}^{b-1} C(a−1+k, k) · p^a · (1−p)^k
```

`p` is found by bisection. After each goal the race is re-evaluated from the current score.

## Real-time protocol (`src/shared/wire.ts`)

| Client → server | Server → client |
|---|---|
| `command` (with `reqId`) | `hello` (full log, spectators) |
| `reaction` (rate-limited to one per 150 ms) | `events` |
| `ping` | `ack` / `nack` (per `reqId`) |
| | `presence`, `reaction`, `pong` |

If the socket is down, commands fall back to `POST /api/commands`. The client reconnects with exponential backoff and resyncs from `hello`.

## The arena

`src/client/three/Arena.tsx` is a react-three-fiber scene. The ball is simulated in 2D within the field; rods track it with damped springs. Live goals interrupt idle play with a staged shot into the conceding goal. The field texture is drawn to a canvas at runtime, so the scene has no image assets.

## Decisions

See [`adr/`](adr/).
