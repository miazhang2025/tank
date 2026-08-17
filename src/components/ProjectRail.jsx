import { useCallback, useEffect, useRef } from 'react';

/**
 * The work section's control rail — vertically centred on the right edge.
 *
 * Three controls over the same two pieces of state Work owns:
 *   · category chips   filter the lineup
 *   · project list     jump straight to one
 *   · progress track   shows where you are in the filtered list; click or drag
 *                      anywhere on it to scrub through the lineup
 *
 * Carries `ui-surface` so the scene treats it as DOM UI: orbs behind it stop
 * magnetising and clicks on it never fall through to the tank.
 *
 * @param {string[]} props.categories
 * @param {object[]} props.projects  the FILTERED list, in lineup order
 * @param {number}   props.index     selected position within that list
 */
export default function ProjectRail({
  categories,
  category,
  onCategory,
  projects,
  index,
  onSelect,
  hidden,
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  // map a pointer y within the track to a list position
  const pick = useCallback(
    (clientY) => {
      const el = trackRef.current;
      if (!el || projects.length < 2) return;
      const r = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
      onSelect(Math.round(t * (projects.length - 1)));
    },
    [projects.length, onSelect],
  );

  // drag continues outside the track (and past the window edge), so the move /
  // up listeners live on the document rather than the element
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      pick(e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [pick]);

  const fill = projects.length > 1 ? index / (projects.length - 1) : 0;

  return (
    <aside className={`project-rail ui-surface${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <div className="rail-chips" role="tablist" aria-label="Project categories">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === category}
            className={`rail-chip${c === category ? ' is-on' : ''}`}
            onClick={() => onCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="rail-body">
        <div
          className="rail-track"
          ref={trackRef}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            pick(e.clientY);
          }}
        >
          <span className="rail-track-line" />
          <span
            className="rail-track-thumb"
            style={{ top: `${fill * 100}%` }}
            aria-hidden="true"
          />
        </div>

        <ol className="rail-list">
          {projects.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={`rail-item${i === index ? ' is-on' : ''}`}
                onClick={() => onSelect(i)}
              >
                {p.title}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="rail-count">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <span className="rail-count-sep">/</span>
        <span>{String(projects.length).padStart(2, '0')}</span>
      </div>
    </aside>
  );
}
