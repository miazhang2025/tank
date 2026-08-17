import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { inCategory, isWip } from '../content/projects.js';
import ProjectRail from './ProjectRail.jsx';
import ProjectPanel from './ProjectPanel.jsx';

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A flick has an inertia tail of dozens of wheel events; without a lock one
// gesture would run the whole lineup. Slightly shorter than the slide itself so
// a deliberate second flick still feels immediate.
const STEP_LOCK_MS = 620;

/**
 * The `work` section's brain.
 *
 * Owns the two pieces of state everything else in the section reads — which
 * category is filtered to, and which project inside that filtered list is
 * selected — and pushes both down into the 3D lineup:
 *
 *   scene.setProjectOrbs(list)   one orb per project (built once per catalog)
 *   scene.setLineupOrder(ids)    which orbs are strung on the arc, in order
 *   controls.projectP            fractional slot index, TWEENED so the whole
 *                                arc slides between projects instead of jumping
 *
 * Selection is deliberately tweened on the scene's control rather than driven
 * from React state per frame: the orbs are re-laid-out every frame from that
 * one number, so a GSAP tween on it is the entire transition.
 *
 * It also owns the section's gesture contract (scene.workNav): inside `work` a
 * flick steps through the lineup, and only a flick at either end of the list
 * falls through to Stage's section move.
 *
 * @param {object}  props.scene
 * @param {{projects: object[], categories: string[]}} props.catalog
 * @param {boolean} props.isActive  the work section is the snapped-to one
 */
