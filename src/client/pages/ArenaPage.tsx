/** Jumbotron: fullscreen cinematic arena for the office TV. */
import { useMemo } from 'react';
import { Link } from 'wouter';
import { liveWinProbability } from '../../shared/rating.ts';
import { allPlayerStats } from '../../shared/stats.ts';
import { ReactionBar } from '../App.tsx';
import Arena from '../three/Arena.tsx';
import { Avatar, rating, WinProbBar } from '../components/ui.tsx';
import { useStore } from '../store.ts';

export default function ArenaPage() {
  const world = useStore((s) => s.world);
  const lastGoal = useStore((s) => s.lastGoal);
  const spectators = useStore((s) => s.spectators);
  const m = world.liveMatchId ? world.matches[world.liveMatchId] : null;
  const names = useMemo(() => Object.fromEntries(Object.values(world.players).map((p) => [p.id, p.name])), [world.players]);
  const top = useMemo(() => allPlayerStats(world, { minGames: 1 }).sort((a, b) => b.rating - a.rating).slice(0, 5), [world]);

  const team = (side: 'white' | 'blue') =>
    m && (
      <div className={`jt-team jt-${side}`}>
        {(['offense', 'defense'] as const).map((r) => {
          const p = world.players[m.lineup[`${side}_${r}`]];
          return (
            <div key={r} className="jt-player">
              <Avatar player={p} size={34} />
              {p?.name}
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="jumbotron">
      <Arena goal={lastGoal} lineup={m?.lineup} names={m ? names : undefined} cinematic className="arena-full" />
      <div className="jt-overlay">
        <div className="jt-top">
          <Link href="/" className="jt-exit" aria-label="Exit jumbotron">
            ✕
          </Link>
          <span className="jt-brand">
            FOOZTRON<sup>2</sup>
          </span>
          <span className="jt-watch">👀 {spectators}</span>
        </div>
        {m ? (
          <div className="jt-board">
            {team('white')}
            <div className="jt-score">
              <span>{m.white}</span>
              <span className="jt-dash">:</span>
              <span>{m.blue}</span>
            </div>
            {team('blue')}
            <div className="jt-wp">
              <WinProbBar white={liveWinProbability(m.whiteExpectation, m.white, m.blue)} />
            </div>
          </div>
        ) : (
          <div className="jt-idle">
            <h2>Table open</h2>
            <p>Start a match from any device. This screen updates live.</p>
            <ol>
              {top.map((s, i) => (
                <li key={s.player.id}>
                  <span className="jt-rank">{i + 1}</span>
                  <Avatar player={s.player} size={28} />
                  <span>{s.player.name}</span>
                  <span className="jt-rating">{rating(s.rating)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="jt-bottom">
          <ReactionBar />
        </div>
      </div>
    </div>
  );
}
