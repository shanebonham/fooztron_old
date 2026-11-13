import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { liveWinProbability } from '../../shared/rating.ts';
import type { Match, Rod, Side } from '../../shared/types.ts';
import { RODS, ROD_LABEL, ROD_ROLE, WINNING_SCORE } from '../../shared/types.ts';
import { ReactionBar } from '../App.tsx';
import LineChart from '../components/LineChart.tsx';
import { Avatar, Empty, WinProbBar, duration, pct, useNow } from '../components/ui.tsx';
import { useStore } from '../store.ts';

const Arena = lazy(() => import('../three/Arena.tsx'));

export function winProbSeries(m: Match) {
  const pts = [{ x: 0, y: m.whiteExpectation, label: 'Kickoff' as React.ReactNode }];
  m.goals.forEach((g, i) =>
    pts.push({ x: i + 1, y: liveWinProbability(m.whiteExpectation, g.white, g.blue), label: `${g.white}–${g.blue} · ${g.side} ${ROD_LABEL[g.rod]}` }),
  );
  return pts;
}

function SidePanel({ m, side, rod, setRod, onScore, disabled }: { m: Match; side: Side; rod: Rod; setRod: (r: Rod) => void; onScore: () => void; disabled: boolean }) {
  const players = useStore((s) => s.world.players);
  const score = side === 'white' ? m.white : m.blue;
  const scorer = players[m.lineup[`${side}_${ROD_ROLE[rod]}`]];
  return (
    <div className={`side-panel side-panel-${side}`}>
      <div className="sp-names">
        {(['offense', 'defense'] as const).map((role) => {
          const p = players[m.lineup[`${side}_${role}`]];
          return (
            <Link key={role} href={`/players/${p?.id}`} className="sp-player">
              <Avatar player={p} size={30} />
              <span>
                {p?.name}
                <small>{role}</small>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="sp-score" aria-live="polite" aria-label={`${side} score ${score}`}>
        {score}
      </div>
      <div className="rod-picker" role="radiogroup" aria-label={`${side} scoring rod`}>
        {RODS.map((r, i) => (
          <button key={r} role="radio" aria-checked={rod === r} className={rod === r ? 'on' : ''} onClick={() => setRod(r)}>
            {ROD_LABEL[r]}
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </div>
      <button className={`goal-btn goal-btn-${side}`} onClick={onScore} disabled={disabled}>
        GOAL
        <small>
          {scorer?.name} · {ROD_LABEL[rod]}
          <span className="goal-key">
            {' '}
            · <kbd>{side === 'white' ? 'W' : 'B'}</kbd>
          </span>
        </small>
      </button>
    </div>
  );
}

export default function Live() {
  const world = useStore((s) => s.world);
  const lastGoal = useStore((s) => s.lastGoal);
  const send = useStore((s) => s.send);
  const now = useNow();
  const m = world.liveMatchId ? world.matches[world.liveMatchId] : null;
  const [rod, setRod] = useState<Record<Side, Rod>>({ white: 'three_bar', blue: 'three_bar' });
  const [lastSide, setLastSide] = useState<Side>('white');
  const [busy, setBusy] = useState(false);
  // Keep showing the just-finished match for a beat instead of vanishing.
  const [recent, setRecent] = useState<string | null>(null);
  useEffect(() => {
    if (m) setRecent(m.id);
  }, [m]);
  const shown = m ?? (recent ? world.matches[recent] : null);
  const names = useMemo(() => Object.fromEntries(Object.values(world.players).map((p) => [p.id, p.name])), [world.players]);

  const score = async (side: Side) => {
    if (!m || busy) return;
    setBusy(true);
    setLastSide(side);
    try {
      await send({ type: 'ScoreGoal', matchId: m.id, side, rod: rod[side] });
      setRod((r) => ({ ...r, [side]: 'three_bar' }));
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };
  const undo = () => m && send({ type: 'RetractGoal', matchId: m.id }).catch(() => {});
  const abandon = () => m && confirm('Abandon this match? It will not count.') && send({ type: 'AbandonMatch', matchId: m.id }).catch(() => {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'w') score('white');
      else if (k === 'b') score('blue');
      else if (k === 'z' || k === 'u') undo();
      else if (['1', '2', '3', '4'].includes(k)) setRod((r) => ({ ...r, [lastSide]: RODS[Number(k) - 1] }));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (!shown) {
    return (
      <div className="page narrow">
        <Empty emoji="🛋️">
          <h1>No match in progress</h1>
          <p>Start a match to begin live scoring.</p>
          <Link href="/new" className="btn btn-primary">
            ⚡ Start a match
          </Link>
        </Empty>
      </div>
    );
  }

  const wp = liveWinProbability(shown.whiteExpectation, shown.white, shown.blue);
  const elapsed = (shown.endedAt ? Date.parse(shown.endedAt) : now) - Date.parse(shown.startedAt);
  const isLive = shown.status === 'live';

  return (
    <div className="page live">
      <header className="page-head">
        <div>
          <span className={`eyebrow ${isLive ? 'live-eyebrow' : ''}`}>
            {isLive ? (
              <>
                <span className="live-dot" /> LIVE · {duration(elapsed)}
              </>
            ) : shown.status === 'final' ? (
              `FINAL · ${duration(elapsed)}`
            ) : (
              'ABANDONED'
            )}
          </span>
          <h1>First to {WINNING_SCORE}</h1>
        </div>
        <div className="btn-row">
          {isLive ? (
            <>
              <button className="btn" onClick={undo} disabled={!shown.goals.length}>
                ↶ Undo <kbd>Z</kbd>
              </button>
              <button className="btn btn-danger" onClick={abandon}>
                Abandon
              </button>
            </>
          ) : (
            <>
              <Link href={`/matches/${shown.id}`} className="btn">
                Match report
              </Link>
              <Link href="/new" className="btn btn-primary">
                Rematch / new match
              </Link>
            </>
          )}
        </div>
      </header>

      <WinProbBar white={wp} label={isLive ? 'Live win probability' : 'Final'} />

      <div className="live-grid">
        <SidePanel m={shown} side="white" rod={rod.white} setRod={(r) => setRod((x) => ({ ...x, white: r }))} onScore={() => score('white')} disabled={!isLive || busy} />
        <div className="live-arena">
          <Suspense fallback={<div className="arena-canvas arena-loading">Loading arena…</div>}>
            <Arena goal={lastGoal} lineup={shown.lineup} names={names} effects />
          </Suspense>
          <ReactionBar />
        </div>
        <SidePanel m={shown} side="blue" rod={rod.blue} setRod={(r) => setRod((x) => ({ ...x, blue: r }))} onScore={() => score('blue')} disabled={!isLive || busy} />
      </div>

      <div className="grid-2">
        <section className="card">
          <header className="card-head">
            <h2>Win probability by goal</h2>
            <span className="muted">above the line favors White</span>
          </header>
          <LineChart
            points={winProbSeries(shown)}
            yDomain={[0, 1]}
            reference={{ y: 0.5, label: '50%' }}
            formatY={(y) => pct(y)}
            formatX={(x) => (x === 0 ? 'Kickoff' : `Goal ${x}`)}
            splitFill={{ above: 'var(--white-team)', below: 'var(--blue-team)' }}
            color="var(--text)"
            ariaLabel="White win probability after each goal"
            step
          />
        </section>
        <section className="card">
          <header className="card-head">
            <h2>Goal log</h2>
            <span className="muted">{shown.goals.length} goals</span>
          </header>
          <ol className="goal-log">
            {[...shown.goals].reverse().map((g, i) => (
              <li key={shown.goals.length - i} className={`gl-${g.side}`}>
                <span className="gl-score">
                  {g.white}–{g.blue}
                </span>
                <span>
                  <strong>{names[shown.lineup[g.scorer]]}</strong> <span className="muted">· {ROD_LABEL[g.rod]}</span>
                </span>
                <span className="muted">{duration(Date.parse(g.at) - Date.parse(shown.startedAt))}</span>
              </li>
            ))}
            {!shown.goals.length && <li className="muted">Nil–nil. Someone score.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
