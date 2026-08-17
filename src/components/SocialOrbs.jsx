import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SOCIAL } from '../content/social.js';

/**
 * `more`'s social links, as a cluster of clickable orbs on the right.
 *
 * Same rig as the project lineup (see createAquarium's orb groups) — the
 * material, the magnet, the hit testing and the live screen anchors are all
 * shared; only the layout differs. This component owns the DOM labels that ride
 * them and turns a click into a navigation.
 *
 * @param {object}  props.scene
 * @param {boolean} props.isActive  the `more` section is the snapped-to one
 */
export default function SocialOrbs({ scene, isActive }) {
  const labelsRef = useRef(null);

  useEffect(() => {
    if (!scene || !scene.setOrbs || !SOCIAL.length) return undefined;
    scene.setOrbs(
      'social',
      SOCIAL.map((s) => ({ id: s.id, color: s.color })),
    );
    scene.setOrbClickHandler('social', (id) => {
      const link = SOCIAL.find((s) => s.id === id);
      if (!link || !link.href) return; // no URL filled in yet — the orb is inert
      // mail: and tel: replace the tab's location by design; everything else
      // opens alongside so the tank is still there when they come back
      if (/^(mailto|tel):/.test(link.href)) window.location.href = link.href;
      else window.open(link.href, '_blank', 'noopener');
    });
    return () => {
      scene.setOrbClickHandler('social', null);
      scene.setOrbs('social', []);
    };
  }, [scene]);

  // labels ride their orb's live screen anchor, on the shared GSAP ticker
  useEffect(() => {
    if (!scene || !scene.orbAnchors || !isActive) return undefined;
    const root = labelsRef.current;
    if (!root) return undefined;
    const els = Array.from(root.querySelectorAll('.social-label'));
    const follow = () => {
      for (const el of els) {
        const a = scene.orbAnchors[el.dataset.id];
        if (!a || !a.visible) {
          el.style.opacity = '0';
          continue;
        }
        // centred UNDER its orb — the cluster is scattered, so a side anchor
        // would have labels crossing over neighbouring balls
        el.style.transform = `translate(${a.x}px, ${a.y + a.radius + 12}px) translate(-50%, 0)`;
        // links with no URL yet read at half strength — visibly not live
        el.style.opacity = String(a.alpha * (el.dataset.live === '1' ? 1 : 0.45));
      }
    };
    gsap.ticker.add(follow);
    follow();
    return () => gsap.ticker.remove(follow);
  }, [scene, isActive]);

  if (!isActive || !SOCIAL.length) return null;
  return (
    <div className="social-labels" ref={labelsRef} aria-hidden="true">
      {SOCIAL.map((s) => (
        <span
          className="social-label"
          data-id={s.id}
          data-live={s.href ? '1' : '0'}
          key={s.id}
          style={{ opacity: 0 }}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}
