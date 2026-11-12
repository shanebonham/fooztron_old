# ADR 0003: Version 1 leaderboard compatibility

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Players are familiar with the eleven leaderboards in Fooztron 1 (`app/views/players/leaderboard.html.erb`): Best Team Record, Best Record, Most Wins, Best Winners, Best Losers, Most Points Scored, Most Points Allowed, Best Defender, Most Games Played, Most Promiscuous Offenders and Most Promiscuous Defenders.

## Decision

Keep all eleven boards with their original titles and ranking rules:

- Best Losers and Best Defender rank ascending and exclude players with a value of zero.
- Team names are shown as `OFFENSE and DEFENSE`, upper-cased.
- Records are shown in `.667` format.
- `/leaderboard/:number` continues to filter to players with at least *n* games.

One change: Best Team Record only ranks pairings with three or more games together, so that teams with a single win do not occupy the top of the board.

The History page also shows the version 1 leaderboard layout rendered with current data.

## Consequences

Existing leaderboard positions remain directly comparable between versions.
