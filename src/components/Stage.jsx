import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';
import Lenis from 'lenis';
import { SECTIONS, WORDMARK } from '../content/sections.js';
import { STAGE, STAGE_MOBILE, STAGE_ORDER } from '../scene/choreography.js';
import Section from './Section.jsx';
import DiveHint from './DiveHint.jsx';

gsap.registerPlugin(ScrollTrigger, Observer);

// One flick/swipe carries exactly one section, as a single continuous move.
// Free-scrolling the wheel only ever nudged the page a fraction of a section
// and left the rest to the snap, so every gesture read as two separate motions
// — a short jab, then a second lurch — which is what made it feel choppy no
// matter how the snap itself was tuned. Nothing "corrects" the position now:
// the gesture goes straight to the destination, so there is only one motion.
const SECTION_TRAVEL = 0.9; // seconds for a full one-section move
// Even-paced: symmetric accel/decel with no long tail, so the middle of the
// journey (where the eye actually is) runs at a near-constant speed instead of
// sprinting and coasting.
const easeInOutQuad = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) * (-2 * x + 2)) / 2);

// Mobile browsers resize the viewport every time the address bar shows/hides
// mid-scroll; by default that triggers a full (expensive) ScrollTrigger
// refresh + snap recalculation, which reads as a hitch. Our layout is pure
// vh/fixed overlays, so skipping those refreshes is safe — real orientation/
// breakpoint changes still refresh via the matchMedia listener below.
ScrollTrigger.config({ ignoreMobileResize: true });

const lerp = (a, b, t) => a + (b - a) * t;
const N = STAGE_ORDER.length;
// fallback environment tint for stages that don't override it (matches the
// base FOG_COLOR baked into createAquarium.js) — unpacked to 0..1 channels so
// both the scroll-scrubbed lerp and the GSAP dive-tween can drive plain
// numbers (controls.envR/envG/envB) rather than fighting over a packed hex.
const DEFAULT_ENV = 0x0e3a3c;
// memoised: the follower calls this four times a frame for the same handful of
// authored stage colours, and each miss allocated a fresh array for the GC
const _rgbCache = new Map();
const hexToRgb01 = (hex) => {
  let v = _rgbCache.get(hex);
  if (!v) {
    v = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    _rgbCache.set(hex, v);
  }
  return v;
};

/**
 * Owns the scroll backbone: a tall spacer creates page height, Lenis smooths the
 * scroll, and one snap ScrollTrigger reports progress. Progress is mapped to a
 * fractional section index (0…N-1) and used to (a) interpolate the camera-z +
 * creature screen anchors on the live scene and (b) cross-fade the section
 * layers. Phase 4 fills each `.section-layer` with bubbles/clouds.
 *
 * @param {object}  props.scene    live scene instance ({ controls, … })
 * @param {boolean} props.active   enable scrolling (true once the intro settles)
 * @param {object}  props.catalog  { projects, categories } from creche-projects.json
 */
