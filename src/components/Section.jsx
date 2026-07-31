import { memo, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ContentCloud from './ContentCloud.jsx';

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sections whose content cloud is replaced by a clickable 3D prop model (see
// createAquarium's prop block): the cloud starts CLOSED on every entry and
// only opens when the model is clicked; clicking anywhere outside closes it.
const PROP_SECTIONS = new Set(['cassette-jury', 'santa-beer', 'flaneur']);

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
 * Memoised (see the export at the bottom): the props below are all stable or
 * boolean, so a section that isn't entering or leaving skips re-rendering
 * entirely when the active index moves.
 *
 * @param {object}  props.scene
 * @param {number}  props.index
 * @param {boolean} props.isActive  this section is the snapped-to one
 * @param {boolean} props.near      within one section of active (runs the follow/reveal loop)
 * @param {object}  props.data
 * @param {boolean} props.mobile
 * @param {{current:number}} props.progressRef  continuous fractional section index
 * @param {boolean} props.active  scrolling/reveal enabled (true once the intro settles)
 */
function Section({ scene, index, isActive, near, data, mobile, progressRef, active }) {
  const rootRef = useRef(null);
  const axRef = useRef(null);
  const ocRef = useRef(null);
  const titleRef = useRef(null);
  const revealedRef = useRef(0);

  // section title fades + slides in on arrival, out on departure — same
  // entrance language as the content cloud (fromTo opacity/offset).
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return undefined;
    gsap.killTweensOf(el);
    if (isActive) {
      gsap.fromTo(
        el,
        { opacity: 0, y: -22 },
        { opacity: 1, y: 0, duration: REDUCE ? 0.4 : 0.9, ease: 'power3.out', delay: REDUCE ? 0 : 0.1 },
      );
    } else {
      gsap.to(el, { opacity: 0, y: -14, duration: 0.35, ease: 'power2.in' });
    }
  }, [isActive]);

  const chat = data.chat || [];
  const hasCloud = !!data.content;
  // 'about' reads as chat-only on mobile — its content cloud is skipped there
  // and the conversation bubbles take its place.
  const cloudOnMobile = hasCloud && data.id !== 'about';
  const desktopChat = !mobile;
  const mobileChat = mobile && (!hasCloud || data.id === 'about');
  const showCloud = hasCloud && (desktopChat || cloudOnMobile);
  const isPropSection = PROP_SECTIONS.has(data.id);
  const [cloudOpen, setCloudOpen] = useState(false);

  // clicking the section's 3D prop opens the cloud — the scene raycasts the
  // model on mousedown/touchstart and fires the callback registered here
  useEffect(() => {
    if (!scene || !isPropSection || !scene.propClickHandlers) return undefined;
    scene.propClickHandlers[data.id] = () => setCloudOpen(true);
    return () => {
      delete scene.propClickHandlers[data.id];
    };
  }, [scene, isPropSection, data.id]);

  // clicking anywhere outside the open cloud closes it. The pointerdown that
  // OPENED it can't immediately close it: this listener only attaches on the
  // render after cloudOpen flips, once that event is long finished.
  useEffect(() => {
    if (!cloudOpen) return undefined;
    const onDown = (e) => {
      if (e.target && e.target.closest && e.target.closest('.content-cloud')) return;
      setCloudOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [cloudOpen]);

  // every (re)entry into the section starts with the cloud closed
  useEffect(() => {
    if (!isActive) setCloudOpen(false);
  }, [isActive]);

  // unified loop while near-active: follow the creatures (desktop) + reveal
  // bubbles one-by-one, bottom-up, as scroll progress approaches this section.
  useEffect(() => {
    if (!scene || !near || !active) return undefined;
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

    // Plain style writes rather than gsap.set(clearProps) — this runs over
    // every bubble in the section, on the frame the section becomes near, i.e.
    // exactly the frame the transition needs. gsap.set has to parse the target
    // and re-read its computed transform to clear it; assigning '' does the
    // same job here for a fraction of the cost.
    const collapse = (el) => {
      gsap.killTweensOf(el);
      el.style.display = 'none';
      el.style.transform = '';
      if (!el.classList.contains('spacer')) el.style.opacity = '0';
    };
    colEls.forEach((els) => els.forEach(collapse));
    revealedRef.current = 0;

    // `visible[ci]` tracks, per column, the elements currently shown — oldest
    // first, newest last — independent of their fixed `gi` slot. That lets the
    // conversation wrap around: once every line has had its turn, the oldest
    // one at the top retires while the first line reappears fresh at the
    // bottom, so it plays on a loop instead of stopping or resetting.
    const visible = colEls.map(() => []);
    let seq = 0; // next content slot to reveal = seq % m

    // reveal the next slot in sequence: un-hide it at the bottom, then slide
    // the already-shown ones up by its height (a real message arriving).
    const revealNewest = () => {
      const gi = seq % m;
      colEls.forEach((els, ci) => {
        const el = els.find((e) => Number(e.dataset.gi) === gi);
        if (!el) return;
        const older = visible[ci].slice();
        el.style.display = '';
        const delta = el.offsetHeight + GAP; // final layout height of the new slot
        if (older.length) {
          // they jumped up by `delta` when the slot entered layout; slide from
          // their old spot (y:delta) back to 0 so the lift is smooth.
          gsap.fromTo(
            older,
            { y: delta },
            {
              y: 0,
              duration: REDUCE ? 0.25 : 0.55,
              ease: 'power3.out',
              overwrite: 'auto',
              // drop the leftover inline transform once settled: keeping it (even
              // at an identity offset) pins the bubble to its own GPU layer, which
              // makes Chromium render the text with grayscale AA instead of the
              // normal subpixel AA — it reads lighter/thinner until deselected.
              onComplete: () => older.forEach((o) => gsap.set(o, { clearProps: 'transform' })),
            },
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
              onComplete: () => gsap.set(el, { clearProps: 'transform' }),
            },
          );
        } else {
          el.style.opacity = '';
        }
        visible[ci].push(el);
      });
      seq += 1;
    };

    // drop the newest (bottom-most) shown bubble off the bottom, let the rest
    // settle down — used when backing out of the section mid-conversation.
    const retireNewest = () => {
      colEls.forEach((els, ci) => {
        const el = visible[ci].pop();
        if (!el) return;
        const delta = el.offsetHeight + GAP;
        const older = visible[ci];
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
          const settled = older.slice(); // snapshot: `older` (visible[ci]) can still grow before onComplete fires
          gsap.fromTo(
            older,
            { y: -delta },
            {
              y: 0,
              duration: 0.6,
              ease: 'power3.out',
              overwrite: 'auto',
              onComplete: () => settled.forEach((o) => gsap.set(o, { clearProps: 'transform' })),
            },
          );
        }
      });
    };

    // Once the whole conversation has had its turn, the "next" line is always
    // the very bubble sitting oldest at the top (same fixed DOM node — there's
    // only one element per line). So a wrap-around swap can't reveal-while-
    // retiring the same node at once; it has to retire it from the top first,
    // then re-append it as the last child and reveal it again at the bottom.
    // The stack is bottom-anchored, so retiring from the top needs no
    // compensating slide for the rest — only the fresh bottom entry does.
    const RETIRE_DUR = 0.3;
    const wrapOldestToNewest = () => {
      colEls.forEach((els, ci) => {
        const el = visible[ci].shift();
        if (!el) return;
        const reappear = () => {
          el.style.display = 'none';
          gsap.set(el, { clearProps: 'transform' });
          if (!el.classList.contains('spacer')) el.style.opacity = '0';
          el.parentNode.appendChild(el); // move to the end so DOM order matches the new visual order

          const older = visible[ci].slice();
          el.style.display = '';
          const delta = el.offsetHeight + GAP;
          if (older.length) {
            gsap.fromTo(
              older,
              { y: delta },
              {
                y: 0,
                duration: REDUCE ? 0.25 : 0.55,
                ease: 'power3.out',
                overwrite: 'auto',
                onComplete: () => older.forEach((o) => gsap.set(o, { clearProps: 'transform' })),
              },
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
                onComplete: () => gsap.set(el, { clearProps: 'transform' }),
              },
            );
          } else {
            el.style.opacity = '';
          }
          visible[ci].push(el);
        };
        if (el.classList.contains('spacer')) {
          gsap.delayedCall(RETIRE_DUR, reappear);
        } else {
          gsap.to(el, {
            opacity: 0,
            scaleY: 0,
            duration: RETIRE_DUR,
            ease: 'power2.in',
            transformOrigin: 'center bottom',
            overwrite: 'auto',
            onComplete: reappear,
          });
        }
      });
    };

    const place = (el, a) => {
      if (!el || !a) return;
      el.style.transform = `translate(${a.x}px, ${a.y - 14}px) translate(-50%, -100%)`;
      el.style.opacity = a.visible ? '' : '0';
    };

    let lastStep = 0;
    let wasActive = false;
    // intro section (index 0) runs its pop-ups noticeably slower than the rest,
    // and irregularly — like a real conversation — instead of a fixed metronome
    const OTHER_GAP = REDUCE ? 0.35 : 0.85;
    const MAIN_GAP_MIN = REDUCE ? 0.5 : 1.3;
    const MAIN_GAP_MAX = REDUCE ? 0.8 : 2.3;
    const nextGap = () =>
      index === 0 ? MAIN_GAP_MIN + Math.random() * (MAIN_GAP_MAX - MAIN_GAP_MIN) : OTHER_GAP;
    let gap = nextGap();

    const loop = () => {
      if (desktopChat) {
        place(axRef.current, scene.anchors.axolotl);
        place(ocRef.current, scene.anchors.octopus);
      }
      if (m) {
        const P = progressRef.current;
        const now = performance.now() / 1000;
        // fully snapped/settled into this section — also held off during the
        // cinematic camera dive, whose scroll position settles (and
        // Math.round(P) flips) well before the camera actually arrives, so
        // bubbles don't silently advance behind the still-hidden layer
        const atSection = Math.round(P) === index && !scene.controls.diveActive;
        if (atSection && !wasActive) {
          // (re)start the conversation fresh from its first line on arrival —
          // also undo any DOM reordering a previous loop pass left behind, so
          // the stack renders in its original top-to-bottom order again
          seq = 0;
          visible.forEach((arr) => (arr.length = 0));
          colEls.forEach((els) => {
            els
              .slice()
              .sort((a, b) => Number(a.dataset.gi) - Number(b.dataset.gi))
              .forEach((el) => el.parentNode.appendChild(el));
          });
        }
        wasActive = atSection;

        const shown = visible[0] ? visible[0].length : 0;
        if (atSection && now - lastStep > gap) {
          if (shown < m) {
            revealNewest(); // still filling the stack for the first time
          } else if (index === 0) {
            // only the opening scene loops forever; every other section just
            // stays fully revealed once its conversation has played out
            wrapOldestToNewest(); // full stack: retire the oldest, replay it fresh at the bottom
          }
          lastStep = now;
          gap = nextGap(); // re-roll so the next pause is a different length too
        } else if (!atSection && shown > 0 && now - lastStep > gap) {
          retireNewest(); // scrolled away: collapse newest-first
          lastStep = now;
          gap = nextGap();
        }
        revealedRef.current = shown;
      }
    };
    // On the shared GSAP ticker rather than its own rAF: Lenis and Stage's
    // progress follower already run there, so this reads the scroll progress
    // and creature anchors produced by the same frame instead of trailing them
    // by one — which is what made the bubbles shimmer against the heads they
    // are pinned to. It's also one rAF callback for the page instead of one
    // per near-active section.
    gsap.ticker.add(loop);
    loop();

    return () => {
      gsap.ticker.remove(loop);
      revealedRef.current = 0;
      colEls.forEach((els) => els.forEach(collapse));
    };
  }, [scene, near, desktopChat, mobile, active]);

  const withOrder = chat.map((c, gi) => ({ ...c, gi }));
  const axolotl = withOrder.filter((c) => c.who === 'axolotl');
  const octopus = withOrder.filter((c) => c.who === 'octopus');

  return (
    <div ref={rootRef} className="section-content">
      {/* prop sections get a 3D in-scene title instead (createAquarium's
          buildPropTitles) so the model can genuinely occlude the text —
          rendering the DOM one too would double it up */}
      {data.title && !isPropSection && (
        <h2 className="section-title" ref={titleRef} style={{ opacity: 0 }}>
          {data.title}
        </h2>
      )}
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
          {withOrder.map((c) =>
            c.who === 'axolotl' || c.who === 'octopus' ? (
              <div className={`cbubble ${c.who}`} data-gi={c.gi} key={c.gi} style={{ opacity: 0, display: 'none' }}>
                {c.text}
              </div>
            ) : (
              // no bubble art for third-voice "regulars" beats — same as desktop,
              // it reserves its slot silently instead of showing an unstyled box
              <div className="cbubble spacer" data-gi={c.gi} aria-hidden="true" key={c.gi} style={{ display: 'none' }}>
                {c.text}
              </div>
            ),
          )}
        </div>
      )}

      {showCloud && (
        <ContentCloud
          content={data.content}
          active={isPropSection ? isActive && cloudOpen : isActive}
          id={data.id}
          interactive={!isPropSection || cloudOpen}
        />
      )}
    </div>
  );
}

export default memo(Section);
