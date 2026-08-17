import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { isVideo, primaryLink } from '../content/projects.js';

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A project's case study, over the right two thirds of the frame.
 *
 * Deliberately short: one paragraph, then either the film (Video projects) or a
 * link out (everything else). The long-form material in creche-projects.json —
 * concept / design / technical / why-it-matters — is NOT shown here; the panel
 * is an introduction, not the whole write-up.
 *
 * The left third is left alone: the creatures and their conversation stay
 * visible and uncovered while you read, which is the whole reason this is a
 * panel rather than a full-screen takeover.
 *
 * Closes on the ✕, on Escape, and on a click in that left third (anywhere
 * outside the panel). While it is open the section's scroll is locked by Work
 * so the wheel scrolls THIS instead of moving the lineup or the section.
 *
 * The panel is translucent, so the tank keeps moving behind the words — and
 * the scene's composite pass ripples that water wherever the cursor crosses the
 * panel (see createAquarium's setRippleRect).
 *
 * @param {object|null} props.project  normalised project (see content/projects.js)
 * @param {object|null} props.scene
 * @param {() => void}  props.onClose
 */
export default function ProjectPanel({ project, scene, onClose }) {
  const ref = useRef(null);
  const scrollRef = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !project) return undefined;
    // always open at the top, even when switching straight from another project
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { xPercent: 6, opacity: 0 },
      { xPercent: 0, opacity: 1, duration: REDUCE ? 0.25 : 0.7, ease: 'power3.out' },
    );
    return undefined;
  }, [project]);

  // hand the panel's bounds to the scene so the ripple field is confined to it
  useEffect(() => {
    if (!scene || !scene.setRippleRect) return undefined;
    if (!project) {
      scene.setRippleRect(null);
      return undefined;
    }
    const publish = () => {
      const el = ref.current;
      if (el) scene.setRippleRect(el.getBoundingClientRect());
    };
    publish();
    window.addEventListener('resize', publish);
    return () => {
      window.removeEventListener('resize', publish);
      scene.setRippleRect(null);
    };
  }, [scene, project]);

  useEffect(() => {
    if (!project) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    // a pointerdown anywhere outside the panel closes it. Attached on the
    // render AFTER it opened, so the click that opened it can't close it.
    const onDown = (e) => {
      if (e.target && e.target.closest && e.target.closest('.project-panel')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [project, onClose]);

  // Magnetic CTA — the same behaviour the content-cloud button has: it eases
  // toward the cursor while hovered and springs back on leave. gsap.quickTo is
  // GSAP's own cursor-follow primitive (it reuses one tween instead of making a
  // new one per mousemove).
  useEffect(() => {
    const btn = ctaRef.current;
    if (!btn || REDUCE) return undefined;
    const ctx = gsap.context(() => {
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
    }, ctaRef);
    return () => ctx.revert();
  }, [project]);

  if (!project) return null;

  const href = primaryLink(project);
  const video = isVideo(project);
  // one paragraph, in order of preference — the summary is the written one;
  // the others are there so a half-filled project still says something
  const paragraph = project.summary || project.oneLiner || project.tagline;

  return (
    <article className="project-panel ui-surface" ref={ref} style={{ opacity: 0 }}>
      <button type="button" className="panel-close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      {/* data-lenis-prevent: a stopped Lenis doesn't merely ignore wheel
          events, it preventDefault()s them to keep the page frozen — which
          would freeze this panel's own scrolling too. The attribute is Lenis's
          escape hatch for exactly this: a nested scroller it must not touch. */}
      <div className="panel-scroll" ref={scrollRef} data-lenis-prevent>
        <header className="panel-head">
          <h2 className="panel-title">{project.title}</h2>
          {project.tagline && <p className="panel-tagline">{project.tagline}</p>}
          <div className="panel-meta-line">
            {project.year && <span>{project.year}</span>}
            {project.display.length > 0 && <span>{project.display.join(' · ')}</span>}
          </div>
        </header>

        {paragraph && <p className="panel-summary">{paragraph}</p>}

        {/* One media slot, filled two ways: Video projects get the film itself,
            everything else gets its looping preview from /public/preview. Both
            are 16:9 and sit in the same box, so the panel reads the same either
            way. The <img> only exists while the panel is mounted, which is what
            keeps these (multi-MB) clips off the wire until something opens. */}
        <div className="panel-media">
          {video ? (
            project.video ? (
              <iframe
                src={project.video}
                title={project.title}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            ) : (
              <div className="panel-media-empty">Film coming</div>
            )
          ) : project.preview ? (
            <img src={project.preview} alt="" loading="lazy" />
          ) : (
            <div className="panel-media-empty">Preview coming</div>
          )}
        </div>

        {/* Video projects end on the film; the rest end on a way out. */}
        {!video && href && (
          <a className="panel-cta" ref={ctaRef} href={href} target="_blank" rel="noopener">
            {project.cta || 'Open'}
          </a>
        )}
      </div>
    </article>
  );
}
