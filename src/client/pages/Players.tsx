import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { allPlayerStats } from '../../shared/stats.ts';
import { Avatar, Form, pct, rating } from '../components/ui.tsx';
import { useStore } from '../store.ts';

export default function Players() {
  const world = useStore((s) => s.world);
  const send = useStore((s) => s.send);
  const [showRetired, setShowRetired] = useState(false);
  const [name, setName] = useState('');
  const stats = useMemo(
    () => allPlayerStats(world, { includeRetired: showRetired }).sort((a, b) => b.rating - a.rating),
    [world, showRetired],
  );
  const retiredCount = Object.values(world.players).filter((p) => p.retired).length;

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await send({ type: 'RegisterPlayer', name });
      setName('');
    } catch {
      /* toasted */
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Players</h1>
          <p className="muted">{stats.length} active competitors</p>
        </div>
        <form onSubmit={register} className="inline-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Register a new player" maxLength={32} aria-label="New player name" />
          <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
            + Register
          </button>
        </form>
      </header>
      <div className="player-grid">
        {stats.map((s) => (
          <Link key={s.player.id} href={`/players/${s.player.id}`} className={`player-card ${s.player.retired ? 'retired' : ''}`} style={{ '--hue': s.player.hue } as React.CSSProperties}>
            <Avatar player={s.player} size={56} />
            <div className="pc-name">{s.player.name}</div>
            <div className="pc-rating">{rating(s.rating)}</div>
            <div className="pc-meta">
              {s.wins}–{s.losses} · {pct(s.record)}
            </div>
            <Form form={s.form.slice(-5)} />
            {s.player.retired && <span className="badge">retired</span>}
          </Link>
        ))}
      </div>
      {retiredCount > 0 && (
        <p className="center">
          <button className="btn btn-sm" onClick={() => setShowRetired((x) => !x)}>
            {showRetired ? 'Hide' : 'Show'} {retiredCount} retired player{retiredCount === 1 ? '' : 's'}
          </button>
        </p>
      )}
    </div>
  );
}
