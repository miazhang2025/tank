/**
 * Tiny lazy SFX player for the tank's interaction sounds.
 * ------------------------------------------------------------------
 * Files live in `public/sounds/<name>.mp3` (or `.wav` as a fallback probe).
 * Nothing is fetched until the first play() call — which always happens inside
 * a click/tap handler, so creating the AudioContext then also satisfies the
 * browser autoplay policy.
 *
 * A missing file is NOT an error: the fetch 404s once, the name is remembered
 * as absent, and every later play() for it is a silent no-op. This lets the
 * interaction code ship before the audio files exist — drop the files into
 * public/sounds/ and they just start playing.
 */

let ctx = null;
const buffers = new Map(); // name -> AudioBuffer | 'loading' | 'missing'

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // a context created outside a gesture starts suspended; resume is idempotent
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

async function load(name) {
  buffers.set(name, 'loading');
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
  buffers.set(name, 'missing');
  return null;
}

/**
 * Fetch + decode these sounds now, so the first play is audible rather than
 * spent warming the cache. Call from a real user gesture (the loader's Enter
 * button) — that is also what lets the AudioContext start unsuspended.
 * @param {string[]} names
 */
export function primeSfx(names) {
  if (!ensureCtx()) return;
  for (const n of names) if (!buffers.has(n)) load(n);
}

/**
 * Play `public/sounds/<name>.(mp3|wav)`, if it exists.
 * @param {string} name        file base name, e.g. 'knock'
 * @param {object} [opts]
 * @param {number} [opts.volume=0.5]
 * @param {number} [opts.jitter=0.07]  random playbackRate spread (± this), so
 *                                     rapid repeats don't sound machine-gun identical
 */
export function playSfx(name, { volume = 0.5, jitter = 0.07 } = {}) {
  const c = ensureCtx();
  if (!c) return;
  const cached = buffers.get(name);
  if (cached === 'missing' || cached === 'loading') return;
  if (!cached) {
    // first request: kick the load; the very first knock is silent, every
    // knock after it plays — acceptable for an ambience effect
    load(name);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = cached;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(c.destination);
  src.start();
}
