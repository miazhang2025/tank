import { useEffect, useState } from 'react';
import gsap from 'gsap';
import Aquarium from './components/Aquarium.jsx';
import Sidebar from './components/Sidebar.jsx';
import Stage from './components/Stage.jsx';
import Loader from './components/Loader.jsx';
import { loadProjects } from './content/projects.js';

export default function App() {
  const [scene, setScene] = useState(null);
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false); // visitor clicked "Enter" on the loader
  const [active, setActive] = useState(false); // scrolling enabled once the intro settles
  // work-section data (public/creche-projects.json). Fetched alongside the GLBs
  // rather than bundled, so the file stays editable without a rebuild.
  const [catalog, setCatalog] = useState({ projects: [], categories: ['All'] });

  useEffect(() => {
    let cancelled = false;
    loadProjects()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((err) => console.error('projects load failed', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // flip to ready once the scene's models have loaded
  useEffect(() => {
    if (!scene) return;
    scene.whenReady(() => setReady(true));
  }, [scene]);

  // top→bottom camera drop, revealed as the loader dissolves
  useEffect(() => {
    if (!entered || !scene) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scene.burstFromBottom(reduce ? 100 : 320, reduce ? 900 : 2200);
    const tw = gsap.to(scene.controls, {
      introY: 0,
      duration: reduce ? 0.6 : 2.6,
      ease: reduce ? 'power1.out' : 'power3.inOut',
      onComplete: () => setActive(true),
    });
    return () => tw.kill();
  }, [entered, scene]);

  return (
    <>
      <Aquarium onReady={setScene} />
      <Stage scene={scene} active={active} catalog={catalog} />

      <div className="ui">
        <div className="t">CRÈCHE / the tank</div>
        <div className="h">Knock on the glass · knockonglass@crechetank.com</div>
      </div>

      <Sidebar scene={scene} />
      <Loader ready={ready} onEnter={() => setEntered(true)} />
    </>
  );
}
