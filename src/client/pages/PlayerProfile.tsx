import { useMemo } from 'react';
import { Link } from 'wouter';
import { ACHIEVEMENTS } from '../../shared/achievements.ts';
import { careerOf } from '../../shared/projection.ts';
import { BASE_RATING } from '../../shared/rating.ts';
import { allPlayerStats, headToHead, playerStats } from '../../shared/stats.ts';
import LineChart from '../components/LineChart.tsx';
import MatchRow from '../components/MatchRow.tsx';
import { Avatar, Empty, Form, PlayerLink, Stat, avg, pct, rating, signed, timeAgo } from '../components/ui.tsx';
import { useStore } from '../store.ts';

function Split({ label, a, b }: { label: string; a: { name: string; rec: number; games: number }; b: { name: string; rec: number; games: number } }) {
  return (
    <div className="split">
      <div className="split-label">{label}</div>
      {[a, b].map((x) => (
        <div key={x.name} className="split-row">
          <span className="split-name">{x.name}</span>
          <span className="split-bar">
            <span style={{ width: `${x.rec * 100}%` }} />
          </span>
          <span className="split-val">
            {pct(x.rec)} <span className="muted">({x.games})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PlayerProfile({ id }: { id: string }) {
  const world = useStore((s) => s.world);
  const send = useStore((s) => s.send);
  const p = world.players[id];
  const st = useMemo(() => (p ? playerStats(world, id) : null), [world, id, p]);
  const rank = useMemo(() => allPlayerStats(world, { minGames: 1 }).sort((a, b) => b.rating - a.rating).findIndex((s) => s.player.id === id) + 1, [world, id]);
  const career = useMemo(() => careerOf(world, id), [world, id]);
  const h2h = useMemo(
    () =>
      Object.values(world.players)
        .filter((o) => o.id !== id)
        .map((o) => ({ o, ...headToHead(world, id, o.id) }))
        .filter((r) => r.games > 0)
        .sort((a, b) => b.games - a.games),
    [world, id],
  );
  const unlocked = new Map(world.unlocks.filter((u) => u.playerId === id).map((u) => [u.achievementId, u]));

  if (!p || !st) return <Empty emoji="🔍">Player not found.</Empty>;

  const history = world.ratings[id]?.history ?? [];
  const points = [{ x: Date.parse(p.joinedAt), y: BASE_RATING, label: 'Joined' as React.ReactNode }, ...history.map((h) => ({ x: Date.parse(h.at), y: h.rating }))];

  return (
    <div className="page">
      <header className="profile-head" style={{ '--hue': p.hue } as React.CSSProperties}>
        <Avatar player={p} size={96} />
        <div>
          <h1>
            {p.name} {p.retired && <span className="badge">retired</span>}
          </h1>
          <p className="muted">
            {rank > 0 ? `#${rank} FoozRank` : 'Unranked'} · joined {timeAgo(p.joinedAt)} · {unlocked.size}/{ACHIEVEMENTS.length} achievements
          </p>
          <Form form={st.form} />
        </div>
        <div className="profile-rating">
          <div className="pr-value">{rating(st.rating)}</div>
          <div className="muted">peak {rating(st.peak)}</div>
        </div>
      </header>

      <section className="stat-strip">
        <Stat label="Record" value={`${st.wins}–${st.losses}`} hint={avg(st.record)} />
        <Stat label="Streak" value={`${st.streak.kind}${st.streak.length}`} hint={`best W${st.longestWinStreak}`} />
        <Stat label="Avg winning spread" value={st.averageWinningSpread.toFixed(1)} />
        <Stat label="Avg losing spread" value={st.averageLosingSpread.toFixed(1)} />
        <Stat label="Personal goals" value={st.goalsCredited} hint="credited by rod" />
        <Stat label="Pts allowed on D" value={st.averagePointsAllowedOnDefense.toFixed(1)} hint="per game" />
      </section>

      <div className="grid-2">
        <section className="card span-2">
          <header className="card-head">
            <h2>FoozRank history</h2>
            <span className="muted">{history.length} rated matches</span>
          </header>
          {history.length ? (
            <LineChart
              points={points}
              reference={{ y: BASE_RATING, label: `${BASE_RATING} start` }}
              formatY={(y) => rating(y)}
              formatX={(x) => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              ariaLabel={`${p.name}'s rating over time`}
            />
          ) : (
            <p className="muted">No rated matches yet.</p>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <h2>Splits</h2>
          </header>
          <Split
            label="By position"
            a={{ name: `Offense · ${rating(st.offenseRating)}`, rec: st.recordByRole.offense.record, games: st.recordByRole.offense.games }}
            b={{ name: `Defense · ${rating(st.defenseRating)}`, rec: st.recordByRole.defense.record, games: st.recordByRole.defense.games }}
          />
          <Split
            label="By color"
            a={{ name: 'White', rec: st.recordBySide.white.record, games: st.recordBySide.white.games }}
            b={{ name: 'Blue', rec: st.recordBySide.blue.record, games: st.recordBySide.blue.games }}
          />
          <dl className="records">
            {st.bestPartner && (
              <>
                <dt>🤝 Best partner</dt>
                <dd>
                  <PlayerLink id={st.bestPartner.id} size={20} /> {st.bestPartner.wins}/{st.bestPartner.games}
                </dd>
              </>
            )}
            {st.nemesis && (
              <>
                <dt>😈 Nemesis</dt>
                <dd>
                  <PlayerLink id={st.nemesis.id} size={20} /> {st.nemesis.losses} losses
                </dd>
              </>
            )}
            <dt>💋 Partners</dt>
            <dd>
              {st.partnersAsOffense} on O · {st.partnersAsDefense} on D
            </dd>
          </dl>
        </section>

        <section className="card">
          <header className="card-head">
            <h2>Head to head</h2>
          </header>
          <table className="h2h">
            <tbody>
              {h2h.map((r) => (
                <tr key={r.o.id}>
                  <td>
                    <PlayerLink id={r.o.id} size={22} />
                  </td>
                  <td className="num">
                    {r.aWins}–{r.bWins}
                  </td>
                  <td className="h2h-bar-cell">
                    <span className="h2h-bar">
                      <span style={{ width: `${(r.aWins / r.games) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card span-2">
          <header className="card-head">
            <h2>Trophy case</h2>
            <span className="muted">
              {unlocked.size} of {ACHIEVEMENTS.length}
            </span>
          </header>
          <div className="trophies">
            {ACHIEVEMENTS.map((a) => {
              const u = unlocked.get(a.id);
              return (
                <div key={a.id} className={`trophy rarity-${a.rarity} ${u ? 'got' : 'locked'}`} title={a.description}>
                  <span className="trophy-emoji">{u ? a.emoji : '🔒'}</span>
                  <span className="trophy-name">{a.name}</span>
                  <span className="trophy-desc">{a.description}</span>
                  {u && (
                    <Link href={`/matches/${u.matchId}`} className="trophy-when">
                      {timeAgo(u.at)}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="card span-2">
          <header className="card-head">
            <h2>Recent matches</h2>
          </header>
          <div className="match-list">
            {[...career]
              .reverse()
              .slice(0, 12)
              .map((m) => (
                <div key={m.id} className="mr-wrap">
                  <MatchRow match={m} highlight={id} />
                  <span className={`delta ${m.ratingDelta[id] >= 0 ? 'up' : 'down'}`}>{signed(m.ratingDelta[id] ?? 0)}</span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <p className="center">
        <button className="btn btn-sm" onClick={() => send({ type: p.retired ? 'UnretirePlayer' : 'RetirePlayer', playerId: id }).catch(() => {})}>
          {p.retired ? '↩ Unretire' : 'Retire player'}
        </button>
      </p>
    </div>
  );
}
