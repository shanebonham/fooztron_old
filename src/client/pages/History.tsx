/**
 * History: the origins of Fooztron, the version 1 changelog, and the
 * version 1 leaderboard rendered with current data.
 * The full version 1 source is preserved in legacy/2012-rails.
 */
import { useMemo, useState } from 'react';
import { allPlayerStats, teamStats } from '../../shared/stats.ts';
import commits from '../history-commits.json';
import { useStore } from '../store.ts';

/** The leaderboard as version 1 rendered it, including its record formatting. */
function VersionOneLeaderboard() {
  const world = useStore((s) => s.world);
  const players = useMemo(() => allPlayerStats(world, { minGames: 1 }), [world]);
  const teams = useMemo(() => teamStats(world).sort((a, b) => b.record - a.record), [world]);
  // Version 1 formatting: sprintf('%.3f', player.record).to_s[1..-1]
  const rec = (x: number) => x.toFixed(3).slice(1);
  return (
    <div className="classic">
      <h1>Leaderboards</h1>
      <p>
        <a href="#history">Back to game list</a>
      </p>
      <div className="classic-board">
        <h2>Best Team Record</h2>
        <table>
          <tbody>
            <tr>
              <th>&#9733;</th>
              <th>Team</th>
              <th>Record</th>
            </tr>
            {teams.slice(0, 8).map((t, i) => (
              <tr key={t.key} className={i < 3 ? 'top' : ''}>
                <td>{i + 1}</td>
                <td>
                  {t.offense.name.toUpperCase()} and {t.defense.name.toUpperCase()}
                </td>
                <td>{t.record.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="classic-board">
        <h2>Best Record</h2>
        <table>
          <tbody>
            <tr>
              <th>&#9733;</th>
              <th>Player</th>
              <th>Record</th>
            </tr>
            {[...players]
              .sort((a, b) => b.record - a.record)
              .map((s, i) => (
                <tr key={s.player.id} className={i < 3 ? 'top' : ''}>
                  <td>{i + 1}</td>
                  <td>{s.player.name}</td>
                  <td>{rec(s.record)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p>
        Logged in as <strong>foosball@example.com</strong> <a href="#history">Log out</a>
      </p>
    </div>
  );
}

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

export default function History() {
  const [v1, setV1] = useState(false);
  const authors = commits.reduce<Record<string, number>>((acc, c) => ((acc[c.author] = (acc[c.author] ?? 0) + 1), acc), {});
  const first = commits[commits.length - 1];
  const last = commits[0];

  return (
    <div className="page history">
      <header className="history-hero">
        <span className="eyebrow">Since 2012</span>
        <h1>Our history</h1>
        <p className="lede">
          Fooztron began on {fmt(first.date)}, when {first.author} made the first commit. Over the following eleven weeks, {Object.keys(authors).join(' and ')} shipped{' '}
          {commits.length} commits: scoring, player profiles, team records and the leaderboards that are still in use today. Version 1 was last updated on{' '}
          {fmt(last.date)}.
        </p>
        <p className="lede">
          Fooztron 2 carries forward the rules, the colors and every leaderboard from version 1. The original source is preserved in full in{' '}
          <code>legacy/2012-rails</code>.
        </p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => setV1((c) => !c)}>
            {v1 ? '← Back to history' : 'View the version 1 leaderboard'}
          </button>
        </div>
      </header>

      {v1 ? (
        <VersionOneLeaderboard />
      ) : (
        <section className="card">
          <header className="card-head">
            <h2>Version 1 changelog</h2>
            <span className="muted">
              {Object.entries(authors)
                .map(([a, n]) => `${a} (${n})`)
                .join(' · ')}
            </span>
          </header>
          <ol className="timeline">
            {commits.map((c) => (
              <li key={c.hash}>
                <time>{c.date}</time>
                <code>{c.hash}</code>
                <span className="tl-msg">{c.message}</span>
                <span className="muted tl-author">{c.author}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
