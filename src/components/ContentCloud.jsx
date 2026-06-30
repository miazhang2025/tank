import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Frosted "thought bubble" holding a section's long-form content:
 * Darker Grotesque heading + Crimson Text body + IBM Plex Mono button.
 * Placement is per-section CSS (keyed off the parent layer's data-section).
 */
export default function ContentCloud({ content, active }) {
  const ref = useRef(null);

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
            href={button.href || '#'}
            onClick={(e) => {
              if (!button.href) e.preventDefault();
            }}
          >
            {button.label}
          </a>
        )}
      </div>
    </div>
  );
}
