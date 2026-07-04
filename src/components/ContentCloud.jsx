import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// project preview GIFs — hovering the cloud on these sections trails a
// cursor-following clip, GSAP's own quickTo() cursor-follow pattern.
const PREVIEWS = {
  'cassette-jury': '/preview/cassette-jury.gif',
  'santa-beer': '/preview/santa-beer.gif',
  flaneur: '/preview/flaneur.gif',
};

/**
 * Frosted "thought bubble" holding a section's long-form content:
 * Darker Grotesque heading + Crimson Text body + IBM Plex Mono button.
 * Placement is per-section CSS (keyed off the parent layer's data-section).
 */
export default function ContentCloud({ content, active, id }) {
  const ref = useRef(null);
  const btnRef = useRef(null);
  const shapeRef = useRef(null);
  const splitsRef = useRef([]); // active SplitText instances, reverted before every re-split
  const previewRef = useRef(null);
  const previewSrc = PREVIEWS[id];
  const [previewLoaded, setPreviewLoaded] = useState(false);

  // revert any lingering line-splits on unmount so the original text nodes
  // are restored (SplitText wraps each line in its own element while active)
  useEffect(() => () => splitsRef.current.forEach((s) => s.revert()), []);

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

      // text reveal: split the heading + each paragraph into lines (masked so
      // they slide up out of a clipped box, per the GSAP SplitText "lines"
      // example) and stagger them in with an offset so lines cascade in one
      // after another instead of popping in together.
      splitsRef.current.forEach((s) => s.revert());
      splitsRef.current = [];
      const targets = el.querySelectorAll('.cloud-heading, .cloud-body p');
      const lines = [];
      targets.forEach((t) => {
        const split = SplitText.create(t, { type: 'lines', mask: 'lines' });
        splitsRef.current.push(split);
        lines.push(...split.lines);
      });
      if (lines.length) {
        gsap.fromTo(
          lines,
          { yPercent: 110, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: REDUCE ? 0.4 : 0.9,
            ease: 'power3.out',
            stagger: REDUCE ? 0.02 : 0.06,
            delay: REDUCE ? 0.15 : 0.4,
            overwrite: 'auto',
          },
        );
      }
    } else {
      gsap.to(el, { opacity: 0, y: 16, duration: 0.35, ease: 'power2.in' });
    }
  }, [active, content]);

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

  // hover preview: a clip trails the cursor while hovering the cloud (GSAP's
  // quickTo cursor-follow pattern — quickTo eases x/y toward the pointer each
  // move for the trailing lag). Anchored by its own top-left corner (not
  // centered) and offset a bit further down-right so it trails behind/below
  // the cursor instead of straddling it and covering the text on all sides.
  // Hidden whenever the cursor is over the CTA so it never covers the button.
  useEffect(() => {
    const el = ref.current;
    const preview = previewRef.current;
    const btn = btnRef.current;
    if (!el || !preview || !previewSrc || REDUCE) return undefined;
    const OFFSET = 22;
    gsap.set(preview, { xPercent: 0, yPercent: 0, scale: 0.82, opacity: 0 });
    const xTo = gsap.quickTo(preview, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.5, ease: 'power3' });
    const onMove = (e) => {
      xTo(e.clientX + OFFSET);
      yTo(e.clientY + OFFSET);
    };
    const onEnter = (e) => {
      if (btn && btn.contains(e.target)) return; // landed straight on the CTA — stay hidden
      setPreviewLoaded(true);
      gsap.set(preview, { x: e.clientX + OFFSET, y: e.clientY + OFFSET });
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
    };
    const onLeave = () => {
      gsap.to(preview, { opacity: 0, scale: 0.82, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
    };
    const onButtonEnter = () => {
      gsap.to(preview, { opacity: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    };
    const onButtonLeave = () => {
      gsap.to(preview, { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    btn?.addEventListener('mouseenter', onButtonEnter);
    btn?.addEventListener('mouseleave', onButtonLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      btn?.removeEventListener('mouseenter', onButtonEnter);
      btn?.removeEventListener('mouseleave', onButtonLeave);
    };
  }, [previewSrc]);

  const { heading, body, button } = content;
  const paragraphs = body ? body.split('\n\n') : [];

  return (
    <>
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
      {previewSrc && (
        <div className="cloud-preview" ref={previewRef} aria-hidden="true">
          {previewLoaded && <img src={previewSrc} alt="" />}
        </div>
      )}
    </>
  );
}
