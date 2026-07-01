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
 * at once). Like a real chat, each new bubble enters at the BOTTOM (by the
 * creature's head) and pushes the already-shown bubbles UP as the stack grows;
 * reverse-scroll drops them off the bottom again.
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
  const isActive = activeIndex === index;
  const near = Math.abs(activeIndex - index) <= 1;

  const chat = data.chat || [];
  const hasCloud = !!data.content;
  // 'about' reads as chat-only on mobile — its content cloud is skipped there
  // and the conversation bubbles take its place.
  const cloudOnMobile = hasCloud && data.id !== 'about';
  const desktopChat = !mobile;
  const mobileChat = mobile && (!hasCloud || data.id === 'about');
  const showCloud = hasCloud && (desktopChat || cloudOnMobile);

  // unified loop while near-active: follow the creatures (desktop) + reveal
  // bubbles one-by-one, bottom-up, as scroll progress approaches this section.
  useEffect(() => {
    if (!scene || !near) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;

    const GAP = mobile ? 16 : 18; // must match .cstack / .cchat `gap`
    const m = chat.length;

    // The columns that grow: both stacks on desktop, the single chat on mobile.
    // Each column holds the WHOLE timeline in DOM order (real bubbles for its own
    // turns, invisible ".spacer" copies for the other speaker's) so the two sides
    // stay aligned. Un-revealed slots are display:none → they take no space, so a
    // reveal grows the column from the bottom and lifts everything above it.
    const cols = desktopChat
      ? [axRef.current, ocRef.current].filter(Boolean)
      : Array.from(root.querySelectorAll('.cchat'));
    const colEls = cols.map((col) =>
      Array.from(col.querySelectorAll('.cbubble')).sort(
        (a, b) => Number(a.dataset.gi) - Number(b.dataset.gi),
      ),
    );

    const collapse = (el) => {
      gsap.killTweensOf(el);
      el.style.display = 'none';
      gsap.set(el, { clearProps: 'transform' });
      if (!el.classList.contains('spacer')) el.style.opacity = '0';
    };
    colEls.forEach((els) => els.forEach(collapse));
    revealedRef.current = 0;

    // reveal timeline slot `gi`: in every column, un-hide its element at the
    // bottom, then slide the already-shown ones up by its height (a real message).
    const revealGi = (gi) => {
      colEls.forEach((els) => {
        const el = els.find((e) => Number(e.dataset.gi) === gi);
        if (!el) return;
        const older = els.filter(
          (e) => Number(e.dataset.gi) < gi && e.style.display !== 'none',
        );
        el.style.display = '';
        const delta = el.offsetHeight + GAP; // final layout height of the new slot
        if (older.length) {
          // they jumped up by `delta` when the slot entered layout; slide from
          // their old spot (y:delta) back to 0 so the lift is smooth.
          gsap.fromTo(
            older,
            { y: delta },
            { y: 0, duration: REDUCE ? 0.25 : 0.55, ease: 'power3.out', overwrite: 'auto' },
          );
        }
        if (!el.classList.contains('spacer')) {
          gsap.fromTo(
            el,
            { opacity: 0, scaleX: 0.85, scaleY: 0, transformOrigin: 'center bottom' },
            {
              opacity: 1,
              scaleX: 1,
              scaleY: 1,
              duration: REDUCE ? 0.3 : 0.55,
              ease: REDUCE ? 'power2.out' : 'back.out(1.5)',
              overwrite: 'auto',
            },
          );
        }
      });
    };

    // hide the newest slot `gi`: drop it off the bottom, let the rest settle down.
    const hideGi = (gi) => {
      colEls.forEach((els) => {
        const el = els.find((e) => Number(e.dataset.gi) === gi);
        if (!el || el.style.display === 'none') return;
        const delta = el.offsetHeight + GAP;
        const older = els.filter(
          (e) => Number(e.dataset.gi) < gi && e.style.display !== 'none',
        );
        const drop = () => {
          el.style.display = 'none';
          gsap.set(el, { clearProps: 'transform' });
          if (!el.classList.contains('spacer')) el.style.opacity = '0';
        };
        if (el.classList.contains('spacer')) drop();
        else
          gsap.to(el, {
            opacity: 0,
            scaleY: 0,
            duration: 0.24,
            ease: 'power3.out',
            transformOrigin: 'center bottom',
            overwrite: 'auto',
            onComplete: drop,
          });
        if (older.length) {
          gsap.fromTo(
            older,
            { y: -delta },
            { y: 0, duration: 6, ease: 'power3.out', overwrite: 'auto' },
          );
        }
      });
    };

    const place = (el, a) => {
      if (!el || !a) return;
      el.style.transform = `translate(${a.x}px, ${a.y - 14}px) translate(-50%, -100%)`;
      el.style.opacity = a.visible ? '' : '0';
    };

    let raf = 0;
    let lastStep = 0;
    let wasActive = false;
    let enteredAt = 0;
    const REVEAL_GAP = REDUCE ? 0.35 : 0.85; // pause between successive bubble pop-ups
    const loop = () => {
      if (desktopChat) {
        place(axRef.current, scene.anchors.axolotl);
        place(ocRef.current, scene.anchors.octopus);
      }
      if (m) {
        const P = progressRef.current;
        const now = performance.now() / 1000;
        const active = Math.round(P) === index; // fully snapped/settled into this section
        if (active && !wasActive) enteredAt = now; // (re)start the pop-up sequence on arrival
        wasActive = active;

        // Reveals are paced by time-since-arrival (not scroll position) so they
        // only ever start once fully scrolled in, never mid-transition. Leaving
        // this section (scrolled elsewhere) collapses everything again.
        const target = active
          ? Math.max(0, Math.min(m, Math.floor((now - enteredAt) / REVEAL_GAP) + 1))
          : 0;
        let r = revealedRef.current;
        if (target > r && now - lastStep > REVEAL_GAP) {
          revealGi(r); // newest enters at the bottom
          r += 1;
          lastStep = now;
        } else if (target < r && now - lastStep > REVEAL_GAP) {
          r -= 1;
          hideGi(r); // newest drops off the bottom first
          lastStep = now;
        }
        revealedRef.current = r;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      revealedRef.current = 0;
      colEls.forEach((els) => els.forEach(collapse));
    };
  }, [scene, near, desktopChat, mobile]);

  const withOrder = chat.map((c, gi) => ({ ...c, gi }));
  const axolotl = withOrder.filter((c) => c.who === 'axolotl');
  const octopus = withOrder.filter((c) => c.who === 'octopus');

  return (
    <div ref={rootRef} className="section-content">
      {desktopChat && axolotl.length > 0 && (
        <div className="cstack left" ref={axRef} style={{ opacity: 0 }}>
          {withOrder.map((c) =>
            c.who === 'axolotl' ? (
              <div className="cbubble axolotl" data-gi={c.gi} key={c.gi} style={{ opacity: 0, display: 'none' }}>
                {c.text}
              </div>
            ) : (
              // invisible copy of the octopus turn — reserves its slot so the
              // axolotl replies land at the right height in the shared timeline
              <div className="cbubble spacer" data-gi={c.gi} aria-hidden="true" key={c.gi} style={{ display: 'none' }}>
                {c.text}
              </div>
            ),
          )}
        </div>
      )}
      {desktopChat && octopus.length > 0 && (
        <div className="cstack right" ref={ocRef} style={{ opacity: 0 }}>
          {withOrder.map((c) =>
            c.who === 'octopus' ? (
              <div className="cbubble octopus" data-gi={c.gi} key={c.gi} style={{ opacity: 0, display: 'none' }}>
                {c.text}
              </div>
            ) : (
              <div className="cbubble spacer" data-gi={c.gi} aria-hidden="true" key={c.gi} style={{ display: 'none' }}>
                {c.text}
              </div>
            ),
          )}
        </div>
      )}

      {mobileChat && chat.length > 0 && (
        <div className="cchat">
          {withOrder.map((c) => (
            <div className={`cbubble ${c.who}`} data-gi={c.gi} key={c.gi} style={{ opacity: 0, display: 'none' }}>
              {c.text}
            </div>
          ))}
        </div>
      )}

      {showCloud && <ContentCloud content={data.content} active={isActive} />}
    </div>
  );
}
