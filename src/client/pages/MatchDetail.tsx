import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ACHIEVEMENT_BY_ID } from '../../shared/achievements.ts';
import { goalLines } from '../../shared/announcer.ts';
import type { Side } from '../../shared/types.ts';
import { ROD_LABEL } from '../../shared/types.ts';
import { announce, crowd, horn, thunk } from '../audio.ts';
import LineChart from '../components/LineChart.tsx';
import { Empty, PlayerLink, WinProbBar, duration, pct, signed } from '../components/ui.tsx';
import type { GoalSignal } from '../store.ts';
import { useStore } from '../store.ts';
import { winProbSeries } from './Live.tsx';

const Arena = lazy(() => import('../three/Arena.tsx'));

export default function MatchDetail({ id }: { id: string }) {
  const world = useStore((s) => s.world);
  const m = world.matches[id];
  const [replay, setReplay] = useState<{ goal: GoalSignal | null; index: number; white: number; blue: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const names = useMemo(() => Object.fromEntries(Object.values(world.players).map((p) => [p.id, p.name])), [world.players]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!m) return <Empty emoji="🔍">Match not found.</Empty>;

  const unlocks = world.unlocks.filter((u) => u.matchId === id);

  const startReplay = () => {
    clearTimeout(timer.current);
    let i = 0;
    setReplay({ goal: null, index: 0, white: 0, blue: 0 });
    const step = () => {
      if (i >= m.goals.length) {
        timer.current = setTimeout(() => setReplay(null), 4000);
        return;
      }
      const g = m.goals[i];
      // Negative seqs so replay signals never collide with real ones.
      setReplay({ goal: { seq: -1 - i, matchId: m.id, side: g.side, rod: g.rod }, index: i + 1, white: g.white, blue: g.blue });
      thunk();
      setTimeout(() => {
        horn(0.5);
        crowd(0.6, 1.2);
      }, 150);
      announce(goalLines({ ...m, goals: m.goals.slice(0, i + 1) }, world.players, i));
      i++;
      timer.current = setTimeout(step, 2900);
    };
    timer.current = setTimeout(step, 600);
  };

  const team = (side: Side) => (
    <div className={`md-team md-${side} ${m.winner === side ? 'md-won' : ''}`}>
      {(['offense', 'defense'] as const).map((r) => {
        const pid = m.lineup[`${side}_${r}`];
        return (
          <div key={r} className="md-player">
            <PlayerLink id={pid} size={32} />
            <small className="muted">{r}</small>
            {m.ratingDelta[pid] !== undefined && <span className={`delta ${m.ratingDelta[pid] >= 0 ? 'up' : 'down'}`}>{signed(m.ratingDelta[pid])}</span>}
          </div>
        );
      })}
    </div>
  );

  const shownWhite = replay ? replay.white : m.white;
  const shownBlue = replay ? replay.blue : m.blue;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            {new Date(m.startedAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {m.endedAt && ` · ${duration(Date.parse(m.endedAt) - Date.parse(m.startedAt))}`}
          </span>
          <h1>Match report</h1>
        </div>
        <div className="btn-row">
          <Link href="/matches" className="btn">
            ← All matches
          </Link>
          {m.goals.length > 0 && (
            <button className="btn btn-primary" onClick={startReplay}>
              ▶ Replay in 3D
            </button>
          )}
        </div>
      </header>

      <section className="md-board">
        {team('white')}
        <div className="md-score">
          <span className={m.winner === 'white' ? 'win' : ''}>{shownWhite}</span>
          <span className="muted">–</span>
          <span className={m.winner === 'blue' ? 'win' : ''}>{shownBlue}</span>
          {replay && <div className="md-replay-tag">REPLAY · goal {replay.index}/{m.goals.length}</div>}
        </div>
        {team('blue')}
      </section>

      {replay && (
        <div className="md-arena">
          <Suspense fallback={<div className="arena-canvas arena-loading">Loading arena…</div>}>
            <Arena goal={replay.goal} lineup={m.lineup} names={names} />
          </Suspense>
        </div>
      )}

      <WinProbBar white={m.whiteExpectation} label="Pre-match prediction" />

      <div className="grid-2">
        <section className="card">
          <header className="card-head">
            <h2>Win probability</h2>
            <span className="muted">above the line favors White</span>
          </header>
          <LineChart
            points={winProbSeries(m)}
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
            <h2>Goal by goal</h2>
          </header>
          <ol className="goal-log">
            {m.goals.map((g, i) => (
              <li key={i} className={`gl-${g.side} ${replay && replay.index === i + 1 ? 'gl-current' : ''}`}>
                <span className="gl-score">
                  {g.white}–{g.blue}
                </span>
                <span>
                  <strong>{names[m.lineup[g.scorer]]}</strong> <span className="muted">· {ROD_LABEL[g.rod]}</span>
                </span>
                <span className="muted">{duration(Date.parse(g.at) - Date.parse(m.startedAt))}</span>
              </li>
            ))}
          </ol>
        </section>
        {unlocks.length > 0 && (
          <section className="card span-2">
            <header className="card-head">
              <h2>Achievements unlocked</h2>
            </header>
            <ul className="unlock-feed">
              {unlocks.map((u) => {
                const a = ACHIEVEMENT_BY_ID[u.achievementId];
                return (
                  <li key={u.playerId + u.achievementId}>
                    <span className="unlock-emoji">{a.emoji}</span>
                    <span>
                      <PlayerLink id={u.playerId} avatar={false} /> · <strong>{a.name}</strong> <span className="muted">{a.description}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