export default function Stage({ scene, active, catalog }) {
  const spacerRef = useRef(null);
  const layerRefs = useRef([]);
  const lenisRef = useRef(null);
  const activeRef = useRef(0);
  const canScrollRef = useRef(false); // gestures are inert until the intro settles
  const progressRef = useRef(0); // continuous fractional section index (drives bubble reveal)
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
  );
  const mobileRef = useRef(mobile); // read inside the scroll loop without re-binding it

  // track the mobile breakpoint and refresh ScrollTrigger on layout change
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => {
      mobileRef.current = mq.matches;
      setMobile(mq.matches);
      ScrollTrigger.refresh();
    };
    mobileRef.current = mq.matches;
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!scene) return undefined;

    // Lenis is now purely the scroll ANIMATOR — every movement comes from the
    // gesture-driven lenis.scrollTo below, never from raw wheel deltas. Hence
    // smoothWheel off: the Observer already swallows the wheel event, and
    // leaving Lenis's own wheel handling on would have both of them acting on
    // the same flick.
    const lenis = new Lenis({ smoothWheel: false });
    lenisRef.current = lenis;
    lenis.stop(); // held until the intro settles (active=true)

    lenis.on('scroll', ScrollTrigger.update);
    const tickerFn = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    // Each crossing between about↔work↔more plays as a fixed-duration
    // cinematic dive (camera sinks straight down) instead of the usual
    // scroll-scrubbed lerp below, so it always reads as the same drop
    // regardless of scroll speed. diveTween owns camY/creature sx,sy (+ the
    // stage-light/env-colour/deep-glow mood) while it runs; applyVisual skips
    // those fields until it completes. The descent never reverses: `more` is
    // deeper than `work`, it just gets brighter down there (see choreography's
    // deepGlow).
    //
    // The camera leads: it starts sinking immediately and runs the full
    // duration, while the creatures hold their current screen anchor (they're
    // camera-relative, so they ride along with the sink without "swimming")
    // until DIVE_CHARACTER_DELAY in, when they start easing to the new
    // section's anchor — so the read is "camera dives, then the characters
    // catch up," not everything moving at once.
    const DIVE_DURATION = 1.6;
    const DIVE_CHARACTER_DELAY = 0.6;
    const DIVE_PAIRS = new Set([
      'about|work',
      'work|about',
      'work|more',
      'more|work',
    ]);
    // This used to guard against real flicker: free wheel scrolling plus an
    // overshooting snap could cross a boundary back and forth several times,
    // and committing to a fresh tween on each crossing made the camera jerky.
    // A gesture is now a single monotonic move to an exact destination, so a
    // boundary is crossed once and never re-crossed — the debounce is kept
    // only to coalesce a rapid burst of flicks, and held short because every
    // millisecond of it is now dead air before the camera starts sinking.
    const DIVE_DEBOUNCE = 0.05;
    let diveTween = null;
    let diveActive = false;
    let divePendingTimer = null;
    let divePendingTarget = null; // section id currently queued or in flight

    // Kicks off the actual cinematic tween toward STAGE_ORDER[toIdx]. Reads
    // scene.controls / the current mobile breakpoint fresh (not whatever was
    // captured when the crossing was first detected), since the debounce
    // above may have let a little time pass first.
    const beginDive = (fromIdx, toIdx) => {
      divePendingTarget = null;
      const c = scene.controls;
      const stage = mobileRef.current ? STAGE_MOBILE : STAGE;
      const toId = STAGE_ORDER[toIdx];
      const target = stage[toId];
      diveActive = true;
      // Section.jsx's bubble-reveal loop keys off scene.controls.diveActive
      // too (not just this closure's flag) — it reads live scroll progress
      // directly, so without this it would start revealing bubbles behind
      // the still-hidden destination layer while the camera is mid-dive.
      c.diveActive = true;
      // hold the destination section's UI/bubbles hidden until the camera
      // actually stops (onComplete below) instead of cross-fading in while
      // it's still sinking
      const toEl = layerRefs.current[toIdx];
      if (toEl) {
        toEl.style.opacity = '0';
        toEl.style.visibility = 'hidden';
        toEl.style.pointerEvents = 'none';
      }
      invalidateLayers();
      diveTween = gsap.timeline({
        onComplete: () => {
          diveActive = false;
          c.diveActive = false;
          diveTween = null;
          // The tween just placed the camera exactly on the destination's
          // framing. The follower is still carrying whatever progress it had
          // when the dive started, so hand it the settled scroll position
          // outright — letting it ease there afterwards would drag the camera
          // back off the mark it just arrived at.
          smoothP = rawP;
          invalidateLayers();
          const fromEl = layerRefs.current[fromIdx];
          const toEl2 = layerRefs.current[toIdx];
          if (fromEl) {
            gsap.to(fromEl, {
              opacity: 0,
              duration: 0.45,
              ease: 'power2.out',
              onComplete: () => {
                fromEl.style.visibility = 'hidden';
                fromEl.style.pointerEvents = 'none';
              },
            });
          }
          if (toEl2) {
            // no separate container fade here — the layer just becomes
            // visible instantly, and its content (title, content-cloud,
            // bubbles) is still individually gated at opacity:0/display:none
            // until setActiveIndex below unblocks their own entrance tweens
            toEl2.style.opacity = '1';
            toEl2.style.visibility = 'visible';
            toEl2.style.pointerEvents = 'auto';
          }
          setActiveIndex(toIdx);
        },
      });
      diveTween.to(
        c,
        {
          cameraZ: target.cameraZ,
          camY: target.camY ?? 0,
          camFollow: target.camFollow ?? 0.72,
          duration: DIVE_DURATION,
          ease: 'power2.inOut',
        },
        0,
      );
      const creatureDuration = DIVE_DURATION - DIVE_CHARACTER_DELAY;
      diveTween.to(
        c.creatures.axolotl,
        { sx: target.axolotl.sx, sy: target.axolotl.sy, duration: creatureDuration, ease: 'power2.inOut' },
        DIVE_CHARACTER_DELAY,
      );
      diveTween.to(
        c.creatures.octopus,
        { sx: target.octopus.sx, sy: target.octopus.sy, duration: creatureDuration, ease: 'power2.inOut' },
        DIVE_CHARACTER_DELAY,
      );
      const [tr, tg, tb] = hexToRgb01(target.envColor ?? DEFAULT_ENV);
      diveTween.to(
        c,
        {
          envR: tr,
          envG: tg,
          envB: tb,
          stageLight: target.stageLight ?? 0,
          deepGlow: target.deepGlow ?? 0,
          duration: DIVE_DURATION,
          ease: 'power2.inOut',
        },
        0,
      );
    };

    // ---- raw vs. smoothed scroll progress ----
    // Wheel input arrives as discrete jumps and the snap tween ramps the scroll
    // position linearly, so feeding either straight into the camera/creature
    // lerps painted that stepiness onto the screen. Split the two consumers:
    //
    //   rawP     drives section LOGIC (which section is active, when a dive
    //            fires) — no added latency on any of it.
    //   smoothP  drives every PIXEL (camera z/y, creature anchors, env tint,
    //            layer cross-fade) via an exponential follower, so the picture
    //            lands in the same place a beat later but continuously.
    //
    // SMOOTH_K is the follower's stiffness. Now that a gesture arrives as one
    // continuous eased move, this is insurance rather than the main event —
    // held stiff (~45ms) so it irons out anything jittery (a scrollbar drag, a
    // resize) without adding a visible second ease on top of the gesture's own.
    let rawP = 0;
    let smoothP = 0;
    const SMOOTH_K = 22;

    // Lenis + the snap tween both push updates through ScrollTrigger, so these
    // can be called several times per frame at the same progress (each pass
    // re-writing opacity/visibility on every section layer). Dedupe on the
    // actual progress value — identical input means identical output here.
    // The breakpoint is folded into the key (p is 0..1, so +2 can't collide)
    // because a mobile↔desktop flip at the same scroll position must still
    // re-apply with the other STAGE table.

    // ---- section logic: fed the RAW progress ----
    let lastSection = -1;
    const applySection = (p) => {
      const key = mobileRef.current ? p + 2 : p;
      if (key === lastSection) return;
      lastSection = key;
      const P = p * (N - 1); // fractional section index
      const stage = mobileRef.current ? STAGE_MOBILE : STAGE;
      const c = scene.controls;
      const ai = Math.round(P);
      c.activeSection = STAGE_ORDER[ai];
      // the project lineup's screen anchor + arc shape (breakpoint-aware, so it
      // comes from here rather than the scene reading STAGE directly) — null
      // for every section but `work`; createAquarium's orb rig consumes it
      c.lineupAnchor = stage[STAGE_ORDER[ai]].lineup || null;
      // same deal for `more`'s social-link cluster and `main`'s in-scene title
      c.socialAnchor = stage[STAGE_ORDER[ai]].social || null;
      c.bigTitle = stage[STAGE_ORDER[ai]].bigTitle || null;

      // publish the snapped section index (drives bubble reveal) without
      // re-rendering on every scroll frame
      if (ai !== activeRef.current) {
        const fromIdx = activeRef.current;
        // direction of travel into the new section — `work` reads it to decide
        // which end of its project list to land on
        c.sectionDir = ai > fromIdx ? 1 : -1;
        const fromId = STAGE_ORDER[fromIdx];
        const toId = STAGE_ORDER[ai];
        const toIdx = ai;
        activeRef.current = ai;

        const isDiveCrossing = DIVE_PAIRS.has(`${fromId}|${toId}`);

        if (isDiveCrossing) {
          // already committed to (or queued for) this exact destination —
          // a flicker back onto the same target shouldn't restart anything
          if (divePendingTarget === toId) return;
          if (divePendingTimer) clearTimeout(divePendingTimer);
          if (diveTween) {
            diveTween.kill();
            diveTween = null;
            diveActive = false;
            c.diveActive = false;
          }
          divePendingTarget = toId;
          divePendingTimer = setTimeout(() => {
            divePendingTimer = null;
            beginDive(fromIdx, toIdx);
          }, DIVE_DEBOUNCE * 1000);
        } else {
          // Normal transitions flip `activeIndex` right away, same as always.
          if (divePendingTimer) {
            clearTimeout(divePendingTimer);
            divePendingTimer = null;
            divePendingTarget = null;
          }
          if (diveTween) {
            diveTween.kill();
            diveTween = null;
            diveActive = false;
            c.diveActive = false;
            // a killed dive leaves the layers however it had forced them —
            // hand control back to the progress-driven cross-fade
            invalidateLayers();
            applyVisual(smoothP);
          }
          setActiveIndex(ai);
        }
      }
    };

    // ---- everything visible: fed the SMOOTHED progress ----
    // Last opacity/visibility/pointer-events actually written per layer. The
    // follower keeps calling this with micro-different values as it converges,
    // and re-writing an unchanged style still costs a style recalc across all
    // N layers — so only touch a property when it genuinely changed.
    const layerStyle = layerRefs.current.map(() => ({ o: '', vis: '', pe: '' }));
    let lastVisual = -1;
    // dive handlers below write layer styles directly, behind this cache's
    // back — they invalidate it so the next pass re-applies from scratch
    const invalidateLayers = () => {
      lastVisual = -1;
      layerStyle.forEach((s) => {
        s.o = s.vis = s.pe = '';
      });
    };
    const applyVisual = (p) => {
      const key = mobileRef.current ? p + 2 : p;
      if (key === lastVisual) return;
      lastVisual = key;
      const P = p * (N - 1);
      progressRef.current = P;
      const i = Math.min(N - 2, Math.max(0, Math.floor(P)));
      const f = P - i;
      const stage = mobileRef.current ? STAGE_MOBILE : STAGE;
      const a = stage[STAGE_ORDER[i]];
      const b = stage[STAGE_ORDER[i + 1]];
      const c = scene.controls;

      if (!diveActive) {
        c.cameraZ = lerp(a.cameraZ, b.cameraZ, f);
        c.camY = lerp(a.camY ?? 0, b.camY ?? 0, f);
        c.camFollow = lerp(a.camFollow ?? 0.72, b.camFollow ?? 0.72, f);
        c.creatures.axolotl.sx = lerp(a.axolotl.sx, b.axolotl.sx, f);
        c.creatures.axolotl.sy = lerp(a.axolotl.sy, b.axolotl.sy, f);
        c.creatures.octopus.sx = lerp(a.octopus.sx, b.octopus.sx, f);
        c.creatures.octopus.sy = lerp(a.octopus.sy, b.octopus.sy, f);
        const [ar, ag, ab] = hexToRgb01(a.envColor ?? DEFAULT_ENV);
        const [br, bg, bb] = hexToRgb01(b.envColor ?? DEFAULT_ENV);
        c.envR = lerp(ar, br, f);
        c.envG = lerp(ag, bg, f);
        c.envB = lerp(ab, bb, f);
        c.stageLight = lerp(a.stageLight ?? 0, b.stageLight ?? 0, f);
        c.deepGlow = lerp(a.deepGlow ?? 0, b.deepGlow ?? 0, f);
      }

      // cross-fade each layer by its distance from the current section index.
      // Skipped while a dive is in flight — its start/complete handlers below
      // own the destination layer's visibility instead, so its UI/bubbles only
      // appear once the camera has actually arrived, not while it's sinking.
      if (!diveActive) {
        for (let k = 0; k < layerRefs.current.length; k++) {
          const el = layerRefs.current[k];
          if (!el) continue;
          const o = Math.max(0, 1 - Math.abs(P - k) / 0.5);
          const s = layerStyle[k] || (layerStyle[k] = { o: '', vis: '', pe: '' });
          // quantised: the follower's tail produces changes far below what a
          // compositor can show, and each one would be a fresh style write
          const os = o.toFixed(3);
          const vis = o <= 0.001 ? 'hidden' : 'visible';
          const pe = o > 0.6 ? 'auto' : 'none';
          if (s.o !== os) el.style.opacity = s.o = os;
          if (s.vis !== vis) el.style.visibility = s.vis = vis;
          if (s.pe !== pe) el.style.pointerEvents = s.pe = pe;
        }
      }
    };

    // The follower itself. Frame-rate independent (exp of dt, not a fixed
    // per-frame fraction) so it settles identically on 60/90/120Hz panels.
    let lastMobile = mobileRef.current;
    const followTick = (time, deltaMS) => {
      // A breakpoint flip swaps the whole STAGE table under us. It used to be
      // picked up by the refresh-driven re-apply, but the follower skips
      // applyVisual entirely once settled — so catch it here, or rotating a
      // phone while parked on a section would keep the other layout's framing.
      if (mobileRef.current !== lastMobile) {
        lastMobile = mobileRef.current;
        invalidateLayers();
        applyVisual(smoothP);
      }
      if (smoothP === rawP) return;
      const dt = Math.min((deltaMS || 16.7) / 1000, 0.05);
      smoothP += (rawP - smoothP) * (1 - Math.exp(-SMOOTH_K * dt));
      // land exactly, or an asymptote leaves the camera parked a hair off the
      // section's authored framing forever
      if (Math.abs(rawP - smoothP) < 1e-5) smoothP = rawP;
      applyVisual(smoothP);
    };

    const st = ScrollTrigger.create({
      trigger: spacerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      // No snap. Gestures now land exactly on a section by construction, so a
      // snap would have nothing to correct — and it was the source of the
      // second, separate lurch at the end of every scroll.
      onUpdate: (self) => {
        rawP = self.progress;
        applySection(rawP);
      },
    });
    gsap.ticker.add(followTick);

    // ---- gesture → section ----
    // navLock holds for the duration of the move so a trackpad's inertia tail
    // (dozens of wheel events after the flick) can't queue up a stampede of
    // section jumps — one gesture, one section.
    let navLock = false;
    const goToSection = (idx, duration = SECTION_TRAVEL) => {
      if (navLock || !canScrollRef.current) return;
      const i = Math.max(0, Math.min(N - 1, idx));
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const target = (i / (N - 1)) * max;
      if (Math.abs(target - lenis.scroll) < 1) return; // already there (top/bottom edge)
      navLock = true;
      lenis.scrollTo(target, {
        duration,
        easing: easeInOutQuad,
        lock: true, // ignore stray input mid-flight rather than fighting it
        onComplete: () => {
          navLock = false;
        },
      });
    };

    // `work` holds the gesture until its lineup is exhausted: inside that
    // section a flick steps to the next/previous project, and only a flick made
    // at the end of the list falls through to the section move. The work UI
    // registers the stepper (scene.workNav) and answers whether it consumed the
    // gesture, so all the list logic stays where the list state lives.
    const stepSection = (dir) => {
      if (!canScrollRef.current) return;
      if (STAGE_ORDER[activeRef.current] === 'work' && scene.workNav && !navLock) {
        if (scene.workNav.step(dir)) return;
      }
      goToSection(activeRef.current + dir);
    };

    // Kept enabled even before the intro settles: preventDefault is what stops
    // a stray wheel from native-scrolling the page, and the handlers no-op via
    // canScrollRef until the camera drop finishes.
    const observer = Observer.create({
      target: window,
      type: 'wheel,touch',
      wheelSpeed: -1, // so onUp means "scrolled down" — GSAP's own section-snap convention
      tolerance: 10,
      preventDefault: true,
      allowClicks: true, // the orbs and the panel's CTA still need their clicks
      onUp: () => stepSection(1),
      onDown: () => stepSection(-1),
    });

    applySection(0);
    applyVisual(0);
    ScrollTrigger.refresh();
    // re-measure once web fonts land (Quedami/Plex/Crimson swap in after first
    // paint and can change wrapped-text heights) — resize is auto-handled by
    // ScrollTrigger, but font swaps are not
    let disposed = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!disposed) ScrollTrigger.refresh();
      });
    }

    // Hands the page's scroll over to a piece of UI (the open case study).
    // Killing the Observer rather than just ignoring its callbacks is the point:
    // it holds preventDefault on the wheel, so while it lives nothing inside the
    // panel can scroll natively. Lenis is stopped alongside it so the page
    // itself can't drift while the panel has the wheel.
    scene.setScrollLock = (locked) => {
      if (locked) {
        observer.disable();
        lenis.stop();
      } else {
        observer.enable();
        if (canScrollRef.current) lenis.start();
      }
    };

    // sidebar navigation hook — same single continuous move as a gesture, just
    // stretched a little for multi-section jumps so a leap across the whole
    // tank doesn't have to travel at five times the speed of a normal one
    scene.scrollToSection = (idx) => {
      const dist = Math.abs(idx - activeRef.current) || 1;
      goToSection(idx, Math.min(1.8, SECTION_TRAVEL * (1 + (dist - 1) * 0.22)));
    };

    // dev-only hook so headless tests can drive the scroll
    if (import.meta.env && import.meta.env.DEV) {
      window.__aquaria = {
        scrollToSection: scene.scrollToSection,
        lenis,
        controls: scene.controls,
        anchors: scene.anchors, // live creature screen anchors — lets tests aim a poke
      };
    }

    return () => {
      disposed = true;
      st.kill();
      if (diveTween) diveTween.kill();
      if (divePendingTimer) clearTimeout(divePendingTimer);
      gsap.ticker.remove(followTick);
      gsap.ticker.remove(tickerFn);
      observer.kill();
      lenis.destroy();
      lenisRef.current = null;
      delete scene.scrollToSection;
      delete scene.setScrollLock;
    };
  }, [scene]);

  // `more` descends into a PALE environment (see choreography's deepGlow), and
  // the fixed DOM chrome — wordmark, corner text — is authored light-on-dark.
  // Mirror the mood onto the body so those few elements can flip to dark ink
  // there (CSS transitions the change so it rides the camera dive rather than
  // snapping at the section boundary).
  useEffect(() => {
    const bright = (STAGE[STAGE_ORDER[activeIndex]]?.deepGlow ?? 0) > 0.5;
    document.body.classList.toggle('bright-stage', bright);
    return () => document.body.classList.remove('bright-stage');
  }, [activeIndex]);

  // hold / release scrolling with the intro. The Observer stays alive either
  // way (it has to keep eating stray wheel events); canScrollRef is what gates
  // whether a gesture actually moves anything.
  useEffect(() => {
    canScrollRef.current = active;
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (active) lenis.start();
    else lenis.stop();
  }, [active]);

  return (
    <>
      <div className="scroll-spacer" ref={spacerRef} style={{ height: `${N * 100}vh` }} />
      <div className="stage">
        <div className="wordmark">{WORDMARK}</div>
        {SECTIONS.map((s, k) => (
          <div
            className="section-layer"
            key={s.id}
            data-section={s.id}
            ref={(el) => {
              layerRefs.current[k] = el;
            }}
          >
            {/* isActive/near rather than the raw activeIndex: with the index,
                every section re-rendered on every crossing (7 components +
                their effects, all inside the one frame the transition starts
                on). These two only flip for the sections actually entering or
                leaving, so `memo` can skip the rest. */}
            <Section
              scene={scene}
              index={k}
              isActive={activeIndex === k}
              near={Math.abs(activeIndex - k) <= 1}
              data={s}
              mobile={mobile}
              progressRef={progressRef}
              active={active}
              catalog={catalog}
            />
          </div>
        ))}
      </div>
      <DiveHint scene={scene} active={active} activeIndex={activeIndex} />
    </>
  );
}
