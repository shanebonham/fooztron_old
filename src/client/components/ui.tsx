import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import type { Player, Side } from '../../shared/types.ts';
import { useStore } from '../store.ts';

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
/** Records are displayed in `.667` format. */
export const avg = (x: number) => x.toFixed(3).replace(/^0/, '');
export const rating = (x: number) => Math.round(x).toLocaleString();
export const signed = (x: number, digits = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(digits)}`;

export function timeAgo(iso: string, now = Date.now()) {
  const s = (now - Date.parse(iso)) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function duration(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

export function Avatar({ player, size = 36 }: { player?: Player; size?: number }) {
  const name = player?.name ?? '?';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const h = player?.hue ?? 220;
  return (
    <span
      className="avatar"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `conic-gradient(from 210deg, hsl(${h} 85% 60%), hsl(${(h + 60) % 360} 85% 55%), hsl(${h} 85% 60%))`,
      }}
    >
      <span>{initials}</span>
    </span>
  );
}

export function PlayerLink({ id, avatar = true, size = 28 }: { id: string; avatar?: boolean; size?: number }) {
  const p = useStore((s) => s.world.players[id]);
  if (!p) return <span className="muted">Unknown</span>;
  return (
    <Link href={`/players/${id}`} className="player-link">
      {avatar && <Avatar player={p} size={size} />}
      <span>{p.name}</span>
    </Link>
  );
}

export function SideChip({ side, children }: { side: Side; children?: ReactNode }) {
  return <span className={`side-chip side-${side}`}>{children ?? side.toUpperCase()}</span>;
}

/** Horizontal split bar: white's chance on the left, blue's on the right. */
export function WinProbBar({ white, label = 'Win probability' }: { white: number; label?: string }) {
  return (
    <div className="wpbar" role="img" aria-label={`${label}: white ${pct(white)}, blue ${pct(1 - white)}`}>
      <div className="wpbar-head">
        <span>
          <strong>{pct(white)}</strong> White
        </span>
        <span className="muted">{label}</span>
        <span>
          Blue <strong>{pct(1 - white)}</strong>
        </span>
      </div>
      <div className="wpbar-track">
        <div className="wpbar-white" style={{ width: `${white * 100}%` }} />
        <div className="wpbar-blue" style={{ width: `${(1 - white) * 100}%` }} />
      </div>
    </div>
  );
}

export function Form({ form }: { form: ('W' | 'L')[] }) {
  return (
    <span className="form" aria-label={`Last ${form.length}: ${form.join(' ')}`}>
      {form.map((r, i) => (
        <span key={i} className={`form-pip form-${r}`}>
          {r}
        </span>
      ))}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Empty({ emoji = '🫥', children }: { emoji?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <div>{children}</div>
    </div>
  );
}
