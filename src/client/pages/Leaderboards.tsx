/**
 * Leaderboards. "Classic boards" match the Fooztron 1 leaderboard page
 * (app/views/players/leaderboard.html.erb) board-for-board, with the same
 * titles and sort order.
 */
import { useMemo, type ReactNode } from 'react';
import { useLocation, useSearch } from 'wouter';
import { allPlayerStats, teamStats, type PlayerStats } from '../../shared/stats.ts';
import { Form, PlayerLink, avg, pct, rating } from '../components/ui.tsx';
import { useStore } from '../store.ts';

interface Board<T> {
  title: string;
  stat: string;
  rows: T[];
  name: (r: T) => ReactNode;
  value: (r: T) => ReactNode;
  key: (r: T) => string;
  note?: string;
  isNew?: boolean;
}

function BoardCard<T>({ b }: { b: Board<T> }) {
  return (
    <section className="card board">
      <header className="card-head">
        <h3>
          {b.title}
          {b.isNew && <span className="badge badge-new">new</span>}
        </h3>
      </header>
      {b.note && <p className="board-note">{b.note}</p>}
      <table>
        <thead>
          <tr>
            <th className="order" aria-label="Rank">
              ★
            </th>
            <th>{b.title.includes('Team') ? 'Team' : 'Player'}</th>
            <th className="stat-col">{b.stat}</th>
          </tr>
        </thead>
        <tbody>
          {b.rows.slice(0, 10).map((r, i) => (
            <tr key={b.key(r)} className={i < 3 ? 'top' : ''}>
              <td className="order">{i + 1}</td>
              <td>{b.name(r)}</td>
              <td className="stat-col">{b.value(r)}</td>
            </tr>
          ))}
          {!b.rows.length && (
            <tr>
              <td colSpan={3} className="muted">
                Nobody qualifies yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

const desc = <T,>(f: (x: T) => number) => (a: T, b: T) => f(b) - f(a);
const asc = <T,>(f: (x: T) => number) => (a: T, b: T) => f(a) - f(b);

export default function Leaderboards({ params }: { params?: { number?: string } }) {
  const world = useStore((s) => s.world);
  const search = useSearch();
  const [, navigate] = useLocation();
  // Minimum games, via ?min= or the Fooztron 1 URL form /leaderboard/:number
  const min = Number(params?.number ?? new URLSearchParams(search).get('min') ?? 1);

  const players = useMemo(() => allPlayerStats(world, { minGames: min }), [world, min]);
  // Team records need a minimum sample to be meaningful.
  const teamMin = Math.max(min, 3);
  const teams = useMemo(() => teamStats(world).filter((t) => t.games >= teamMin), [world, teamMin]);
  const ranked = useMemo(() => [...players].sort((a, b) => b.rating - a.rating), [players]);

  const P = (title: string, stat: string, sort: (a: PlayerStats, b: PlayerStats) => number, value: (s: PlayerStats) => ReactNode, opts: Partial<Board<PlayerStats>> & { filter?: (s: PlayerStats) => boolean } = {}): Board<PlayerStats> => ({
    title,
    stat,
    rows: players.filter(opts.filter ?? (() => true)).sort(sort),
    name: (s) => <PlayerLink id={s.player.id} size={22} />,
    value,
    key: (s) => s.player.id,
    ...opts,
  });

  const classics: Board<any>[] = [
    {
      title: 'Best Team Record',
      stat: 'Record',
      rows: [...teams].sort((a, b) => b.record - a.record || b.games - a.games),
      // Team#name: "#{offense.name.upcase} and #{defense.name.upcase}"
      name: (t) => (
        <span className="team-name">
          {t.offense.name.toUpperCase()} and {t.defense.name.toUpperCase()}
        </span>
      ),
      value: (t) => (t.record >= 1 ? '1.000' : avg(t.record)),
      key: (t) => t.key,
      note: `Pairings with ${teamMin}+ games together.`,
    },
    P('Best Record', 'Record', desc((s) => s.record), (s) => (s.record >= 1 ? '1.000' : avg(s.record))),
    P('Most Wins', 'Wins', desc((s) => s.wins), (s) => s.wins),
    P('Best Winners', 'Average spread', desc((s) => s.averageWinningSpread), (s) => s.averageWinningSpread.toFixed(1)),
    P('Best Losers', 'Average spread', asc((s) => s.averageLosingSpread), (s) => s.averageLosingSpread.toFixed(1), {
      filter: (s) => s.averageLosingSpread !== 0,
      note: 'Lowest average losing margin. Players without a loss are not ranked.',
    }),
    P('Most Points Scored', 'Points', desc((s) => s.totalPointsScored), (s) => s.totalPointsScored),
    P('Most Points Allowed', 'Points', desc((s) => s.totalPointsAllowed), (s) => s.totalPointsAllowed),
    P('Best Defender', 'Avg pts allowed/game', asc((s) => s.averagePointsAllowedOnDefense), (s) => s.averagePointsAllowedOnDefense.toFixed(1), {
      filter: (s) => s.averagePointsAllowedOnDefense !== 0,
    }),
    P('Most Games Played', '# of games', desc((s) => s.games), (s) => s.games),
    P('Most Promiscuous Offenders', '# of partners', desc((s) => s.partnersAsOffense), (s) => s.partnersAsOffense, {
      note: 'Distinct defenders partnered while playing offense.',
    }),
    P('Most Promiscuous Defenders', '# of partners', desc((s) => s.partnersAsDefense), (s) => s.partnersAsDefense, {
      note: 'Distinct offenders partnered while playing defense.',
    }),
  ];

  const modern: Board<PlayerStats>[] = [
    P('Color-Weighted Record', 'Adj. record', desc((s) => s.colorWeightedRecord), (s) => avg(Math.min(s.colorWeightedRecord, 0.999)), {
      isNew: true,
      note: 'Wins on the less successful color count for more.',
    }),
    P('Offensive Rating', 'FoozRank', desc((s) => s.offenseRating), (s) => rating(s.offenseRating), { isNew: true }),
    P('Defensive Rating', 'FoozRank', desc((s) => s.defenseRating), (s) => rating(s.defenseRating), { isNew: true }),
    P('Longest Win Streak', 'Wins', desc((s) => s.longestWinStreak), (s) => s.longestWinStreak, { isNew: true }),
    P('Personal Goals', 'Goals', desc((s) => s.goalsCredited), (s) => s.goalsCredited, { isNew: true, note: 'Credited by rod: 3- and 5-bar to offense, goalie and 2-bar to defense.' }),
    P('Peak FoozRank', 'Peak', desc((s) => s.peak), (s) => rating(s.peak), { isNew: true }),
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Leaderboards</h1>
          <p className="muted">
            Min games:{' '}
            {[1, 5, 10, 25].map((n) => (
              <button key={n} className={`chip ${n === min ? 'chip-on' : ''}`} onClick={() => navigate(`/leaderboards?min=${n}`)}>
                {n}+
              </button>
            ))}
          </p>
        </div>
      </header>

      <section className="card">
        <header className="card-head">
          <h2>FoozRank</h2>
          <span className="muted">Positional Elo with margin-of-victory weighting</span>
        </header>
        <div className="table-scroll">
          <table className="foozrank">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th className="num">Rating</th>
                <th className="num hide-sm">Off</th>
                <th className="num hide-sm">Def</th>
                <th className="num">W–L</th>
                <th className="num hide-sm">Win %</th>
                <th className="hide-sm">Form</th>
                <th className="num">Streak</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => (
                <tr key={s.player.id}>
                  <td>
                    <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                  </td>
                  <td>
                    <PlayerLink id={s.player.id} />
                  </td>
                  <td className="num strong">{rating(s.rating)}</td>
                  <td className="num hide-sm muted">{rating(s.offenseRating)}</td>
                  <td className="num hide-sm muted">{rating(s.defenseRating)}</td>
                  <td className="num">
                    {s.wins}–{s.losses}
                  </td>
                  <td className="num hide-sm">{pct(s.record, 1)}</td>
                  <td className="hide-sm">
                    <Form form={s.form.slice(-5)} />
                  </td>
                  <td className={`num streak-${s.streak.kind}`}>
                    {s.streak.kind}
                    {s.streak.length}
                    {s.streak.kind === 'W' && s.streak.length >= 3 ? ' 🔥' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className="section-title">
        Classic boards <span className="muted">· since 2012</span>
      </h2>
      <div className="boards">
        {classics.map((b) => (
          <BoardCard key={b.title} b={b} />
        ))}
      </div>

      <h2 className="section-title">Advanced</h2>
      <div className="boards">
        {modern.map((b) => (
          <BoardCard key={b.title} b={b} />
        ))}
      </div>
    </div>
  );
}
