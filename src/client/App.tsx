import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { ACHIEVEMENT_BY_ID } from '../shared/achievements.ts';
import { goalLines, kickoffLine } from '../shared/announcer.ts';
import { announce, blip, crowd, fanfare, horn, isMuted, onMuteChange, setMuted, thunk } from './audio.ts';
import Confetti, { fireConfetti } from './components/Confetti.tsx';
import Home from './pages/Home.tsx';
import Leaderboards from './pages/Leaderboards.tsx';
import Live from './pages/Live.tsx';
import MatchDetail from './pages/MatchDetail.tsx';
import Matches from './pages/Matches.tsx';
import History from './pages/History.tsx';
import NewMatch from './pages/NewMatch.tsx';
import PlayerProfile from './pages/PlayerProfile.tsx';
import Players from './pages/Players.tsx';
import { useStore } from './store.ts';
import { REACTIONS } from '../shared/wire.ts';

const ArenaPage = lazy(() => import('./pages/ArenaPage.tsx'));

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/live', label: 'Live' },
  { href: '/leaderboards', label: 'Leaderboards' },
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/history', label: 'History' },
];

/** Watches the event stream and runs the show: sound, voice, confetti, toasts. */
function Director() {
  const lastGoal = useStore((s) => s.lastGoal);
  const lastKickoff = useStore((s) => s.lastKickoff);
  const lastFinish = useStore((s) => s.lastFinish);
  const lastUnlocks = useStore((s) => s.lastUnlocks);

  useEffect(() => {
    if (!lastKickoff) return;
    const { world } = useStore.getState();
    const m = world.matches[lastKickoff.matchId];
    if (!m) return;
    horn(0.6);
    announce([kickoffLine(m, world.players, lastKickoff.seq)]);
  }, [lastKickoff]);

  useEffect(() => {
    if (!lastGoal) return;
    const { world } = useStore.getState();
    const m = world.matches[lastGoal.matchId];
    if (!m) return;
    thunk();
    setTimeout(() => {
      horn();
      crowd(m.status === 'final' ? 1.6 : 1);
    }, 180);
    announce(goalLines(m, world.players, lastGoal.seq));
  }, [lastGoal]);

  useEffect(() => {
    if (!lastFinish) return;
    const { world, toast } = useStore.getState();
    const m = world.matches[lastFinish.matchId];
    if (!m?.winner) return;
    setTimeout(fanfare, 900);
    fireConfetti(m.winner === 'white' ? ['#ffffff', '#e9e4d8', '#ffc53d'] : ['#4f8cff', '#9cc0ff', '#ffc53d']);
    const n = (p: keyof typeof m.lineup) => world.players[m.lineup[p]]?.name;
    toast({
      tone: 'win',
      emoji: '🏆',
      title: `${m.winner === 'white' ? 'White' : 'Blue'} wins ${Math.max(m.white, m.blue)}–${Math.min(m.white, m.blue)}`,
      body: `${n(`${m.winner}_offense`)} & ${n(`${m.winner}_defense`)}`,
    });
  }, [lastFinish]);

  useEffect(() => {
    const { world, toast } = useStore.getState();
    lastUnlocks.forEach((u, i) => {
      const a = ACHIEVEMENT_BY_ID[u.achievementId];
      setTimeout(() => {
        blip(1320);
        toast({ tone: 'achievement', emoji: a.emoji, title: `${world.players[u.playerId]?.name} unlocked ${a.name}`, body: a.description });
      }, 1600 + i * 700);
    });
  }, [lastUnlocks]);

  return null;
}

