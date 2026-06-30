import { useEffect, useMemo, useState } from 'react';

/**
 * Rising-bubbles loading overlay. Sits over the canvas until the scene reports
 * its models are loaded (`ready`), then dissolves to reveal the camera intro.
 */
export default function Loader({ ready }) {
  const [gone, setGone] = useState(false);

  // unmount shortly after the fade so it never intercepts pointer events
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setGone(true), 1200);
    return () => clearTimeout(id);
  }, [ready]);

  const bubbles = useMemo(
    () =>
      Array.from({ length: 20 }, () => ({
        left: Math.random() * 100,
        size: 5 + Math.random() * 26,
        dur: 5 + Math.random() * 7,
        delay: -Math.random() * 9,
        drift: (Math.random() * 2 - 1) * 46,
      })),
    [],
  );

  if (gone) return null;

  return (
    <div className={`loader${ready ? ' is-hidden' : ''}`} aria-hidden={ready}>
      <div className="loader-bubbles">
        {bubbles.map((b, i) => (
          <span
            key={i}
            style={{
              left: `${b.left}%`,
              '--sz': `${b.size}px`,
              '--dur': `${b.dur}s`,
              '--delay': `${b.delay}s`,
              '--drift': `${b.drift}px`,
            }}
          />
        ))}
      </div>
      <div className="loader-brand">
        <div className="loader-word">AQUARIA</div>
        <div className="loader-sub">· tank study ·</div>
        <div className="loader-load">{ready ? 'ready' : 'filling the tank'}</div>
      </div>
    </div>
  );
}
