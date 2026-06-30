import { useEffect, useRef } from 'react';
import { createAquarium } from '../scene/createAquarium.js';

/**
 * Mounts the imperative Three.js aquarium scene into a full-viewport div and
 * tears it down on unmount (handles React StrictMode's dev double-mount).
 *
 * @param {(instance: object) => void} [props.onReady] receives the live scene
 *   instance ({ controls, anchors, whenReady, … }) so the rest of the app can
 *   drive the camera / read creature anchors. The camera intro + loader are
 *   orchestrated by App once the scene reports ready.
 */
export default function Aquarium({ onReady }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const instance = createAquarium(host);
    onReady?.(instance);
    return () => instance.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="app" ref={hostRef} />;
}
