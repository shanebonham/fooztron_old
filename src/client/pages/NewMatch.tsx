/** Lineup picker: assign four players to positions on the pitch. */
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { whiteExpectation } from '../../shared/rating.ts';
import type { Lineup, Position } from '../../shared/types.ts';
import { POSITIONS, roleOf, sideOf } from '../../shared/types.ts';
import { blip } from '../audio.ts';
import { Avatar, WinProbBar, rating } from '../components/ui.tsx';
import { useStore } from '../store.ts';

type Partial4 = Partial<Record<Position, string>>;

const LABEL: Record<Position, string> = {
  white_offense: 'White offense',
  white_defense: 'White defense',
  blue_offense: 'Blue offense',
  blue_defense: 'Blue defense',
};

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

export default function NewMatch() {
  const world = useStore((s) => s.world);
  const send = useStore((s) => s.send);
  const [, navigate] = useLocation();
  const [slots, setSlots] = useState<Partial4>({});
  const [active, setActive] = useState<Position | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const roster = useMemo(
    () =>
      Object.values(world.players)
        .filter((p) => !p.retired)
        .sort((a, b) => (world.ratings[b.id]?.overall ?? 0) - (world.ratings[a.id]?.overall ?? 0)),
    [world],
  );
  const chosen = new Set(Object.values(slots).filter(Boolean));
  const full = POSITIONS.every((p) => slots[p]);
  const exp = full ? whiteExpectation(world.ratings, slots as Lineup) : null;

  const place = (playerId: string) => {
    blip(chosen.has(playerId) ? 440 : 990);
    setSlots((s) => {
      const next = { ...s };
      const existing = POSITIONS.find((p) => next[p] === playerId);
      if (existing) {
        delete next[existing];
        return next;
      }
      const target = active ?? POSITIONS.find((p) => !next[p]);
      if (!target) return s;
      next[target] = playerId;
      return next;
    });
    setActive(null);
  };

  const randomize = () => {
    const pool = [...roster].sort(() => Math.random() - 0.5).slice(0, 4);
    if (pool.length < 4) return;
    setSlots(Object.fromEntries(POSITIONS.map((p, i) => [p, pool[i].id])));
  };

  /** Brute-force all 24 arrangements of the chosen four; pick the closest to 50/50. */
  const balance = () => {
    const four = POSITIONS.map((p) => slots[p]).filter(Boolean) as string[];
    if (four.length !== 4) return;
    let best: Lineup | null = null;
    let bestGap = Infinity;
    for (const perm of permutations(four)) {
      const l = Object.fromEntries(POSITIONS.map((p, i) => [p, perm[i]])) as Lineup;
      const gap = Math.abs(whiteExpectation(world.ratings, l) - 0.5) + Math.random() * 1e-6;
      if (gap < bestGap) {
        bestGap = gap;
        best = l;
      }
    }
    if (best) setSlots(best);
    blip(1200);
  };

  const swapSides = () =>
    setSlots((s) => ({ white_offense: s.blue_offense, white_defense: s.blue_defense, blue_offense: s.white_offense, blue_defense: s.white_defense }));

  const start = async () => {
    if (!full) return;
    setBusy(true);
    try {
      await send({ type: 'StartMatch', lineup: slots as Lineup });
      navigate('/live');
    } catch {
      setBusy(false);
    }
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await send({ type: 'RegisterPlayer', name: newName });
      setNewName('');
    } catch {
      /* toast already shown */
    }
  };

  if (world.liveMatchId) {
    return (
      <div className="page narrow">
        <h1>A match is already in progress</h1>
        <p>Only one match can be played at a time.</p>
        <Link href="/live" className="btn btn-primary">
          Go to the live match
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>New match</h1>
          <p className="muted">Select a position, then a player. Players are placed in the next open position by default.</p>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={randomize}>
            🎲 Random
          </button>
          <button className="btn" onClick={balance} disabled={!full}>
            ⚖️ Auto-balance
          </button>
          <button className="btn" onClick={swapSides} disabled={!full}>
            ⇄ Swap sides
          </button>
        </div>
      </header>

      <div className="pitch" role="group" aria-label="Lineup">
        <div className="pitch-lines" aria-hidden />
        {POSITIONS.map((p) => {
          const id = slots[p];
          const pl = id ? world.players[id] : undefined;
          return (
            <button
              key={p}
              className={`slot slot-${p} slot-${sideOf(p)} ${active === p ? 'slot-active' : ''} ${pl ? 'slot-filled' : ''}`}
              onClick={() => (pl ? setSlots((s) => ({ ...s, [p]: undefined })) : setActive(active === p ? null : p))}
              aria-label={pl ? `${LABEL[p]}: ${pl.name}. Click to clear.` : `Choose ${LABEL[p]}`}
            >
              <span className="slot-role">{roleOf(p) === 'offense' ? 'OFFENSE' : 'DEFENSE'}</span>
              {pl ? (
                <>
                  <Avatar player={pl} size={44} />
                  <span className="slot-name">{pl.name}</span>
                  <span className="slot-rating">{rating(world.ratings[pl.id]?.[roleOf(p)] ?? 1200)} {roleOf(p).slice(0, 3)}</span>
                </>
              ) : (
                <span className="slot-empty">{active === p ? 'Pick below ↓' : '+'}</span>
              )}
            </button>
          );
        })}
      </div>

      {exp !== null && (
        <div className="prediction">
          <WinProbBar white={exp} label="FoozRank prediction" />
        </div>
      )}

      <div className="btn-row center">
        <button className="btn btn-primary btn-xl" onClick={start} disabled={!full || busy}>
          {busy ? 'Starting…' : full ? '⚡ Kick off' : `Pick ${4 - chosen.size} more`}
        </button>
      </div>

      <section className="card">
        <header className="card-head">
          <h2>Roster</h2>
          <form onSubmit={register} className="inline-form">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New player name" maxLength={32} aria-label="New player name" />
            <button className="btn btn-sm" type="submit">
              + Register
            </button>
          </form>
        </header>
        <div className="roster">
          {roster.map((p) => (
            <button key={p.id} className={`roster-chip ${chosen.has(p.id) ? 'picked' : ''}`} onClick={() => place(p.id)} aria-pressed={chosen.has(p.id)}>
              <Avatar player={p} size={30} />
              <span>{p.name}</span>
              <span className="muted">{rating(world.ratings[p.id]?.overall ?? 1200)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
