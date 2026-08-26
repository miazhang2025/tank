import { useEffect, useState } from 'react';

const TOUCH =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// What the home section is actually offering, in the order a visitor is most
// likely to want it: get moving first, then the two things that are easy to
// miss because nothing on screen looks like a button.
const HINTS = TOUCH
  ? ['swipe to dive', 'tap the glass', 'tap a creature']
  : ['scroll to dive', 'knock on the glass', 'poke a creature'];

const CYCLE = 4200; // ms per caption

/**
 * The home section's affordance indicator: a bottom-centre caption that cycles
 * through what the tank responds to, over a chevron that sinks on a loop (the
 * site's scroll metaphor is a descent — see choreography's monotonic camY).
 *
 * Shows only on `main`, and only once the intro camera drop has settled. Once
 * the visitor has left the home section under their own steam it stays gone for
 * the rest of the session: it exists to answer "what do I do here", and coming
 * back up means that question is already answered.
 *
 * Clicking it dives to the next section — the hint should do the thing it
 * describes. It carries `ui-surface` so that click is not ALSO read as a knock
 * on the glass (see createAquarium's onUISurface guard).
 *
 * @param {object}  props.scene       live scene instance (for scrollToSection)
 * @param {boolean} props.active      intro settled / scrolling released
 * @param {number}  props.activeIndex snapped section index (0 = main)
 */
export default function DiveHint({ scene, active, activeIndex }) {
  const [i, setI] = useState(0);
  const [spent, setSpent] = useState(false);

  useEffect(() => {
    if (activeIndex !== 0) setSpent(true);
  }, [activeIndex]);

  const show = active && activeIndex === 0 && !spent;

  useEffect(() => {
    if (!show) return undefined;
    const id = setInterval(() => setI((v) => v + 1), CYCLE);
    return () => clearInterval(id);
  }, [show]);

  return (
    <button
      type="button"
      className={`dive-hint ui-surface${show ? '' : ' is-out'}`}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => scene && scene.scrollToSection && scene.scrollToSection(1)}
    >
      {/* keyed so each caption re-runs its own entrance rather than swapping mid-air */}
      <span className="dive-hint-label" key={i}>
        {HINTS[i % HINTS.length]}
      </span>
      <svg className="dive-hint-chev" viewBox="0 0 18 10" aria-hidden="true">
        <path d="M1 1 L9 8 L17 1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
  );
}
