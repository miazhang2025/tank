import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Frosted "thought bubble" holding a section's long-form content:
 * Darker Grotesque heading + Crimson Text body + IBM Plex Mono button.
 * Placement is per-section CSS (keyed off the parent layer's data-section).
 */
export default function ContentCloud({ content, active }) {
  const ref = useRef(null);
  const btnRef = useRef(null);
  const shapeRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.killTweensOf(el);
    if (active) {
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.92, y: 26 },
        { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.15 },
      );
    } else {
      gsap.to(el, { opacity: 0, y: 16, duration: 0.35, ease: 'power2.in' });
    }
  }, [active]);

  // Magnetic CTA: the button eases toward the cursor while hovered and springs
  // back on leave (plus a small scale). gsap.context() scopes + reverts it.
  // The blob's SHAPE also reacts to which edge the cursor crossed: it squishes
  // inward from that edge on entry, then stretches back out through the same
  // edge on exit — a "liquid" poke instead of a uniform scale.
  useEffect(() => {
    const btn = btnRef.current;
    const shape = shapeRef.current;
    if (!btn || REDUCE) return undefined;
    const ctx = gsap.context(() => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
      const STRENGTH = 0.4; // how far the button follows the cursor

      // nearest edge the pointer crossed, as an angle bucket: 0 right, 1 bottom, 2 left, 3 top
      const edgeOf = (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        return Math.round(Math.atan2(y, x) / (Math.PI / 2) + 4) % 4;
      };
      const poke = (edge, entering) => {
        if (!shape) return;
        const axisX = edge === 0 || edge === 2; // right/left
        const near = entering ? 0.82 : 1.22; // squish in on entry, bulge out on exit
        const far = entering ? 1.06 : 0.94;
        gsap.killTweensOf(shape);
        gsap
          .timeline()
          .to(shape, {
            scaleX: axisX ? near : far,
            scaleY: axisX ? far : near,
            duration: 0.22,
            ease: 'power2.out',
          })
          .to(shape, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      };

      const onMove = (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * STRENGTH);
        yTo((e.clientY - (r.top + r.height / 2)) * STRENGTH);
      };
      const onEnter = (e) => {
        gsap.to(btn, { scale: 1.06, duration: 0.3, ease: 'power3.out' });
        poke(edgeOf(e), true);
      };
      const onLeave = (e) => {
        xTo(0);
        yTo(0);
        gsap.to(btn, { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
        poke(edgeOf(e), false);
      };
      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseenter', onEnter);
      btn.addEventListener('mouseleave', onLeave);
      return () => {
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseenter', onEnter);
        btn.removeEventListener('mouseleave', onLeave);
      };
    }, btnRef);
    return () => ctx.revert();
  }, [content.button]);

  const { heading, body, button } = content;
  const paragraphs = body ? body.split('\n\n') : [];

  return (
    <div className="content-cloud" ref={ref} style={{ opacity: 0 }}>
      <div className="cloud-inner">
        {heading && <h3 className="cloud-heading">{heading}</h3>}
        <div className="cloud-body">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {button && (
          <a
            className="cloud-button"
            ref={btnRef}
            href={button.href || '#'}
            target={button.href ? '_blank' : undefined}
            rel={button.href ? 'noopener' : undefined}
            onClick={(e) => {
              if (!button.href) e.preventDefault();
            }}
          >
            <span className="cloud-button-shape" ref={shapeRef} aria-hidden="true" />
            <span className="cloud-button-label">{button.label}</span>
          </a>
        )}
      </div>
    </div>
  );
}
