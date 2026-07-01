import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';

// A seamless wave outline that fills down to the bottom of the water body.
// `waves` periods span the 1440-wide viewBox; the <svg> is rendered at 200%
// width and scrolled left by 50% — a whole number of periods — for an endless,
// jump-free loop. Each period is a crest (q up) then a trough (q down).
function wavePath(waves, amp, base, width = 1440, height = 1000) {
  const half = width / waves / 2;
  let d = `M0 ${base}`;
  for (let i = 0; i < waves; i++) {
    d += ` q${half / 2} ${-amp} ${half} 0 q${half / 2} ${amp} ${half} 0`;
  }
  return `${d} L${width} ${height} L0 ${height} Z`;
}
const WAVE_BACK = wavePath(4, 44, 54); // broad, slow, sits behind
const WAVE_FRONT = wavePath(6, 30, 66); // tighter, faster, the main surface

/**
 * Filling-tank loading overlay. A wavy water level rises (GSAP) until the scene
 * reports its models are loaded (`ready`), then tops off, briefly overflows, and
 * fades to reveal the camera intro. The load has no real progress signal, so the
 * fill is indeterminate: it eases toward ~90% while assets decode, then rushes to
 * 100% the moment `ready` flips.
 */
export default function Loader({ ready }) {
  const [gone, setGone] = useState(false);
  const rootRef = useRef(null);
  const waterRef = useRef(null);
  const backRef = useRef(null);
  const frontRef = useRef(null);
  const pctRef = useRef(null);
  const levelRef = useRef({ v: 0 }); // 0 → 1 fill fraction (GSAP proxy)
  const applyRef = useRef(() => {});
  const idleRef = useRef(null);
  const toppedRef = useRef(false);

  const bubbles = useMemo(
    () =>
      Array.from({ length: 9 }, () => ({
        left: 6 + Math.random() * 88,
        size: 6 + Math.random() * 15,
        top: 4 + Math.random() * 16,
        rise: 60 + Math.random() * 150,
        dur: 3.2 + Math.random() * 3.2,
      })),
    [],
  );

  // ambient loop: liquid waves, surface bob, rising bubbles + the indeterminate fill
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const water = waterRef.current;
      gsap.set(water, { yPercent: 100 }); // start with an empty tank

      // map the proxy fill level onto the water lift + the % readout
      const apply = () => {
        const v = levelRef.current.v;
        gsap.set(water, { yPercent: (1 - v) * 100 });
        if (pctRef.current) pctRef.current.textContent = `${Math.min(100, Math.round(v * 100))}%`;
      };
      applyRef.current = apply;

      if (!reduce) {
        // liquid surface: two wave sheets scroll at different speeds (seamless)
        gsap.to(backRef.current, { xPercent: -50, duration: 8.5, ease: 'none', repeat: -1 });
        gsap.to(frontRef.current, { xPercent: -50, duration: 5.2, ease: 'none', repeat: -1 });
        // whole surface breathes up/down a touch
        gsap.to(water, { y: 12, duration: 2.7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        // bubbles rise toward the surface and pop
        gsap.utils.toArray(rootRef.current.querySelectorAll('.loader-bubble')).forEach((el) => {
          const rise = parseFloat(el.dataset.rise);
          const dur = parseFloat(el.dataset.dur);
          gsap.to(el, {
            keyframes: {
              '0%': { y: 0, opacity: 0, scale: 0.5 },
              '12%': { opacity: 0.85 },
              '82%': { opacity: 0.85 },
              '100%': { y: -rise, opacity: 0, scale: 1 },
              easeEach: 'sine.out',
            },
            duration: dur,
            repeat: -1,
            delay: -Math.random() * dur, // desync so they don't pulse in lockstep
          });
        });
      }

      // indeterminate fill: ease toward 90% while the models decode
      idleRef.current = gsap.to(levelRef.current, {
        v: 0.9,
        duration: reduce ? 0.4 : 6.5,
        ease: 'power2.out',
        onUpdate: apply,
      });
      apply();
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // scene ready → top off to 100%, overflow the tank, then fade out + unmount
  useEffect(() => {
    if (!ready || toppedRef.current || !waterRef.current) return;
    toppedRef.current = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    idleRef.current?.kill();
    const apply = applyRef.current;
    const tl = gsap.timeline({ onComplete: () => setGone(true) });
    tl.to(levelRef.current, {
      v: 1,
      duration: reduce ? 0.3 : 0.8,
      ease: 'power2.inOut',
      onUpdate: apply,
    });
    if (!reduce) {
      tl.to(levelRef.current, { v: 1.1, duration: 0.55, ease: 'power1.in', onUpdate: apply }, '>-0.1');
    }
    tl.to(
      rootRef.current,
      { autoAlpha: 0, duration: reduce ? 0.4 : 0.75, ease: 'power2.inOut' },
      reduce ? '>' : '<0.2',
    );
    return () => tl.kill();
  }, [ready]);

  if (gone) return null;

  return (
    <div ref={rootRef} className="loader" aria-hidden={ready ? 'true' : 'false'}>
      <div ref={waterRef} className="loader-water">
        <svg
          ref={backRef}
          className="loader-wave loader-wave--back"
          viewBox="0 0 1440 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={WAVE_BACK} />
        </svg>
        <svg
          ref={frontRef}
          className="loader-wave loader-wave--front"
          viewBox="0 0 1440 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={WAVE_FRONT} />
        </svg>
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="loader-bubble"
            data-rise={b.rise}
            data-dur={b.dur}
            style={{ left: `${b.left}%`, top: `${b.top}%`, '--sz': `${b.size}px` }}
          />
        ))}
      </div>

      <div className="loader-brand">
        <div className="loader-word">AQUARIA</div>
        <div className="loader-status">
          <span className="loader-status-text">{ready ? 'topping off' : 'filling the tank'}</span>
          <span ref={pctRef} className="loader-pct">
            0%
          </span>
        </div>
      </div>
    </div>
  );
}
