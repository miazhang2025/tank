import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SECTIONS, WORDMARK } from '../content/sections.js';
import { STAGE, STAGE_MOBILE, STAGE_ORDER } from '../scene/choreography.js';
import Section from './Section.jsx';

gsap.registerPlugin(ScrollTrigger);

const lerp = (a, b, t) => a + (b - a) * t;
const N = STAGE_ORDER.length;

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
      duration: 1.15,
      easing: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.1,
    });
    lenisRef.current = lenis;
    lenis.stop(); // held until the intro settles (active=true)

    lenis.on('scroll', ScrollTrigger.update);
    const tickerFn = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    const applyProgress = (p) => {
      const P = p * (N - 1); // fractional section index
      progressRef.current = P;
      const i = Math.min(N - 2, Math.max(0, Math.floor(P)));
      const f = P - i;
      const stage = mobileRef.current ? STAGE_MOBILE : STAGE;
      const a = stage[STAGE_ORDER[i]];
      const b = stage[STAGE_ORDER[i + 1]];
      const c = scene.controls;
      c.cameraZ = lerp(a.cameraZ, b.cameraZ, f);
      c.creatures.axolotl.sx = lerp(a.axolotl.sx, b.axolotl.sx, f);
      c.creatures.axolotl.sy = lerp(a.axolotl.sy, b.axolotl.sy, f);
      c.creatures.octopus.sx = lerp(a.octopus.sx, b.octopus.sx, f);
      c.creatures.octopus.sy = lerp(a.octopus.sy, b.octopus.sy, f);

      // cross-fade each layer by its distance from the current section index
      for (let k = 0; k < layerRefs.current.length; k++) {
        const el = layerRefs.current[k];
        if (!el) continue;
        const o = Math.max(0, 1 - Math.abs(P - k) / 0.5);
        el.style.opacity = String(o);
        el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
        el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
      }

      // publish the snapped section index (drives bubble reveal) without
      // re-rendering on every scroll frame
      const ai = Math.round(P);
      if (ai !== activeRef.current) {
        activeRef.current = ai;
        setActiveIndex(ai);
      }
    };

    const st = ScrollTrigger.create({
      trigger: spacerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      snap: {
        snapTo: 1 / (N - 1),
        duration: { min: 0.25, max: 0.6 },
        ease: 'power2.inOut',
      },
      onUpdate: (self) => applyProgress(self.progress),
    });

    applyProgress(0);
    ScrollTrigger.refresh();

    // sidebar navigation hook
    scene.scrollToSection = (idx) => {
      const i = Math.max(0, Math.min(N - 1, idx));
      const max = document.documentElement.scrollHeight - window.innerHeight;
      lenis.scrollTo((i / (N - 1)) * max, { duration: 1.1 });
    };

    // dev-only hook so headless tests can drive the scroll
    if (import.meta.env && import.meta.env.DEV) {
      window.__aquaria = { scrollToSection: scene.scrollToSection, lenis };
    }

    return () => {
      st.kill();
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
            {s.title && <h2 className="section-title">{s.title}</h2>}
            <Section
              scene={scene}
              index={k}
              activeIndex={activeIndex}
              data={s}
              mobile={mobile}
              progressRef={progressRef}
            />
          </div>
        ))}
      </div>
    </>
  );
}
