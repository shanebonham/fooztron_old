# ADR 0002: Real-time sync over WebSockets

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Matches are watched from desks, phones and shared displays as well as at the table. Scores need to appear everywhere as soon as they are recorded.

## Decision

Clients hold a WebSocket connection to the server. On connect, the server sends the full event log. After that it broadcasts each new event to all clients. Commands are sent over the same socket, with acknowledgements correlated by request ID. If the socket is unavailable, the client falls back to `POST /api/commands`.

Presence (spectator count) and reactions are broadcast but not persisted.

## Consequences

- All screens update within one network round trip of a goal being recorded.
- Clients reconnect automatically with exponential backoff and resynchronize from the log.
- Reactions are rate-limited per connection.
