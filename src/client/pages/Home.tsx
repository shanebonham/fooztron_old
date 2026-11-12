import { lazy, Suspense, useMemo } from 'react';
import { Link } from 'wouter';
import { ACHIEVEMENT_BY_ID } from '../../shared/achievements.ts';
import { finishedMatches } from '../../shared/projection.ts';
import { liveWinProbability } from '../../shared/rating.ts';
import { allPlayerStats, records } from '../../shared/stats.ts';
import { Avatar, Form, PlayerLink, Stat, WinProbBar, pct, rating, timeAgo } from '../components/ui.tsx';
import MatchRow from '../components/MatchRow.tsx';
import { useStore } from '../store.ts';

const Arena = lazy(() => import('../three/Arena.tsx'));

export default function Home() {
  const world = useStore((s) => s.world);
  const lastGoal = useStore((s) => s.lastGoal);
  const live = world.liveMatchId ? world.matches[world.liveMatchId] : null;

  const top = useMemo(() => allPlayerStats(world, { minGames: 1 }).sort((a, b) => b.rating - a.rating).slice(0, 5), [world]);
  const recent = useMemo(() => finishedMatches(world).slice(-6).reverse(), [world]);
  const rec = useMemo(() => records(world), [world]);
  const unlocks = world.unlocks.slice(-6).reverse();
  const names = useMemo(() => Object.fromEntries(Object.values(world.players).map((p) => [p.id, p.name])), [world.players]);

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-canvas">
          <Suspense fallback={<div className="arena-canvas arena-loading">Loading 3D arena…</div>}>
            <Arena goal={lastGoal} lineup={live?.lineup} names={live ? names : undefined} />
          </Suspense>
        </div>
        <div className="hero-copy">
          {live ? (
            <>
              <span className="eyebrow live-eyebrow">
                <span className="live-dot" /> LIVE NOW
              </span>
              <h1 className="hero-score">
                <span className="side-white-text">{live.white}</span>
                <span className="muted">–</span>
                <span className="side-blue-text">{live.blue}</span>
              </h1>
              <p>
                {names[live.lineup.white_offense]} & {names[live.lineup.white_defense]} <span className="muted">vs</span>{' '}
                {names[live.lineup.blue_offense]} & {names[live.lineup.blue_defense]}
              </p>
              <WinProbBar white={liveWinProbability(live.whiteExpectation, live.white, live.blue)} />
              <div className="hero-actions">
                <Link href="/live" className="btn btn-primary">
                  Open scorer
                </Link>
                <Link href="/arena" className="btn">
                  🏟️ Jumbotron
                </Link>
              </div>
            </>
          ) : (
            <>
              <span className="eyebrow">Fooztron 2</span>
              <h1>
                Every goal, <em>live.</em>
              </h1>
              <p className="lede">Real-time scoring, ratings and match analytics for your foosball table.</p>
              <div className="hero-actions">
                <Link href="/new" className="btn btn-primary">
                  ⚡ Start a match
                </Link>
                <Link href="/arena" className="btn">
                  🏟️ Jumbotron mode
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="stat-strip">
        <Stat label="Matches played" value={rec.totalMatches.toLocaleString()} />
        <Stat label="Goals scored" value={rec.totalGoals.toLocaleString()} />
        <Stat label="Skunks" value={rec.skunks} hint="10–0 wins" />
        <Stat label="White wins" value={pct(rec.colorRates.white)} hint={`Blue ${pct(rec.colorRates.blue)}`} />
        <Stat label="3-bar goals" value={pct((rec.rodCounts.three_bar ?? 0) / (rec.totalGoals || 1))} hint="of all goals" />
      </section>

      <div className="grid-2">
        <section className="card">
          <header className="card-head">
            <h2>FoozRank Top 5</h2>
            <Link href="/leaderboards">All boards →</Link>
          </header>
          <ol className="rank-list">
            {top.map((s, i) => (
              <li key={s.player.id}>
                <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                <PlayerLink id={s.player.id} />
                <Form form={s.form.slice(-5)} />
                <span className="rank-rating">{rating(s.rating)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <header className="card-head">
            <h2>Recent matches</h2>
            <Link href="/matches">History →</Link>
          </header>
          <div className="match-list">
            {recent.map((m) => (
              <MatchRow key={m.id} match={m} compact />
            ))}
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <h2>Fresh achievements</h2>
          </header>
          <ul className="unlock-feed">
            {unlocks.map((u) => {
              const a = ACHIEVEMENT_BY_ID[u.achievementId];
              return (
                <li key={`${u.playerId}${u.achievementId}`}>
                  <span className="unlock-emoji">{a.emoji}</span>
                  <span>
                    <Link href={`/players/${u.playerId}`}>{world.players[u.playerId]?.name}</Link> unlocked <strong>{a.name}</strong>
                    <span className="muted"> · {timeAgo(u.at)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <header className="card-head">
            <h2>Hall of records</h2>
          </header>
          <dl className="records">
            {rec.fastest && (
              <>
                <dt>⏱️ Fastest match</dt>
                <dd>
                  <Link href={`/matches/${rec.fastest.id}`}>{Math.round((Date.parse(rec.fastest.endedAt!) - Date.parse(rec.fastest.startedAt)) / 1000)}s</Link>
                </dd>
              </>
            )}
            {rec.longest && (
              <>
                <dt>🐢 Longest match</dt>
                <dd>
                  <Link href={`/matches/${rec.longest.id}`}>{Math.round((Date.parse(rec.longest.endedAt!) - Date.parse(rec.longest.startedAt)) / 60000)} minutes</Link>
                </dd>
              </>
            )}
            {rec.biggestUpset && (
              <>
                <dt>🗡️ Biggest upset</dt>
                <dd>
                  <Link href={`/matches/${rec.biggestUpset.id}`}>
                    Won with a{' '}
                    {pct(rec.biggestUpset.winner === 'white' ? rec.biggestUpset.whiteExpectation : 1 - rec.biggestUpset.whiteExpectation)} chance
                  </Link>
                </dd>
              </>
            )}
            <dt>🚀 Goalie-rod goals</dt>
            <dd>{rec.rodCounts.goalie ?? 0}</dd>
            <dt>👥 Registered players</dt>
            <dd className="avatar-stack">
              {Object.values(world.players)
                .filter((p) => !p.retired)
                .slice(0, 10)
                .map((p) => (
                  <Avatar key={p.id} player={p} size={26} />
                ))}
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
