/**
 * Audio: all effects are synthesised with WebAudio (no sample files).
 */
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('fooztron:muted') === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<(m: boolean) => void>();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('fooztron:muted', m ? '1' : '0');
  } catch {
    /* private mode — fine */
  }
  if (m) speechSynthesis?.cancel();
  listeners.forEach((l) => l(m));
}
export const onMuteChange = (fn: (m: boolean) => void) => (listeners.add(fn), () => listeners.delete(fn));

function ac(): AudioContext | null {
  if (muted) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/** The thunk of a ball hitting the back of the goal. */
export function thunk() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.32);
}

/** Stadium goal horn: detuned saw chord through a lowpass. */
export function horn(duration = 1.4) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.05);
  g.gain.setValueAtTime(0.18, t + duration - 0.2);
  g.gain.linearRampToValueAtTime(0, t + duration);
  lp.connect(g).connect(c.destination);
  for (const f of [174.6, 220, 261.6, 175.4]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    o.stop(t + duration);
  }
}

/** Crowd roar: band-passed noise with a swell. */
export function crowd(intensity = 1, duration = 2.2) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const src = noise(c, duration);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.25 * intensity, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
}

/** Tiny UI blip. */
export function blip(freq = 880) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.13);
}

/** Victory fanfare arpeggio. */
export function fanfare() {
  const c = ac();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.13;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.8 : 0.14));
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.9);
  });
}

// ---------------------------------------------------------------------------
// Announcer (Web Speech API)
// ---------------------------------------------------------------------------

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /en-(US|GB)/.test(v.lang) && /Daniel|Google UK English Male|Alex|Fred/i.test(v.name)) ?? vs.find((v) => v.lang.startsWith('en')) ?? null;
}
if (typeof speechSynthesis !== 'undefined') {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function announce(lines: string[], { interrupt = true } = {}) {
  if (muted || typeof speechSynthesis === 'undefined' || !lines.length) return;
  if (interrupt) speechSynthesis.cancel();
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line);
    if (voice) u.voice = voice;
    u.rate = 1.08;
    u.pitch = 0.9;
    speechSynthesis.speak(u);
  }
}
