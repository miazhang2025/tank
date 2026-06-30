# AQUARIA · tank study

A Vite + React + Three.js port of the single-file `reference/aquarium.html` study —
an underwater scene behind glass: animated caustics, light shafts, a schooling
GLB fish, drifting food, cursor-driven bubbles, and a two-pass post stack
(depth-of-field → glass distortion/grade).

## Run

```bash
npm install      # already done
npm run dev      # dev server at http://localhost:5173
npm run build    # production build to dist/
npm run preview  # serve the production build
```

## Layout

```
index.html              entry HTML + the <svg> #glassWarp filter for the sidebar
public/models/red.glb   fish model, extracted from the reference's embedded base64
src/
  main.jsx              React root
  App.jsx               composes the scene + UI overlay (caption, hint, sidebar)
  index.css             ported styles from the reference <style> block
  components/
    Aquarium.jsx        mounts/disposes the Three.js scene (StrictMode-safe)
    Sidebar.jsx         frosted-glass blob-masked nav (SVG mask + nav-open toggle)
  scene/
    createAquarium.js   the full imperative Three.js scene (factory -> { dispose })
    shaders.js          shared GLSL (noise / fbm / caustic)
scripts/
  extract-glb.cjs       one-shot: pulls RED_GLB_B64 out of the reference HTML
reference/aquarium.html the original single-file study (kept for reference)
```

## Porting notes (r128 CDN → npm three)

- **Imperative, not R3F.** The scene uses manual render targets, a depth texture,
  instanced meshes, and a hand-rolled multi-pass post stack, so it's kept as
  imperative Three.js in `createAquarium()` and wrapped by a thin React component.
  The factory returns `dispose()` for clean unmount (and React StrictMode's dev
  double-mount).
- **`THREE.ColorManagement.enabled = false`.** The reference predates three's
  colour management; its custom shaders do their own sRGB↔linear gamma. Disabling
  CM keeps `THREE.Color` uniform values byte-identical to r128 so the look matches.
- **GLB as a real asset.** The reference embedded the model as a ~1.8 MB base64
  string; it's extracted to `public/models/red.glb` and loaded by URL via
  `GLTFLoader` (`loader.load`) instead of `loader.parse`. The second `white` model
  was referenced but never defined in the reference, so only `red` loads.
- **`GLTFLoader`** is imported from `three/examples/jsm/loaders/GLTFLoader.js`.
