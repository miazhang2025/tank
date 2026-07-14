import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SECTIONS, WORDMARK } from '../content/sections.js';
import { STAGE, STAGE_MOBILE, STAGE_ORDER } from '../scene/choreography.js';
import Section from './Section.jsx';

gsap.registerPlugin(ScrollTrigger);

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
const hexToRgb01 = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/**
 * Owns the scroll backbone: a tall spacer creates page height, Lenis smooths the
 * scroll, and one snap ScrollTrigger reports progress. Progress is mapped to a
 * fractional section index (0…N-1) and used to (a) interpolate the camera-z +
 * creature screen anchors on the live scene and (b) cross-fade the section
 * layers. Phase 4 fills each `.section-layer` with bubbles/clouds.
 *
 * @param {object}  props.scene   live scene instance ({ controls, … })
 * @param {boolean} props.active  enable scrolling (true once the intro settles)
 */
export default function Stage({ scene, active }) {
  const spacerRef = useRef(null);
  const layerRefs = useRef([]);
  const lenisRef = useRef(null);
  const activeRef = useRef(0);
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

    const lenis = new Lenis({
      // shorter coast after the wheel stops — most of the perceived "wait for
      // the snap" was this smoothing tail, not the snap tween itself
      duration: 0.3,
      easing: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.1,
    });
    lenisRef.current = lenis;
    lenis.stop(); // held until the intro settles (active=true)

    lenis.on('scroll', ScrollTrigger.update);
    const tickerFn = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    // Each crossing between about↔cassette-jury↔santa-beer↔flaneur plays as a
    // fixed-duration cinematic dive (camera sinks straight down) instead of
    // the usual scroll-scrubbed lerp below, so it always reads as the same
    // drop regardless of scroll speed. diveTween owns camY/creature sx,sy
    // (+ the stage-light/env-colour mood) while it runs; applyProgress skips
    // those fields until it completes. flaneur↔more is NOT one of these — it's
    // a normal scroll-scrubbed rise back to the surface.
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
      'about|cassette-jury',
      'cassette-jury|about',
      'cassette-jury|santa-beer',
      'santa-beer|cassette-jury',
      'santa-beer|flaneur',
      'flaneur|santa-beer',
    ]);
    // Real scrolling can flicker back and forth across a section boundary a
    // few times before Lenis/ScrollTrigger's snap settles (each wheel tick, or
    // the snap's own ease overshooting) — committing to a fresh tween on every
    // flicker was what made the camera feel jerky/not smooth. DIVE_DEBOUNCE
    // waits a beat to see if the crossing "sticks" before actually starting
    // the tween, and re-triggers are ignored outright if they're already
    // headed to the same destination.
    const DIVE_DEBOUNCE = 0.12;
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
      diveTween = gsap.timeline({
        onComplete: () => {
          diveActive = false;
          c.diveActive = false;
          diveTween = null;
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
      diveTween.to(c, { cameraZ: target.cameraZ, camY: target.camY ?? 0, duration: DIVE_DURATION, ease: 'power2.inOut' }, 0);
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
        { envR: tr, envG: tg, envB: tb, stageLight: target.stageLight ?? 0, duration: DIVE_DURATION, ease: 'power2.inOut' },
        0,
      );
    };

    // Lenis + the snap tween both push updates through ScrollTrigger, so
    // onUpdate can fire several times per frame at the same progress (each
    // pass re-writing opacity/visibility on every section layer). Dedupe on
    // the actual progress value — identical input means identical output here.
    // The breakpoint is folded into the key (p is 0..1, so +2 can't collide)
    // because a mobile↔desktop flip at the same scroll position must still
    // re-apply with the other STAGE table.
    let lastApplied = -1;
    const applyProgress = (p) => {
      const key = mobileRef.current ? p + 2 : p;
      if (key === lastApplied) return;
      lastApplied = key;
      const P = p * (N - 1); // fractional section index
      progressRef.current = P;
      const i = Math.min(N - 2, Math.max(0, Math.floor(P)));
      const f = P - i;
      const stage = mobileRef.current ? STAGE_MOBILE : STAGE;
      const a = stage[STAGE_ORDER[i]];
      const b = stage[STAGE_ORDER[i + 1]];
      const c = scene.controls;
      const ai = Math.round(P);
      c.activeSection = STAGE_ORDER[ai];
      // the section prop model's screen anchor (breakpoint-aware, so it comes
      // from here rather than the scene reading STAGE directly) — null for
      // sections without a prop; createAquarium's updateProps consumes it
      c.propAnchor = stage[STAGE_ORDER[ai]].prop || null;

      if (!diveActive) {
        c.cameraZ = lerp(a.cameraZ, b.cameraZ, f);
        c.camY = lerp(a.camY ?? 0, b.camY ?? 0, f);
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
          el.style.opacity = String(o);
          el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
          el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
        }
      }

      // publish the snapped section index (drives bubble reveal) without
      // re-rendering on every scroll frame
      if (ai !== activeRef.current) {
        const fromIdx = activeRef.current;
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
          }
          setActiveIndex(ai);
        }
      }
    };

    const st = ScrollTrigger.create({
      trigger: spacerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      snap: {
        snapTo: 1 / (N - 1),
        // quick settle: the snap starts the moment scrolling stops (no delay)
        // and finishes fast, so the section "arrives" right after the flick
        duration: { min: 0.08, max: 0.2 },
        delay: 0,
        // linear, not eased — an eased snap accelerates/decelerates the
        // scroll position itself, which read as a wobble/hitch rather than a
        // smooth settle
        ease: 'none',
      },
      onUpdate: (self) => applyProgress(self.progress),
    });

    applyProgress(0);
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

    // sidebar navigation hook
    scene.scrollToSection = (idx) => {
      const i = Math.max(0, Math.min(N - 1, idx));
      const max = document.documentElement.scrollHeight - window.innerHeight;
      lenis.scrollTo((i / (N - 1)) * max, { duration: 1.1 });
    };

    // dev-only hook so headless tests can drive the scroll
    if (import.meta.env && import.meta.env.DEV) {
      window.__aquaria = { scrollToSection: scene.scrollToSection, lenis, controls: scene.controls };
    }

    return () => {
      disposed = true;
      st.kill();
      if (diveTween) diveTween.kill();
      if (divePendingTimer) clearTimeout(divePendingTimer);
      gsap.ticker.remove(tickerFn);
      lenis.destroy();
      lenisRef.current = null;
      delete scene.scrollToSection;
    };
  }, [scene]);

  // hold / release scrolling with the intro
  useEffect(() => {
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
            <Section
              scene={scene}
              index={k}
              activeIndex={activeIndex}
              data={s}
              mobile={mobile}
              progressRef={progressRef}
              active={active}
            />
          </div>
        ))}
      </div>
    </>
  );
}
