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
 * reports its models are loaded (`ready`), then eases up to the brim and holds
 * there behind an "Enter" button. Clicking it (`onEnter`) spills the tank over
 * and fades to reveal the camera intro. The load has no real progress signal,
 * so the fill is indeterminate: it eases toward ~90% while assets decode, then
 * to the brim once ready.
 *
 * The water level and the READOUT are deliberately not the same number. The
 * water stops at BRIM so its wavy surface stays on screen (at a full 1.0 the
 * crests are pushed past the top edge and the tank reads as a flat block), but
 * `ready` genuinely means loaded — so the readout is scaled to hit 100% there
 * rather than parking on a puzzling 97%.
 */
const BRIM = 0.97; // water level held behind the Enter button = 100% on the readout
export default function Loader({ ready, onEnter }) {
  const [gone, setGone] = useState(false);
  const [entered, setEntered] = useState(false);
  const rootRef = useRef(null);
  const waterRef = useRef(null);
  const backRef = useRef(null);
  const frontRef = useRef(null);
  const pctRef = useRef(null);
  const enterRef = useRef(null);
  const levelRef = useRef({ v: 0 }); // 0 → 1 fill fraction (GSAP proxy)
  const applyRef = useRef(() => {});
  const idleRef = useRef(null);
  const heldRef = useRef(false);
  const toppedRef = useRef(false);

  const handleEnter = () => {
    if (entered) return;
    setEntered(true);
    onEnter?.();
  };

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
        if (pctRef.current) {
          pctRef.current.textContent = `${Math.min(100, Math.round((v / BRIM) * 100))}%`;
        }
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

  // scene ready → ease up near the brim and hold there until the visitor clicks enter
  useEffect(() => {
    if (!ready || heldRef.current || !waterRef.current) return;
    heldRef.current = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    idleRef.current?.kill();
    gsap.to(levelRef.current, {
      v: BRIM, // = 100% on the readout
      duration: reduce ? 0.3 : 1,
      ease: 'power2.out',
      onUpdate: applyRef.current,
    });
  }, [ready]);

  // Magnetic Enter button — the same behaviour the case-study CTA and the
  // content-cloud button have, so the first thing the visitor touches already
  // moves the way the rest of the site does. gsap.quickTo is GSAP's own
  // cursor-follow primitive (it reuses one tween instead of making a new one
  // per mousemove). GSAP owns this element's transform outright — hence the
  // entrance below is a tween too, rather than the CSS keyframe it replaced.
  useEffect(() => {
    const btn = enterRef.current;
    if (!btn) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        btn,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: reduce ? 0.3 : 0.5, ease: 'power2.out' },
      );
      if (reduce) return undefined;
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
      const STRENGTH = 0.4; // how far the button follows the cursor
      const onMove = (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * STRENGTH);
        yTo((e.clientY - (r.top + r.height / 2)) * STRENGTH);
      };
      const onEnter = () => gsap.to(btn, { scale: 1.06, duration: 0.3, ease: 'power3.out' });
      const onLeave = () => {
        xTo(0);
        yTo(0);
        gsap.to(btn, { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
      };
      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseenter', onEnter);
      btn.addEventListener('mouseleave', onLeave);
      return () => {
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseenter', onEnter);
        btn.removeEventListener('mouseleave', onLeave);
      };
    }, enterRef);
    return () => ctx.revert();
  }, [ready, entered]);

  // visitor clicks enter → top off to 100%, overflow the tank, then fade out + unmount
  useEffect(() => {
    if (!entered || toppedRef.current || !waterRef.current) return;
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
  }, [entered]);

  if (gone) return null;

  return (
    <div ref={rootRef} className="loader" aria-hidden={entered ? 'true' : 'false'}>
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
        <div className="loader-word">CRECHE</div>
        <div className="loader-status">
          <span className="loader-status-text">
            {entered ? 'topping off' : ready ? 'ready' : 'filling the tank'}
          </span>
          <span ref={pctRef} className="loader-pct">
            0%
          </span>
        </div>
        {ready && !entered && (
          <button type="button" className="loader-enter" ref={enterRef} onClick={handleEnter}>
            Enter
          </button>
        )}
      </div>
    </div>
  );
}
