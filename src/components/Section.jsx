import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ContentCloud from './ContentCloud.jsx';

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One section's DOM content. Two layouts:
 *
 *  Desktop — two conversation stacks (axolotl left / octopus right) anchored
 *    above each creature and followed every frame, plus an optional content cloud.
 *
 *  Mobile — sections with a content cloud show the cloud full-width; chat-only
 *    sections show a single iMessage-style column.
 *
 * Conversation bubbles reveal ONE BY ONE, paced against scroll progress (not all
 * at once) with a squish-deform pop-in; reverse-scroll hides them again.
 *
 * @param {object}  props.scene
 * @param {number}  props.index
 * @param {number}  props.activeIndex
 * @param {object}  props.data
 * @param {boolean} props.mobile
 * @param {{current:number}} props.progressRef  continuous fractional section index
 */
export default function Section({ scene, index, activeIndex, data, mobile, progressRef }) {
  const rootRef = useRef(null);
  const axRef = useRef(null);
  const ocRef = useRef(null);
  const revealedRef = useRef(0);
  const lastRevealRef = useRef(0);
  const isActive = activeIndex === index;
  const near = Math.abs(activeIndex - index) <= 1;

  const chat = data.chat || [];
  const hasCloud = !!data.content;
  const desktopChat = !mobile;
  const mobileChat = mobile && !hasCloud;

  // unified loop while near-active: follow the creatures (desktop) + reveal
  // bubbles one-by-one as scroll progress approaches this section.
  useEffect(() => {
    if (!scene || !near) return undefined;
    const root = rootRef.current;
    const bubbles = root
      ? Array.from(root.querySelectorAll('.cbubble')).sort(
          (a, b) => Number(a.dataset.order) - Number(b.dataset.order),
        )
      : [];
    const m = bubbles.length;

    const place = (el, a) => {
      if (!el || !a) return;
      el.style.transform = `translate(${a.x}px, ${a.y - 14}px) translate(-50%, -100%)`;
      el.style.opacity = a.visible ? '' : '0';
    };
    const show = (el) =>
      gsap.fromTo(
        el,
        { opacity: 0, scaleX: 0.5, scaleY: 0.72, y: 22, transformOrigin: 'center bottom' },
        {
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          y: 0,
          ease: REDUCE ? 'power2.out' : 'elastic.out(1, 0.6)',
          duration: REDUCE ? 0.3 : 0.8,
          overwrite: true,
        },
      );
    const hide = (el) =>
      gsap.to(el, { opacity: 0, scaleY: 0.8, y: 10, duration: 0.25, ease: 'power2.in', overwrite: true });

    let raf = 0;
    const loop = () => {
      if (desktopChat) {
        place(axRef.current, scene.anchors.axolotl);
        place(ocRef.current, scene.anchors.octopus);
      }
      if (m) {
        const P = progressRef.current;
        // reveal across the last ~0.7 of the scroll INTO this section
        const approach = (P - (index - 0.8)) / 0.7;
        const targetCount = Math.max(0, Math.min(m, Math.round(approach * m)));
        let r = revealedRef.current;
        const now = performance.now() / 1000;
        if (targetCount > r) {
          // one at a time, paced so they never pop in together
          if (now - lastRevealRef.current > (REDUCE ? 0.06 : 0.16)) {
            show(bubbles[r]);
            r += 1;
            lastRevealRef.current = now;
          }
        } else if (targetCount < r) {
          while (r > targetCount) {
            r -= 1;
            hide(bubbles[r]);
          }
        }
        revealedRef.current = r;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      // reset so revisiting the section re-reveals from scratch
      revealedRef.current = 0;
      bubbles.forEach((el) => gsap.set(el, { opacity: 0 }));
    };
  }, [scene, near, desktopChat, mobile]);

  const withOrder = chat.map((c, gi) => ({ ...c, gi }));
  const axolotl = withOrder.filter((c) => c.who === 'axolotl');
  const octopus = withOrder.filter((c) => c.who === 'octopus');

  return (
    <div ref={rootRef} className="section-content">
      {desktopChat && axolotl.length > 0 && (
        <div className="cstack left" ref={axRef} style={{ opacity: 0 }}>
          {axolotl.map((c) => (
            <div className="cbubble axolotl" data-order={c.gi} key={c.gi} style={{ opacity: 0 }}>
              {c.text}
            </div>
          ))}
        </div>
      )}
      {desktopChat && octopus.length > 0 && (
        <div className="cstack right" ref={ocRef} style={{ opacity: 0 }}>
          {octopus.map((c) => (
            <div className="cbubble octopus" data-order={c.gi} key={c.gi} style={{ opacity: 0 }}>
              {c.text}
            </div>
          ))}
        </div>
      )}

      {mobileChat && chat.length > 0 && (
        <div className="cchat">
          {withOrder.map((c) => (
            <div className={`cbubble ${c.who}`} data-order={c.gi} key={c.gi} style={{ opacity: 0 }}>
              {c.text}
            </div>
          ))}
        </div>
      )}

      {hasCloud && <ContentCloud content={data.content} active={isActive} />}
    </div>
  );
}