function ReactionRain() {
  const reactions = useStore((s) => s.reactions);
  return (
    <div className="reaction-rain" aria-hidden>
      {reactions.map((r) => (
        <span key={r.id} style={{ left: `${r.x}%` }}>
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar() {
  const react = useStore((s) => s.react);
  return (
    <div className="reaction-bar" role="group" aria-label="Send a reaction to everyone watching">
      {REACTIONS.map((e) => (
        <button key={e} onClick={() => react(e)} aria-label={`React ${e}`}>
          {e}
        </button>
      ))}
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismiss);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast-${t.tone ?? 'info'}`} onClick={() => dismiss(t.id)}>
          {t.emoji && <span className="toast-emoji">{t.emoji}</span>}
          <span>
            <strong>{t.title}</strong>
            {t.body && <span className="toast-body">{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function MuteButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => {
    const off = onMuteChange(setM);
    return () => void off();
  }, []);
  return (
    <button className="icon-btn" onClick={() => setMuted(!m)} aria-label={m ? 'Unmute sound and announcer' : 'Mute sound and announcer'} title={m ? 'Unmute' : 'Mute'}>
      {m ? '🔇' : '🔊'}
    </button>
  );
}

function ConnectionPill() {
  const conn = useStore((s) => s.conn);
  const spectators = useStore((s) => s.spectators);
  const latency = useStore((s) => s.latency);
  return (
    <span className={`conn conn-${conn}`} title={latency !== null ? `${latency}ms round trip` : undefined}>
      <span className="conn-dot" />
      {conn === 'live' ? `${spectators} watching` : conn === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
    </span>
  );
}

function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [, navigate] = useLocation();
  const players = useStore((s) => s.world.players);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQ('');
        setSel(0);
      } else if (e.key === 'Escape') setOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  const items = useMemo(() => {
    const all = [
      { label: '⚡ Start a new match', href: '/new' },
      { label: '🏟️ Open Jumbotron (TV mode)', href: '/arena' },
      ...NAV.map((n) => ({ label: `→ ${n.label}`, href: n.href })),
      ...Object.values(players).map((p) => ({ label: `👤 ${p.name}`, href: `/players/${p.id}` })),
    ];
    const needle = q.toLowerCase();
    return all.filter((i) => i.label.toLowerCase().includes(needle)).slice(0, 9);
  }, [q, players]);

  if (!open) return null;
  const go = (href: string) => {
    navigate(href);
    setOpen(false);
  };
  return (
    <div className="palette-backdrop" onClick={() => setOpen(false)}>
      <div className="palette" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          placeholder="Jump to anything…"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, items.length - 1));
            if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0));
            if (e.key === 'Enter' && items[sel]) go(items[sel].href);
          }}
        />
        <ul>
          {items.map((it, i) => (
            <li key={it.href + it.label}>
              <button className={i === sel ? 'active' : ''} onMouseEnter={() => setSel(i)} onClick={() => go(it.href)}>
                {it.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="palette-hint">↑↓ to move · ↵ to go · esc to close</div>
      </div>
    </div>
  );
}

function Header() {
  const [loc] = useLocation();
  const live = useStore((s) => s.world.liveMatchId);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [loc]);
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Fooztron home">
        <span className="brand-mark">⚽</span>
        <span className="brand-word">
          FOOZTRON<sup>2</sup>
        </span>
      </Link>
      <button className="icon-btn menu-btn" aria-expanded={menu} aria-label="Menu" onClick={() => setMenu((m) => !m)}>
        ☰
      </button>
      <nav className={menu ? 'open' : ''}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={(n.href === '/' ? loc === '/' : loc.startsWith(n.href)) ? 'active' : ''}>
            {n.label}
            {n.href === '/live' && live && <span className="live-dot" aria-label="match in progress" />}
          </Link>
        ))}
      </nav>
      <div className="topbar-right">
        <ConnectionPill />
        <button className="kbd-btn" onClick={() => dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} aria-label="Open command palette">
          <kbd>⌘K</kbd>
        </button>
        <MuteButton />
      </div>
    </header>
  );
}

function Splash() {
  return (
    <div className="splash">
      <div className="splash-ball">⚽</div>
      <div>Replaying the event log…</div>
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const [loc] = useLocation();
  const fullscreen = loc.startsWith('/arena');
  return (
    <>
      <Director />
      <Confetti />
      <ReactionRain />
      <Toasts />
      <CommandPalette />
      {!fullscreen && <Header />}
      <main className={fullscreen ? 'main-full' : 'main'}>
        {!ready ? (
          <Splash />
        ) : (
          <Suspense fallback={<Splash />}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/new" component={NewMatch} />
              <Route path="/live" component={Live} />
              <Route path="/arena" component={ArenaPage} />
              <Route path="/leaderboards" component={Leaderboards} />
              {/* Fooztron 1 URLs */}
              <Route path="/leaderboard">{() => <Leaderboards />}</Route>
              <Route path="/leaderboard/:number">{(p) => <Leaderboards params={p} />}</Route>
              <Route path="/players" component={Players} />
              <Route path="/players/:id">{(p) => <PlayerProfile id={p.id} />}</Route>
              <Route path="/matches" component={Matches} />
              <Route path="/matches/:id">{(p) => <MatchDetail id={p.id} />}</Route>
              <Route path="/history" component={History} />
              <Route>
                <div className="page">
                  <h1>Page not found</h1>
                  <Link href="/">Back to home</Link>
                </div>
              </Route>
            </Switch>
          </Suspense>
        )}
      </main>
      {!fullscreen && (
        <footer className="footer">
          <span>
            Fooztron · since 2012 · <Link href="/history">History</Link>
          </span>
          <span className="muted">Press ⌘K to search</span>
        </footer>
      )}
    </>
  );
}
