/**
 * The tank's audio: one looping ambience bed plus the short interaction hits.
 * ------------------------------------------------------------------
 * Files live in `public/sounds/<name>.mp3` (or `.wav` as a fallback probe).
 * Nothing is fetched until the first play()/prime — which happens inside the
 * loader's Enter click, so creating the AudioContext there also satisfies the
 * browser autoplay policy.
 *
 * A missing file is NOT an error: the fetch 404s once, the name is remembered
 * as absent, and every later play() for it is a silent no-op. This lets the
 * interaction code ship before the audio files exist — drop the files into
 * public/sounds/ and they just start playing.
 *
 * Everything routes through one master gain, so mute is a single knob and the
 * ambience bed ducks together with the hits in one ramp.
 */

const MUTE_KEY = 'tank:muted';

let ctx = null;
let master = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* private mode / storage disabled — start unmuted */
}

const buffers = new Map(); // name -> AudioBuffer | null (null = file absent)
const pending = new Map(); // name -> Promise<AudioBuffer|null>
const muteListeners = new Set(); // UI subscribers (the corner toggle)

let ambience = null; // { name, volume, src, gain } — the looping bed

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    armGestureResume();
  }
  // a context created outside a gesture starts suspended; resume is idempotent
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Belt and braces for the ambience bed: if the Enter click somehow didn't count
// as an activation gesture (Safari is picky about which events do), the next
// real interaction — anywhere on the page — unsuspends the context instead.
let armed = false;
const RESUME_EVENTS = ['pointerdown', 'touchstart', 'keydown'];
function armGestureResume() {
  if (armed) return;
  armed = true;
  const kick = () => {
    if (!ctx) return;
    ctx.resume().catch(() => {});
    if (ctx.state === 'running') {
      for (const ev of RESUME_EVENTS) window.removeEventListener(ev, kick);
    }
  };
  for (const ev of RESUME_EVENTS) window.addEventListener(ev, kick, { passive: true });
}

async function load(name) {
  for (const ext of ['mp3', 'wav']) {
    try {
      const res = await fetch(`/sounds/${name}.${ext}`);
      if (!res.ok) continue;
      const raw = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(raw);
      buffers.set(name, buf);
      return buf;
    } catch {
      /* try the next extension */
    }
  }
  buffers.set(name, null); // absent — never fetched again
  return null;
}

/** Decode-once, memoised by name. Requires ensureCtx() to have run. */
function getBuffer(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  let p = pending.get(name);
  if (!p) {
    p = load(name).finally(() => pending.delete(name));
    pending.set(name, p);
  }
  return p;
}

/**
 * Fetch + decode these sounds now, so the first play is audible rather than
 * spent warming the cache. Call from a real user gesture (the loader's Enter
 * button) — that is also what lets the AudioContext start unsuspended.
 * @param {string[]} names
 */
export function primeSfx(names) {
  if (!ensureCtx()) return;
  for (const n of names) getBuffer(n);
}

/**
 * Play `public/sounds/<name>.(mp3|wav)`, if it exists.
 * @param {string} name        file base name, e.g. 'poke'
 * @param {object} [opts]
 * @param {number} [opts.volume=0.5]
 * @param {number} [opts.jitter=0.07]  random playbackRate spread (± this), so
 *                                     rapid repeats don't sound machine-gun identical
 */
export function playSfx(name, { volume = 0.5, jitter = 0.07 } = {}) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const buf = buffers.get(name);
  if (!buf) {
    // first request: kick the load and stay silent this once. primeSfx() on
    // Enter means that normally never happens; a known-absent file returns
    // here forever.
    if (!buffers.has(name)) getBuffer(name);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(master);
  src.start();
}

/** Play one of `names` at random — the five bubble pops share a single trigger. */
export function playSfxRandom(names, opts) {
  if (!names || !names.length) return;
  playSfx(names[(Math.random() * names.length) | 0], opts);
}

/**
 * Start (or swap to) the looping ambience bed. Idempotent: calling it again
 * with the same name while it is already running does nothing, so it is safe
 * to fire from a React effect without restarting the loop.
 */
export function startAmbience(name, { volume = 0.35, fadeIn = 3 } = {}) {
  const c = ensureCtx();
  if (!c || (ambience && ambience.name === name)) return;
  stopAmbience(0);
  const rec = { name, volume, src: null, gain: null };
  ambience = rec;
  getBuffer(name).then((buf) => {
    if (!buf || ambience !== rec || !ctx) return; // absent, or superseded mid-load
    const gain = ctx.createGain();
    gain.gain.value = 0.0001; // an exponential ramp cannot start from a true zero
    gain.connect(master);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true; // decoded PCM loops seamlessly; <audio loop> would gap on mp3
    src.connect(gain);
    src.start();
    rec.src = src;
    rec.gain = gain;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.max(0.05, fadeIn));
  });
}

export function stopAmbience(fadeOut = 0.6) {
  const rec = ambience;
  ambience = null;
  if (!rec || !rec.src || !ctx) return;
  const { src, gain } = rec;
  if (fadeOut > 0) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeOut);
    src.stop(now + fadeOut + 0.05);
  } else {
    try {
      src.stop();
    } catch {
      /* never started, or already stopped */
    }
  }
}

/* ---------- mute ---------- */

export function isSfxMuted() {
  return muted;
}

export function setSfxMuted(next) {
  muted = !!next;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* nothing to remember it with — the toggle still works for this visit */
  }
  const c = muted ? ctx : ensureCtx(); // unmuting may be the first gesture we get
  if (c && master) {
    const now = c.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.25);
  }
  for (const fn of muteListeners) fn(muted);
}

export function toggleSfxMuted() {
  setSfxMuted(!muted);
  return muted;
}

/** Subscribe to mute changes; returns an unsubscribe. */
export function onSfxMute(fn) {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

// A bed that keeps looping in a background tab is just noise in someone else's
// room. Suspending freezes it where it is; returning resumes in place.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}
