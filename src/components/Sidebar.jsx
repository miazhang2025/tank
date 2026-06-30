import { useEffect, useState } from 'react';
import { MENU } from '../content/sections.js';
import { STAGE_ORDER } from '../scene/choreography.js';

// frosted-glass sidebar shape (from the uploaded brand vector)
const BLOB = {
  c1: 'M82 -32C82 -9.35633 63.6437 9 41 9C18.3563 9 0 -9.35633 0 -32C0 -54.6437 18.3563 -73 41 -73C63.6437 -73 82 -54.6437 82 -32Z',
  c2: 'M90 115C117.062 115 139 93.062 139 66C139 38.938 117.062 17 90 17C62.938 17 41 38.938 41 66C41 93.062 62.938 115 90 115Z',
  body: 'M570.656 463.531C683.998 422.547 765 313.983 765 186.5C765 23.8521 633.148 -108 470.5 -108C383.897 -108 306.025 -70.6187 252.139 -11.1113C243.276 -23.7429 228.603 -32 212 -32C184.938 -32 163 -10.062 163 17C163 40.6874 179.808 60.4491 202.148 65.0092C190.143 91.4851 181.94 120.052 178.238 150.014C177.493 150.005 176.747 150 176 150C78.7979 150 0 228.798 0 326C0 397.087 42.1442 458.33 102.81 486.107C102.274 491.332 102 496.634 102 502C102 525.176 107.12 547.157 116.29 566.872C62.3706 632.473 30 716.456 30 808C30 1017.87 200.132 1188 410 1188C619.868 1188 790 1017.87 790 808C790 655.548 700.224 524.064 570.656 463.531Z',
};
const encSvg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const maskSvg =
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 499 1080' preserveAspectRatio='none'>` +
  `<path d='${BLOB.c1}' fill='white'/>` +
  `<path fill-rule='evenodd' d='${BLOB.c2}' fill='white'/>` +
  `<path d='${BLOB.body}' fill='white'/></svg>`;

const rimSvg =
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 499 1080' preserveAspectRatio='none' fill='none'>` +
  `<path d='${BLOB.body}' stroke='rgba(255,255,255,0.55)' stroke-width='1.4'/>` +
  `<path d='${BLOB.c2}' stroke='rgba(255,255,255,0.5)' stroke-width='1.4'/>` +
  `<path d='${BLOB.c1}' stroke='rgba(255,255,255,0.45)' stroke-width='1.4'/></svg>`;

const maskUrl = encSvg(maskSvg);
const rimUrl = encSvg(rimSvg);

export default function Sidebar({ scene }) {
  const [open, setOpen] = useState(false); // Main Scene: sidebar closed by default

  // CSS keys off `body.nav-open` / `body:not(.nav-open)`, so mirror state there.
  useEffect(() => {
    document.body.classList.toggle('nav-open', open);
    return () => document.body.classList.remove('nav-open');
  }, [open]);

  const go = (target) => (e) => {
    e.preventDefault();
    const idx = STAGE_ORDER.indexOf(target);
    if (idx >= 0) scene?.scrollToSection?.(idx);
    setOpen(false);
  };

  return (
    <>
      <aside className="sidebar" style={{ WebkitMaskImage: maskUrl, maskImage: maskUrl }} />
      <div
        className="sidebar-refract"
        id="sidebarRefract"
        style={{ WebkitMaskImage: maskUrl, maskImage: maskUrl }}
      />
      <div className="sidebar-rim" id="sidebarRim" style={{ backgroundImage: rimUrl }} />

      <nav className="menu">
        {MENU.map(({ label, target }) => (
          <a key={target} href={`#${target}`} onClick={go(target)}>
            {label}
          </a>
        ))}
      </nav>

      <button
        className="nav-toggle"
        id="navToggle"
        aria-label="Toggle menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bar" />
      </button>
    </>
  );
}
