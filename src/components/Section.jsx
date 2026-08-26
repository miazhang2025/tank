import { memo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import ContentCloud from './ContentCloud.jsx';
import Work from './Work.jsx';
import SocialOrbs from './SocialOrbs.jsx';
import { POKE_LINES } from '../content/sections.js';

// data-gi for the two poke-reaction slots. Parked far above any scripted slot
// so they sort last in their column and can never be picked by the scripted
// reveal (which only ever asks for `seq % chat.length`).
const REACTION_GI = { axolotl: 900, octopus: 901 };

/**
 * One span per character, so the about copy can resolve character by character
 * (see the entrance effect). Spaces are left as plain text nodes on purpose:
 * a line only breaks at whitespace and an inline span introduces no break
 * opportunity of its own, so the copy still wraps exactly as the unsplit text
 * did — no inline-block, no change to the text metrics.
 */
const splitChars = (text) =>
  [...text].map((c, i) =>
    c === ' ' ? (
      ' '
    ) : (
      <span className="about-ch" key={i}>
        {c}
      </span>
    ),
  );

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
function Section({ scene, index, isActive, near, data, mobile, progressRef, active, catalog }) {
  const rootRef = useRef(null);
  const axRef = useRef(null);
  const ocRef = useRef(null);
  const titleRef = useRef(null);
  const revealedRef = useRef(0);

  const chat = data.chat || [];
  // `content.plain` renders the copy as a bare left-aligned block (title +
  // paragraphs, no frosted cloud around it) — see .about-block in index.css.
  const plainCopy = !!(data.content && data.content.plain);
  const hasCloud = !!data.content && !plainCopy;
  const desktopChat = !mobile;
  const mobileChat = mobile && !hasCloud;
  const showCloud = hasCloud;

  // Entrance for the section heading / plain copy block.
  //
  // A section TITLE slides down into place — same entrance language as the
  // content cloud (fromTo opacity/offset).
  //
  // The PLAIN COPY block (about) instead surfaces through the water: the whole
  // block rises and pulls from blurred into focus, while its characters resolve
  // one at a time in RANDOM order (see splitChars below) — like text coming up
  // out of the murk rather than being typed left to right.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return undefined;
    const chars = plainCopy ? el.querySelectorAll('.about-ch') : [];
    gsap.killTweensOf(el);
    if (chars.length) gsap.killTweensOf(chars);

    if (!isActive) {
      // leave on the block as a whole — retiring 150 characters individually
      // would cost more than it reads
      gsap.to(el, {
        opacity: 0,
        y: plainCopy ? 10 : -14,
        ...(plainCopy ? { filter: 'blur(10px)' } : null),
        duration: 0.35,
        ease: 'power2.in',
      });
      return undefined;
    }

    if (!plainCopy) {
      gsap.fromTo(
        el,
        { opacity: 0, y: -22 },
        { opacity: 1, y: 0, duration: REDUCE ? 0.4 : 0.9, ease: 'power3.out', delay: REDUCE ? 0 : 0.1 },
      );
      return undefined;
    }

    if (REDUCE || !chars.length) {
      gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
      return undefined;
    }

    // The block carries the rise + focus-pull; the characters carry the reveal.
    // The two are timed to OVERLAP: the focus pull has to still be running while
    // the characters are arriving, or the blur is spent on an empty box and
    // reads as nothing (the reveal is what puts ink on screen to be blurred).
    gsap.set(el, { opacity: 1 });
    gsap.fromTo(el, { y: 22 }, { y: 0, duration: 1, ease: 'power3.out', delay: 0.1 });
    gsap.fromTo(
      el,
      { filter: 'blur(18px)' },
      {
        filter: 'blur(0px)',
        // power2.inOut, not the usual out-ease: an out-ease spends most of the
        // blur in the first fifth of its duration, so the copy is sharp before
        // the eye has caught up. This holds it soft through the middle — still
        // ~8px blurred halfway — and lands late.
        duration: 1.3,
        ease: 'power2.inOut',
        delay: 0.1,
        // a filter left on the element pins it to its own compositor layer for
        // as long as the section is parked; drop it once the copy has landed
        onComplete: () => gsap.set(el, { clearProps: 'filter' }),
      },
    );
    gsap.fromTo(
      chars,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        delay: 0.1,
        // `amount` (total spread) rather than `each` (per-character): the copy
        // is editable, and with `each` a longer paragraph would silently
        // stretch the entrance out to several seconds.
        stagger: { amount: 0.9, from: 'random' },
      },
    );
    return undefined;
  }, [isActive, plainCopy]);

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

    // Bring `el` in at the BOTTOM of column `ci`: move it to the end of the DOM
    // (after a wrap-around, DOM order no longer matches the visual order), let
    // it take layout, then slide the already-shown bubbles up by its height and
    // pop it in — a real message arriving.
    const enterAtBottom = (el, ci) => {
      el.parentNode.appendChild(el);
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
    };

    // reveal the next slot in the scripted sequence
    const revealNewest = () => {
      const gi = seq % m;
      colEls.forEach((els, ci) => {
        const el = els.find((e) => Number(e.dataset.gi) === gi);
        if (el) enterAtBottom(el, ci);
      });
      seq += 1;
    };

    // A poke answers IN the conversation: the next bubble to pop is the poked
    // creature's reaction, in its normal place in the stack, rather than a
    // separate floating bubble. Text is written straight into the node — going
    // through React state would re-render the section mid-animation.
    const lastLine = {};
    const revealReaction = (who) => {
      const pool = POKE_LINES[who];
      if (!pool || !pool.length) return;
      let line = pool[(Math.random() * pool.length) | 0];
      // never the same line twice running — with a 7-line pool, plain random
      // repeats often enough to notice
      if (pool.length > 1 && line === lastLine[who]) {
        line = pool[(pool.indexOf(line) + 1) % pool.length];
      }
      lastLine[who] = line;
      colEls.forEach((els, ci) => {
        const el = els.find((e) => e.dataset.reaction === who);
        if (!el) return;
        if (!el.classList.contains('spacer')) el.textContent = line;
        enterAtBottom(el, ci);
      });
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
          // a one-off poke reaction retires for good — it was never part of the
          // scripted loop, so it drifts up the stack once and then leaves
          if (el.dataset.reaction) return;
          enterAtBottom(el, ci);
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

    // the home section owns the poke reactions (pokes can only fire there —
    // see createAquarium's mainAmt gate)
    let pendingReaction = null;
    if (index === 0) {
      scene.onPoke = (who) => {
        pendingReaction = who;
      };
    }

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
        // a pending poke jumps the queue: the visitor just did something, so the
        // answer shouldn't have to wait out a full conversational beat
        const effGap = pendingReaction ? Math.min(gap, 0.4) : gap;
        if (atSection && now - lastStep > effGap) {
          if (pendingReaction) {
            revealReaction(pendingReaction);
            pendingReaction = null;
          } else if (seq < m) {
            // still filling the stack for the first time. Keyed off `seq` (the
            // scripted count) rather than `shown`, so an injected reaction
            // can't make the scripted conversation stop short.
            revealNewest();
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
      if (index === 0) scene.onPoke = null;
      revealedRef.current = 0;
      colEls.forEach((els) => els.forEach(collapse));
    };
  }, [scene, near, desktopChat, mobile, active]);

  const withOrder = chat.map((c, gi) => ({ ...c, gi }));
  const axolotl = withOrder.filter((c) => c.who === 'axolotl');
  const octopus = withOrder.filter((c) => c.who === 'octopus');

  // Home-section poke reactions live in the conversation stacks themselves, as
  // two extra slots per column: a real bubble for the speaker this column
  // belongs to and an invisible twin for the other, exactly like a scripted
  // turn — so a reaction lands in the shared timeline instead of floating
  // beside it. `realFor` is 'both' for the single mobile column.
  // Left empty here; the reveal writes the line straight into the node.
  const reactionSlots = (realFor) =>
    index === 0
      ? ['axolotl', 'octopus'].map((who) => {
          const real = realFor === 'both' || realFor === who;
          return (
            <div
              key={`reaction-${who}`}
              className={`cbubble reaction ${real ? who : 'spacer'}`}
              data-gi={REACTION_GI[who]}
              data-reaction={who}
              aria-hidden={real ? undefined : 'true'}
              style={{ opacity: 0, display: 'none' }}
            />
          );
        })
      : null;

  return (
    <div ref={rootRef} className="section-content">
      {/* `main` and `work` have no DOM title: main's is rendered INSIDE the
          scene so the creatures swim in front of it, and work shows the
          selected project's name on its orb labels instead.
          A `plain` section puts its title inside the copy block below, so the
          two stay one left-aligned unit. */}
      {data.title && !plainCopy && (
        <h2 className="section-title" ref={titleRef} style={{ opacity: 0 }}>
          {data.title}
        </h2>
      )}

      {plainCopy && (
        <div className="about-block">
          <div className="about-inner" ref={titleRef} style={{ opacity: 0 }}>
            {data.title && <h2 className="about-title">{splitChars(data.title)}</h2>}
            {(data.content.body || '').split('\n\n').map((p, i) => (
              <p className="about-copy" key={i}>
                {splitChars(p)}
              </p>
            ))}
          </div>
        </div>
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
          {reactionSlots('axolotl')}
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
          {reactionSlots('octopus')}
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
          {reactionSlots('both')}
        </div>
      )}

      {showCloud && <ContentCloud content={data.content} active={isActive} />}

      {data.id === 'work' && catalog && (
        <Work scene={scene} catalog={catalog} isActive={isActive} mobile={mobile} />
      )}

      {data.id === 'more' && <SocialOrbs scene={scene} isActive={isActive} />}
    </div>
  );
}

export default memo(Section);
