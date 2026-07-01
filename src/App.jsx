import { useEffect, useState } from 'react';
import gsap from 'gsap';
import Aquarium from './components/Aquarium.jsx';
import Sidebar from './components/Sidebar.jsx';
import Stage from './components/Stage.jsx';
import Loader from './components/Loader.jsx';

export default function App() {
  const [scene, setScene] = useState(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false); // scrolling enabled once the intro settles

  // flip to ready once the scene's models have loaded
  useEffect(() => {
    if (!scene) return;
    scene.whenReady(() => setReady(true));
  }, [scene]);

  // top→bottom camera drop, revealed as the loader dissolves
  useEffect(() => {
    if (!ready || !scene) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tw = gsap.to(scene.controls, {
      introY: 0,
      duration: reduce ? 0.6 : 2.6,
      ease: reduce ? 'power1.out' : 'power3.inOut',
      onComplete: () => setActive(true),
    });
    return () => tw.kill();
  }, [ready, scene]);

  return (
    <>
      <Aquarium onReady={setScene} />
      <Stage scene={scene} active={active} />

      <div className="ui">
        <div className="t">AQUARIA.TANK</div>
        <div className="h">We currently do not have an address yet, you can contact Mia at miazhang2025@gmail.com she can help us.</div>
      </div>

      <Sidebar scene={scene} />
      <Loader ready={ready} />
    </>
  );
}