export default function Work({ scene, catalog, isActive, mobile }) {
  const [category, setCategory] = useState('All');
  const [index, setIndex] = useState(0);
  const [openId, setOpenId] = useState(null); // project whose case study is open
  const tweenRef = useRef(null);
  const labelsRef = useRef(null);

  const projects = catalog.projects;
  const visible = projects.filter((p) => inCategory(p, category));
  // the gesture handler is registered once but must see today's list/index
  const navRef = useRef({ index: 0, count: 0, lockUntil: 0 });
  navRef.current.index = index;
  navRef.current.count = visible.length;

  // build one orb per project — only when the catalog itself changes, not on
  // every filter change (filtering just re-strings which orbs are on the arc)
  useEffect(() => {
    if (!scene || !scene.setOrbs || !projects.length) return undefined;
    scene.setOrbs('work', projects.map((p) => ({ id: p.id, color: p.color })));
    return () => scene.setOrbs('work', []);
  }, [scene, projects]);

  // re-string the arc whenever the filter changes
  useEffect(() => {
    if (!scene || !scene.setOrbOrder) return;
    scene.setOrbOrder('work', visible.map((p) => p.id));
  }, [scene, category, projects]);

  // a different list makes the old index meaningless — start over at the top
  useEffect(() => {
    setIndex(0);
  }, [category]);

  // Arriving from BELOW (scrolling up out of `more`) should land on the last
  // project, so continuing the same gesture keeps walking the list backwards
  // instead of jumping to its start.
  useEffect(() => {
    if (!isActive || !scene) return;
    const dir = scene.controls.sectionDir ?? 1;
    setIndex(dir < 0 ? Math.max(0, visible.length - 1) : 0);
  }, [isActive, scene]);

  // the actual lineup movement: tween the scene's fractional slot index
  useEffect(() => {
    if (!scene) return undefined;
    if (tweenRef.current) tweenRef.current.kill();
    tweenRef.current = gsap.to(scene.controls, {
      projectP: index,
      duration: REDUCE ? 0.2 : 0.85,
      ease: 'power3.out',
      overwrite: 'auto',
    });
    return undefined;
  }, [scene, index]);

  const select = useCallback(
    (i) => setIndex((prev) => {
      const next = Math.max(0, Math.min(navRef.current.count - 1, i));
      return next === prev ? prev : next;
    }),
    [],
  );

  // gesture contract with Stage: returns true when the flick was spent inside
  // the lineup, false at either end so the section move happens instead
  useEffect(() => {
    if (!scene) return undefined;
    scene.workNav = {
      step: (dir) => {
        const nav = navRef.current;
        const next = nav.index + dir;
        if (next < 0 || next > nav.count - 1) return false;
        const now = performance.now();
        if (now < nav.lockUntil) return true; // still riding the last flick — swallow, don't advance
        nav.lockUntil = now + STEP_LOCK_MS;
        setIndex(next);
        return true;
      },
    };
    return () => {
      delete scene.workNav;
    };
  }, [scene]);

  // Clicking an orb selects it and opens its case study — except for a
  // work-in-progress, which has nothing written yet: it still selects (so you
  // can see it in the lineup) but never opens an empty panel.
  useEffect(() => {
    if (!scene || !scene.setOrbClickHandler) return undefined;
    scene.setOrbClickHandler('work', (id) => {
      const i = visible.findIndex((p) => p.id === id);
      if (i >= 0) select(i);
      const project = visible[i];
      if (project && !isWip(project)) setOpenId(id);
    });
    return () => scene.setOrbClickHandler('work', null);
  }, [scene, visible, select]);

  // While the case study is open the tank hands its input over to it: the page
  // scroll is locked (so the wheel scrolls the panel, not the lineup or the
  // section) and the lineup itself fades back to leave the frame to the reading.
  useEffect(() => {
    if (!scene) return undefined;
    const open = !!openId;
    scene.controls.lineupHidden = open;
    scene.setScrollLock?.(open);
    // the fixed page chrome is outside this component's DOM (and outside the
    // stage's stacking context), so it gets told through the body instead
    document.body.classList.toggle('panel-open', open);
    return () => {
      scene.controls.lineupHidden = false;
      scene.setScrollLock?.(false);
      document.body.classList.remove('panel-open');
    };
  }, [scene, openId]);

  // leaving the section (or changing the filter) closes the case study
  useEffect(() => {
    if (!isActive) setOpenId(null);
  }, [isActive]);
  useEffect(() => {
    setOpenId(null);
  }, [category]);

  // Labels ride their orb's live screen anchor, on the shared GSAP ticker (the
  // same frame that placed the orbs, so they never trail the ball they name).
  useEffect(() => {
    if (!scene || !scene.orbAnchors || !isActive) return undefined;
    const root = labelsRef.current;
    if (!root) return undefined;
    const els = Array.from(root.querySelectorAll('.orb-label'));
    const follow = () => {
      for (const el of els) {
        const a = scene.orbAnchors[el.dataset.id];
        if (!a || !a.visible) {
          el.style.opacity = '0';
          continue;
        }
        // Desktop: to the LEFT of its orb, right-aligned into the gap between
        // the creatures and the lineup (the far right belongs to the rail).
        // Portrait has no such gap — the lineup runs up the middle — so the
        // label goes under the orb instead.
        // (the portrait nudge to the left keeps the widest line of a label clear
        // of the rail, which runs down the right edge at the same height)
        el.style.transform = mobile
          ? `translate(${a.x - 16}px, ${a.y + a.radius + 14}px) translate(-50%, 0)`
          : `translate(${a.x - a.radius - 20}px, ${a.y}px) translate(-100%, -50%)`;
        // the labels ride the orbs' own fade, so the panel opening (which fades
        // the lineup back) takes them with it
        el.style.opacity = String(a.active ? a.alpha : a.alpha * 0.4);
        el.classList.toggle('is-active', !!a.active);
      }
    };
    gsap.ticker.add(follow);
    follow();
    return () => gsap.ticker.remove(follow);
  }, [scene, isActive, visible.length, mobile]);

  // dev hook so headless runs can drive the lineup
  useEffect(() => {
    if (!import.meta.env || !import.meta.env.DEV) return undefined;
    window.__work = { select, setCategory, count: visible.length, index, category };
    return undefined;
  });

  if (!isActive) return null;
  return (
    <>
      <div className="orb-labels" ref={labelsRef} aria-hidden={!isActive}>
        {visible.map((p) => (
          <div className="orb-label" data-id={p.id} key={p.id} style={{ opacity: 0 }}>
            <div className="orb-label-title">{p.title}</div>
            {p.display.length > 0 && (
              <div className="orb-label-tags">{p.display.slice(0, 4).join(' · ')}</div>
            )}
            {p.oneLiner && <div className="orb-label-one">{p.oneLiner}</div>}
          </div>
        ))}
      </div>

      <ProjectRail
        categories={catalog.categories}
        category={category}
        onCategory={setCategory}
        projects={visible}
        index={Math.min(index, Math.max(0, visible.length - 1))}
        onSelect={select}
        hidden={!!openId}
      />

      <ProjectPanel
        project={visible.find((p) => p.id === openId) || null}
        scene={scene}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
