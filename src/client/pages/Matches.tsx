import { useMemo, useState } from 'react';
import { POSITIONS } from '../../shared/types.ts';
import MatchRow from '../components/MatchRow.tsx';
import { useStore } from '../store.ts';

const PAGE = 30;

export default function Matches() {
  const world = useStore((s) => s.world);
  const [player, setPlayer] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const matches = useMemo(
    () =>
      [...world.matchOrder]
        .reverse()
        .map((id) => world.matches[id])
        .filter((m) => !player || POSITIONS.some((p) => m.lineup[p] === player)),
    [world, player],
  );
  const players = Object.values(world.players).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Match history</h1>
          <p className="muted">{matches.length} matches · every one replayable from the event log</p>
        </div>
        <select value={player} onChange={(e) => setPlayer(e.target.value)} aria-label="Filter by player">
          <option value="">All players</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </header>
      <div className="match-list card">
        {matches.slice(0, limit).map((m) => (
          <MatchRow key={m.id} match={m} highlight={player || undefined} />
        ))}
      </div>
      {limit < matches.length && (
        <p className="center">
          <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
            Load more
          </button>
        </p>
      )}
    </div>
  );
}
