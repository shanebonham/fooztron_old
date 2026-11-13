import { Link } from 'wouter';
import type { Match, Side } from '../../shared/types.ts';
import { winnerExp } from '../../shared/stats.ts';
import { useStore } from '../store.ts';
import { duration, timeAgo } from './ui.tsx';

export default function MatchRow({ match: m, compact = false, highlight }: { match: Match; compact?: boolean; highlight?: string }) {
  const players = useStore((s) => s.world.players);
  const n = (id: string) => players[id]?.name ?? '?';
  const team = (side: Side) => (
    <span className={`mr-team mr-${side} ${m.winner === side ? 'mr-won' : ''}`}>
      {[m.lineup[`${side}_offense`], m.lineup[`${side}_defense`]].map((id, i) => (
        <span key={id} className={id === highlight ? 'mr-me' : ''}>
          {i > 0 && <span className="muted"> & </span>}
          {n(id)}
        </span>
      ))}
    </span>
  );
  const upset = m.status === 'final' && winnerExp(m) < 0.3;
  const skunk = m.status === 'final' && Math.min(m.white, m.blue) === 0;
  return (
    <Link href={`/matches/${m.id}`} className={`match-row ${compact ? 'compact' : ''}`}>
      {team('white')}
      <span className="mr-score">
        <span className={m.winner === 'white' ? 'mr-win-score' : ''}>{m.white}</span>
        <span className="muted">–</span>
        <span className={m.winner === 'blue' ? 'mr-win-score' : ''}>{m.blue}</span>
      </span>
      {team('blue')}
      <span className="mr-meta">
        {skunk && <span className="badge badge-skunk">🦨 skunk</span>}
        {upset && <span className="badge badge-upset">🗡️ upset</span>}
        {m.status === 'abandoned' && <span className="badge">abandoned</span>}
        {m.status === 'live' && <span className="badge badge-live">live</span>}
        {!compact && m.endedAt && <span className="muted">{duration(Date.parse(m.endedAt) - Date.parse(m.startedAt))}</span>}
        <span className="muted">{timeAgo(m.startedAt)}</span>
      </span>
    </Link>
  );
}
