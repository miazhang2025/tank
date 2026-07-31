import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NOISE } from './shaders.js';
import { STAGE, FOCUS_DIST } from './choreography.js';
import { SECTIONS } from '../content/sections.js';

// The reference scene predates three.js colour management. Disable it so raw
// THREE.Color uniform values stay the same byte-for-byte as r128 (the custom
// shaders do their own sRGB <-> linear gamma), keeping the look identical.
THREE.ColorManagement.enabled = false;

// Phones and tablets get a cheaper pipeline. The desktop settings (2x pixel
// ratio over three full-screen buffers, a 24-tap depth-of-field, 40 fish + 320
// flecks + 520 bubbles) routinely pushed mobile GPUs into a context loss, which
// the visitor experiences as the page "crashing". Everything gated on this flag
// changes cost, not composition — the framing, choreography and materials are
// identical, just rendered at fewer samples.
//
// Resolved once at module load from `screen` (not `innerWidth`) so rotating the
// device can't flip it: the flag is baked into shader source and buffer sizes at
// scene-build time, and rebuilding the whole scene mid-session would be a far
// worse experience than a slightly conservative pipeline in landscape.
const LOW_POWER =
  typeof window !== 'undefined' &&
  (window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
    Math.min(window.screen?.width ?? 1e4, window.screen?.height ?? 1e4) <= 820);

/**
 * Build the underwater "tank study" scene inside `container`.
 *
 * @param {HTMLElement} container          full-viewport element to host the canvas
 * @param {object}      [opts]
 * @param {string[]}    [opts.fishUrls]     GLB models for the blurred background school
 * @param {object}      [opts.creatureUrls] { axolotl, octopus } GLB hero models (always sharp)
 * @returns {{ dispose, renderer, controls, anchors, whenReady }} see the return site for shapes
 */
export function createAquarium(container, opts = {}) {
  // background school models (kept soft / out of focus)
  const fishUrls = opts.fishUrls ?? ['/models/red.glb', '/models/white fish.glb'];
  // foreground hero creatures (always on the focal plane → always sharp)
  const creatureUrls = opts.creatureUrls ?? {
    axolotl: '/models/axolotl.glb',
    octopus: '/models/octopus.glb',
  };

  // ---------- constants ----------
  const FOG_COLOR = new THREE.Color(0x0e3a3c); // teal-green murk
  const FOG_DENSITY = 0.055;
  const NEAR = 0.1,
    FAR = 70.0;
  // sections with stageLight:1 in choreography.js (the dive sequence) — kept
  // as a literal set here since it's just used to hide the water surface
  const STAGE_LIGHT_SECTIONS = new Set(['cassette-jury', 'santa-beer', 'flaneur']);

  // ---------- live control bridge (GSAP / React mutate these; tick() reads them) ----------
  const [_envR0, _envG0, _envB0] = [
    ((STAGE.main.envColor ?? FOG_COLOR.getHex()) >> 16 & 255) / 255,
    ((STAGE.main.envColor ?? FOG_COLOR.getHex()) >> 8 & 255) / 255,
    ((STAGE.main.envColor ?? FOG_COLOR.getHex()) & 255) / 255,
  ];
  const controls = {
    introY: 1, // 1 = camera parked high above (loader); 0 = settled into the main framing
    cameraZ: STAGE.main.cameraZ, // base camera z (scroll moves the camera along z)
    camY: STAGE.main.camY ?? 0, // per-stage vertical camera offset (world y) — sinks the rig down
    focusDist: FOCUS_DIST, // view-space depth of the focal plane (creatures + mouse bubbles)
    activeSection: 'main', // nearest section id, kept in sync by Stage.jsx on scroll
    propAnchor: null, // active section's prop-model anchor {sx,sy,scale,yaw} — set by Stage.jsx (breakpoint-aware), null when the section has none
    envR: _envR0, envG: _envG0, envB: _envB0, // per-stage environment/fog tint (0..1 channels)
    stageLight: STAGE.main.stageLight ?? 0, // 0..1 "lit stage" mood: dimmer + overhead spotlight
    creatures: {
      axolotl: { sx: STAGE.main.axolotl.sx, sy: STAGE.main.axolotl.sy, scale: 1, opacity: 1 },
      octopus: { sx: STAGE.main.octopus.sx, sy: STAGE.main.octopus.sy, scale: 0.8, opacity: 1 },
    },
  };
  // screen-space anchor (CSS px) above each creature's head — DOM bubbles read this each frame
  const anchors = {
    axolotl: { x: 0, y: 0, visible: false },
    octopus: { x: 0, y: 0, visible: false },
  };

  // ---------- renderer / scene / camera ----------
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  // The single biggest mobile lever: every pass below (scene, DOF, glass) is
  // full-screen, so this squares straight into fill rate. 1.5 on a 3x phone
  // still oversamples the panel and costs ~44% fewer pixels than the 2x cap.
  const PR = Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.5 : 2);
  renderer.setPixelRatio(PR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = FOG_COLOR.clone();
  scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, NEAR, FAR);
  const CAM_BASE = new THREE.Vector3(0, -1.7, 9.4);
  const CAM_TARGET = new THREE.Vector3(0, -0.1, -1.0);
  // how much of the camera's vertical dive (controls.camY) the look-at target
  // follows — see the tilt-vs-DOF comment at its use in tick()
  const CAM_TARGET_FOLLOW = 0.72;
  const _lookTarget = new THREE.Vector3();
  camera.position.copy(CAM_BASE);
  camera.lookAt(CAM_TARGET);

  // ---------- lights: warm key from the left, cool fill from the right ----------
  const hemi = new THREE.HemisphereLight(0x8fdcef, 0x07302e, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe6c2, 1.3); // warm window light, left
  key.position.set(-7, 9, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x74d2e2, 0.45); // cool fill, right
  fill.position.set(6, 4, 6);
  scene.add(fill);
  const ambient = new THREE.AmbientLight(0x115560, 0.42);
  scene.add(ambient);
  // base intensities scaled by controls.stageLight each frame (see tick()) to
  // dim the tank for the cassette-jury/santa-beer/flaneur "lit stage" mood
  const BASE_LIGHT_INTENSITY = { hemi: hemi.intensity, key: key.intensity, fill: fill.intensity, ambient: ambient.intensity };

  // ---------- floor (caustic light net) ----------
  function causticMat(litHex) {
    return new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x07262a) },
        uLit: { value: new THREE.Color(litHex) },
        uFogColor: { value: FOG_COLOR.clone() },
        uFogDensity: { value: FOG_DENSITY },
        uDim: { value: 1 }, // 1 = normal; dimmed toward stageLight sections
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying float vDepth;
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vWorld = wp.xyz; vec4 mv = viewMatrix * wp; vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader:
        NOISE +
        /* glsl */ `
        varying vec3 vWorld; varying float vDepth;
        uniform float uTime, uFogDensity, uDim; uniform vec3 uDeep, uLit, uFogColor;
        void main(){
          vec2 uv = vWorld.xz * 0.14;
          float c = caustic(uv, uTime);
          vec3 col = mix(uDeep, uLit, clamp(c*0.95,0.0,1.0));
          col += vec3(0.4,0.5,0.45) * pow(clamp(c-0.6,0.0,1.0),1.5) * 0.8;
          col *= uDim;
          float f = 1.0 - exp(-uFogDensity*uFogDensity*vDepth*vDepth);
          col = mix(col, uFogColor, clamp(f,0.0,1.0));
          gl_FragColor = vec4(col,1.0);
        }`,
    });
  }
  const floorMat = causticMat(0x2e9a82);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5.2;
  scene.add(floor);

  const backMat = causticMat(0x1c7a72);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), backMat);
  back.position.set(0, 3, -16);
  scene.add(back);

  // dim vertical bars in the deep background (the "stuff behind the glass")
  const barMat = new THREE.MeshStandardMaterial({ color: 0x123f49, roughness: 0.9, emissive: 0x06222a });
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 10, 0.28), barMat);
    bar.position.set(-7 + i * 2.3 + (Math.random() - 0.5), 0.5, -12.5 - Math.random() * 1.5);
    scene.add(bar);
  }

  // ---------- water surface seen from below ----------
  const surfaceMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uDeep: { value: new THREE.Color(0x0e3c3a) },
      uBright: { value: new THREE.Color(0x9fe6dd) },
      uWarm: { value: new THREE.Color(0xffe2b0) },
      uFogColor: { value: FOG_COLOR.clone() },
      uFogDensity: { value: FOG_DENSITY * 0.7 },
      uDim: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying float vDepth;
      void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz;
        vec4 mv=viewMatrix*wp; vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader:
      NOISE +
      /* glsl */ `
      varying vec3 vWorld; varying float vDepth;
      uniform float uTime, uFogDensity, uDim; uniform vec3 uCam, uDeep, uBright, uWarm, uFogColor;
      void main(){
        vec2 uv = vWorld.xz * 0.09;
        float ripple = fbm(uv*1.6 + uTime*0.12);
        float net = caustic(uv*0.7, uTime*0.8);
        vec3 viewDir = normalize(uCam - vWorld);
        float fres = pow(clamp(1.0 - abs(viewDir.y), 0.0, 1.0), 2.0);
        vec3 col = mix(uDeep, uBright, clamp(ripple*0.7 + net*0.5, 0.0, 1.0));
        col += vec3(0.5,0.75,0.7) * net * 0.45;
        col = mix(col, uBright*1.1, fres*0.3);
        // warm window glint biased to the left (-x)
        float lg = clamp((-vWorld.x + 2.0)/13.0, 0.0, 1.0);
        col += uWarm * lg * (0.35 + net*0.6) * 0.7;
        col *= uDim;
        float f = 1.0 - exp(-uFogDensity*uFogDensity*vDepth*vDepth);
        col = mix(col, uFogColor, clamp(f,0.0,1.0));
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), surfaceMat);
  surface.rotation.x = Math.PI / 2;
  surface.position.y = 6.2;
  scene.add(surface);

  // ---------- light shafts (warm, biased left) + window glow ----------
  const shaftBase = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: 0 },
      uColor: { value: new THREE.Color(1, 1, 1) },
      uInten: { value: 0.3 },
      uStreak: { value: 1 }, // 1 = full watery turbulence; lower = a cleaner, more solid-looking beam
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:
      NOISE +
      /* glsl */ `
      varying vec2 vUv; uniform float uTime,uPhase,uInten,uStreak; uniform vec3 uColor;
      void main(){
        float v = smoothstep(0.0,1.0,vUv.y);
        float streak = fbm(vec2(vUv.x*3.5 + uPhase, vUv.y*0.6 - uTime*0.05));
        float edge = smoothstep(0.0,0.18,vUv.x)*smoothstep(0.0,0.18,1.0-vUv.x);
        float a = v*(0.18+0.55*streak*uStreak)*edge;
        gl_FragColor = vec4(uColor, a*uInten);
      }`,
  });
  const shaftCfg = [
    { x: -6.5, w: 3.4, c: [1.0, 0.9, 0.68], i: 0.6, z: -4 },
    { x: -3.8, w: 2.7, c: [0.95, 0.92, 0.8], i: 0.42, z: -5 },
    { x: -1.2, w: 2.3, c: [0.72, 0.9, 0.9], i: 0.3, z: -6 },
    { x: 1.6, w: 2.4, c: [0.62, 0.86, 0.92], i: 0.26, z: -5 },
    { x: 4.6, w: 2.9, c: [0.56, 0.86, 0.92], i: 0.24, z: -4 },
  ];
  const shafts = new THREE.Group();
  shaftCfg.forEach((cf, i) => {
    const m = shaftBase.clone();
    m.uniforms.uPhase.value = i * 2.1;
    m.uniforms.uColor.value = new THREE.Color(cf.c[0], cf.c[1], cf.c[2]);
    m.uniforms.uInten.value = cf.i;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(cf.w, 13.5), m);
    s.position.set(cf.x, 0.5, cf.z);
    // baseInten kept around so tick() can scale these down (not replace them)
    // for the cassette-jury/santa-beer/flaneur stage look, which wants ONE
    // clean overhead spot instead of this whole scattered multi-beam wash.
    s.userData = { baseX: cf.x, sp: 0.18 + Math.random() * 0.18, baseInten: cf.i };
    shafts.add(s);
  });
  scene.add(shafts);

  // ---------- stage spotlight (cassette-jury / santa-beer / flaneur only) ----------
  // A single warm overhead cone (tapered wide-top/narrow-bottom, like a real
  // stage fixture) replacing the scattered window shafts for the mood. Tracked
  // to stay screen-centred (camera-relative, like the creatures) regardless of
  // the camY dive. Intensity driven each frame from controls.stageLight —
  // invisible (uInten 0) outside those three sections.
  const spotMat = shaftBase.clone();
  spotMat.uniforms.uColor.value = new THREE.Color(0xffd699); // warm, matches the site's key-light hue
  spotMat.uniforms.uPhase.value = 4.4;
  spotMat.uniforms.uInten.value = 0;
  spotMat.uniforms.uStreak.value = 0.35; // cleaner / less turbulent than the water-shaft look
  const spotGeo = new THREE.PlaneGeometry(7, 10, 1, 1);
  {
    // taper the bottom edge inward so the plane reads as a cone (wide at the
    // "fixture" near the ceiling, narrow where it lands on the stage floor)
    const pos = spotGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0) pos.setX(i, pos.getX(i) * 0.28);
    }
    pos.needsUpdate = true;
    spotGeo.computeBoundingSphere();
  }
  const spotBeam = new THREE.Mesh(spotGeo, spotMat);
  // kept entirely below the water surface mesh (y=6.2) — it used to poke
  // through it, and since the surface is opaque, it was silently occluding
  // almost the whole beam (only the dim tapered tip near the floor survived)
  spotBeam.position.set(0, 0.0, -1.0);
  scene.add(spotBeam);

  // blown-out warm window glow, upper-left
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0xfff0d2) }, uInten: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `varying vec2 vUv; uniform vec3 uColor; uniform float uInten;
      void main(){ float d=length(vUv-0.5)*2.0; float a=smoothstep(1.0,0.0,d); gl_FragColor=vec4(uColor,a*a*0.55*uInten);}`,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), glowMat);
  glow.position.set(-7.5, 3.6, -6.5);
  scene.add(glow);

  // ---------- fish (loaded GLB models, rendered with the translucent veil) ----------
  const Z = new THREE.Vector3(0, 0, 1);
  const FISH_N = LOW_POWER ? 18 : 40;
  const HEAD_FLIP = false; // set true if the models swim tail-first
  const rand = (a, b) => a + Math.random() * (b - a);

  // translucent veil material that keeps each model's own baseColor texture
  function makeFishMat(map) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      side: THREE.FrontSide,
      uniforms: {
        uMap: { value: map },
        uOpacity: { value: 0.95 },
        uFogColor: { value: FOG_COLOR.clone() },
        uFogDensity: { value: FOG_DENSITY },
        uDim: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vFog;
        void main(){
          vUv = uv;
          #ifdef USE_INSTANCING
            mat4 im = instanceMatrix;
          #else
            mat4 im = mat4(1.0);
          #endif
          vec4 wp = modelMatrix * im * vec4(position,1.0);
          vN = normalize( mat3(modelMatrix) * mat3(im) * normal );
          vView = normalize(cameraPosition - wp.xyz);
          vec4 mv = viewMatrix * wp; vFog = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform sampler2D uMap; uniform vec3 uFogColor; uniform float uOpacity,uFogDensity,uDim;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vFog;
        void main(){
          vec3 N=normalize(vN), V=normalize(vView);
          vec3 tex = pow(texture2D(uMap, vUv).rgb, vec3(2.2));   // sRGB -> linear
          float fres = pow(1.0 - clamp(dot(N,V),0.0,1.0), 2.0);  // clear centre, brighter rim
          float lite = 0.55 + 0.5*clamp(dot(N, normalize(vec3(-0.3,1.0,0.4))),0.0,1.0);
          vec3 col = tex*(0.72 + 0.5*lite) + vec3(0.13,0.18,0.20)*fres;
          col *= uDim;
          float alpha = clamp(uOpacity*(0.36 + 0.85*fres), 0.0, 1.0);
          float f = 1.0 - exp(-uFogDensity*uFogDensity*vFog*vFog);
          col = mix(col, uFogColor, clamp(f,0.0,1.0));
          gl_FragColor = vec4(col, alpha);
        }`,
    });
  }

  // Every model here gets its GLB material replaced by one of the custom
  // shaders below, and those sample exactly one texture: baseColor. The normal /
  // roughness / AO maps the GLBs also ship (several are 2048², i.e. 16 MB each
  // once decoded) stayed resident for the whole session doing nothing — dead
  // weight that on iOS counts against the tab's memory budget and helped tip it
  // into a reload. Drop them the moment the swap is done.
  //
  // Collected across the whole model first, then released in one pass: a GLB can
  // reuse one image across several primitives, so a per-mesh release could free a
  // bitmap another mesh still needs as its baseColor.
  function releaseUnusedSourceMaps(sourceMats, keptMaps) {
    const seen = new Set();
    for (const mat of sourceMats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      for (const key in mat) {
        const tex = mat[key];
        if (!tex || !tex.isTexture || keptMaps.has(tex)) continue;
        // ImageBitmaps hold their pixels outside the JS heap, so waiting for GC
        // to notice them is exactly the wrong timing on a memory-pressured phone
        if (tex.image && typeof tex.image.close === 'function') tex.image.close();
        tex.dispose();
        mat[key] = null;
      }
      mat.dispose();
    }
  }

  // centre, normalise, and face a loaded model forward (+z); returns shared geo + material
  function prepModel(gltf) {
    let mesh = null;
    gltf.scene.traverse((o) => {
      if (o.isMesh && !mesh) mesh = o;
    });
    const geo = mesh.geometry.clone();
    geo.computeBoundingBox();
    const bb = geo.boundingBox,
      c = new THREE.Vector3();
    bb.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z); // centre on origin
    geo.rotateY(-Math.PI / 2 + (HEAD_FLIP ? Math.PI : 0)); // model length (+x) -> forward (+z)
    const len = bb.max.x - bb.min.x || 1;
    const s = 1.0 / len;
    geo.scale(s, s, s); // normalise length ~1
    const map = mesh.material.map;
    // only the clone above survives — the loaded gltf.scene is dropped whole
    const sourceMats = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      sourceMats.push(...(Array.isArray(o.material) ? o.material : [o.material]));
    });
    releaseUnusedSourceMaps(sourceMats, new Set(map ? [map] : []));
    return { geo, mat: makeFishMat(map) };
  }

  function fishPos(p, t, out) {
    out.set(
      p.cx + p.ax * Math.sin(p.wx * t + p.px),
      p.cy + p.ay * Math.sin(p.wy * t + p.py),
      p.cz + p.az * Math.sin(p.wz * t + p.pz),
    );
    return out;
  }
  const _a = new THREE.Vector3(),
    _b = new THREE.Vector3(),
    _d = new THREE.Vector3(),
    _e = new THREE.Vector3();
  const _q = new THREE.Quaternion(),
    _qs = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0),
    _dummy = new THREE.Object3D();
  const _fishFwd = new THREE.Vector3();
  let fishGroups = []; // one InstancedMesh per model type: { mesh, list:[params] }

  // fish spawn bounds keep them behind the focal plane for the camera's default
  // range, but the camera itself moves on scroll and the schooling motion can
  // still drift a fish toward the near edge of its path — so on top of that,
  // clamp every fish's depth-from-camera each frame to a hard floor, guaranteeing
  // it never renders in front of the axolotl / octopus (which sit at focusDist).
  const FISH_MIN_DEPTH_MARGIN = 0.8;

  function updateFish(t) {
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(_fishFwd);
    const minDepth = controls.focusDist + FISH_MIN_DEPTH_MARGIN;
    for (const g of fishGroups) {
      const list = g.list;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        fishPos(p, t, _a);
        fishPos(p, t + 0.05, _b);
        _d.copy(_b).sub(_a);
        if (_d.lengthSq() > 1e-6) {
          _d.normalize();
          _q.setFromUnitVectors(Z, _d);
        } else _q.identity();
        _qs.setFromAxisAngle(_up, Math.sin(t * p.tspd + p.tph) * 0.16); // gentle swim sway
        _q.multiply(_qs);
        const depth = _fishFwd.dot(_e.copy(_a).sub(camera.position));
        if (depth < minDepth) _a.addScaledVector(_fishFwd, minDepth - depth);
        _dummy.position.copy(_a);
        _dummy.quaternion.copy(_q);
        _dummy.scale.setScalar(p.s);
        _dummy.updateMatrix();
        g.mesh.setMatrixAt(i, _dummy.matrix);
      }
      g.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function spawnFish(models) {
    const lists = models.map(() => []);
    for (let i = 0; i < FISH_N; i++) {
      const type = (Math.random() * models.length) | 0;
      lists[type].push({
        // School pulled closer to the camera (bigger, more present); still capped
        // just behind the nearest section's focal plane so it never occludes the
        // hero creatures. Some fish land near focus and read sharper — that's fine.
        s: rand(1.3, 2.5),
        cx: rand(-7.0, 7.0),
        cy: rand(-3.8, 4.2),
        cz: rand(-8.5, -0.4),
        ax: rand(1.2, 3.2),
        ay: rand(0.5, 1.6),
        az: rand(0.5, 1.4),
        wx: rand(0.08, 0.26),
        wy: rand(0.12, 0.3),
        wz: rand(0.07, 0.22),
        px: rand(0, 6.28),
        py: rand(0, 6.28),
        pz: rand(0, 6.28),
        tspd: rand(1.4, 2.6),
        tph: rand(0, 6.28),
      });
    }
    fishGroups = models.map((m, ti) => {
      const list = lists[ti];
      const mesh = new THREE.InstancedMesh(m.geo, m.mat, Math.max(list.length, 1));
      mesh.count = list.length;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return { mesh, list };
    });
  }

  // decode/load the GLB(s) and build the school once ready
  let disposed = false;
  const loader = new GLTFLoader();
  (function loadFish() {
    const out = [];
    let pending = fishUrls.length;
    const done = () => {
      if (--pending === 0 && !disposed) {
        if (out.length) spawnFish(out);
        else console.warn('no fish models loaded');
        loadFlags.fish = true;
        checkReady();
      }
    };
    fishUrls.forEach((url) => {
      loader.load(
        url,
        (g) => {
          out.push(prepModel(g));
          done();
        },
        undefined,
        (err) => {
          console.error('GLB load failed', url, err);
          done();
        },
      );
    });
  })();

  // ---------- hero creatures: axolotl + octopus (always on the focal plane) ----------
  const CREATURE_HEIGHT = 1.75; // world height the normalised models are scaled to

  // Glossy "candy toy" material with SKINNING support, so the rigged idle/swim
  // clips deform the mesh while we keep the hand-tuned look (correct pink/red via
  // sRGB decode of the model's own map, hard spec + rim). depthWrite stays on so
  // the depth-of-field reads the creatures as sharp.
  function makeCreatureMat(map, tintHex) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      side: THREE.FrontSide,
      uniforms: {
        uMap: { value: map || null },
        uHasMap: { value: map ? 1 : 0 },
        uTint: { value: new THREE.Color(tintHex || 0xffffff) },
        uOpacity: { value: 1 },
        uDesat: { value: 0.32 }, // pull colour toward grey (less saturated)
        uBright: { value: 1.14 }, // a touch brighter
        uCoat: { value: 0.38 }, // glossy reflective clear-coat strength
        uFogColor: { value: FOG_COLOR.clone() },
        uFogDensity: { value: FOG_DENSITY * 0.55 },
        uDim: { value: 1 }, // 1 = normal; dimmed toward stageLight sections
        uSpot: { value: 0 }, // 0..1 — blends the key light overhead (stage spotlight look)
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <skinning_pars_vertex>
        varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vFog;
        void main(){
          vUv = uv;
          #include <skinbase_vertex>
          #include <beginnormal_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          vN = normalize(mat3(modelMatrix) * objectNormal);
          vView = normalize(cameraPosition - wp.xyz);
          vec4 mv = viewMatrix * wp; vFog = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform sampler2D uMap; uniform float uHasMap,uOpacity,uFogDensity,uDesat,uBright,uCoat,uDim,uSpot;
        uniform vec3 uTint,uFogColor;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vFog;
        void main(){
          vec3 N=normalize(vN), V=normalize(vView);
          vec3 base = uTint;
          if(uHasMap > 0.5){ base = pow(texture2D(uMap, vUv).rgb, vec3(2.2)); }
          // desaturate toward luma + brighten a touch
          float luma = dot(base, vec3(0.299,0.587,0.114));
          base = clamp(mix(base, vec3(luma), uDesat) * uBright, 0.0, 1.0);

          // on a "lit stage" (uSpot>0) the key swings from the window-left
          // angle to overhead — but keeps a strong forward (+Z) component so
          // the face (which points roughly +Z, toward camera) stays clearly
          // lit rather than going flat/silhouetted under a purely top-down key.
          vec3 L = normalize(mix(vec3(-0.3,1.0,0.5), vec3(0.0,0.85,0.6), uSpot));
          float ambFloor = mix(0.66, 0.4, uSpot);
          float diff = ambFloor + mix(0.4, 0.66, uSpot)*clamp(dot(N,L),0.0,1.0);
          float fres = pow(1.0 - clamp(dot(N,V),0.0,1.0), 3.0);

          // faux environment reflection for the clear-coat (no env map in scene):
          // map the reflected ray's height to a deep→bright tank gradient.
          vec3 R = reflect(-V, N);
          float up = clamp(R.y*0.5 + 0.5, 0.0, 1.0);
          vec3 envCol = mix(vec3(0.10,0.30,0.34), vec3(0.92,0.98,1.0), up*up);
          float coat = uCoat * (0.16 + 0.84*fres);   // stronger reflection at grazing angles

          // tight glossy highlight (the coat's hotspot)
          vec3 H = normalize(L+V);
          float spec = pow(clamp(dot(N,H),0.0,1.0), 90.0);

          vec3 col = base*diff;
          col = mix(col, envCol, coat);               // reflective coat layer
          col += vec3(1.0)*spec*(0.7 + 0.3*uSpot);    // coat hotspot (a touch hotter under the spotlight)
          col *= uDim;
          float f = 1.0 - exp(-uFogDensity*uFogDensity*vFog*vFog);
          col = mix(col, uFogColor, clamp(f,0.0,1.0));
          gl_FragColor = vec4(col, uOpacity);
        }`,
    });
  }

  // Prepare a loaded creature: swap in the skinned candy material (keeps the
  // model's own texture for correct colour), centre it, and nest groups so the
  // transforms stay clean: wrap(roll + place/scale) → inner(yaw + idle sway) →
  // holder(content centred so rotations stay in place) → rig.
  function prepCreature(gltf) {
    const root = gltf.scene;
    const mats = [];
    const sourceMats = [];
    const keptMaps = new Set();
    root.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false;
        const srcMap = o.material && o.material.map ? o.material.map : null;
        const srcTint = o.material && o.material.color ? o.material.color.getHex() : 0xffffff;
        if (o.material) sourceMats.push(o.material);
        if (srcMap) keptMaps.add(srcMap);
        o.material = makeCreatureMat(srcMap, srcMap ? 0xffffff : srcTint);
        mats.push(o.material);
      }
    });
    releaseUnusedSourceMaps(sourceMats, keptMaps);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const holder = new THREE.Group();
    root.position.sub(center); // centre the content at the holder origin
    holder.add(root);
    const inner = new THREE.Group(); // yaw (faces camera) + idle sway
    inner.add(holder);
    const wrap = new THREE.Group(); // screen-z roll + world transform
    wrap.add(inner);
    return {
      object: wrap,
      inner,
      mats,
      height: size.y || 1,
      size: size.clone(), // local box extents → used to seat the FACE on the focal plane
      animations: gltf.animations || [],
      animRoot: root,
    };
  }

  // Front-facing yaws + a screen-z roll (the axolotl model ships flipped 180°).
  // Overridable via ?ay=<rad>&oy=<rad> for re-tuning if models are swapped.
  const _qp = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const _ay = _qp.has('ay') ? parseFloat(_qp.get('ay')) : -Math.PI / 2 + 0.2;
  const _oy = _qp.has('oy') ? parseFloat(_qp.get('oy')) : -Math.PI / 2 - 0.2;

  // _ay/_oy above were tuned so each model's own "front" axis faces the
  // camera under the resting 'main' framing. Later sections now sink the
  // camera down (choreography.js camY) while the look-at target stays put,
  // tilting the view — so a fixed yaw no longer points at the camera
  // everywhere. Back out each model's
  // inherent front-axis offset once here (relative to that same 'main'
  // reference), then recompute the yaw that faces the *live* camera every
  // frame in updateCreatures — keeps both creatures looking at the camera in
  // every section, on desktop and mobile alike.
  function yawToFace(camPos, pos, frontOffset) {
    return Math.atan2(camPos.x - pos.x, camPos.z - pos.z) + frontOffset;
  }
  camera.updateMatrixWorld(true);
  const _refPos = new THREE.Vector3();
  screenToWorld(STAGE.main.axolotl.sx, STAGE.main.axolotl.sy, FOCUS_DIST, _refPos);
  const AXOLOTL_FRONT_OFFSET =
    _ay - Math.atan2(camera.position.x - _refPos.x, camera.position.z - _refPos.z);
  screenToWorld(STAGE.main.octopus.sx, STAGE.main.octopus.sy, FOCUS_DIST, _refPos);
  const OCTOPUS_FRONT_OFFSET =
    _oy - Math.atan2(camera.position.x - _refPos.x, camera.position.z - _refPos.z);

  // extra yaw the axolotl pans through on top of its face-camera yaw each
  // time it dances in the flâneur section, so it visibly turns to face the
  // centred content cloud rather than holding a fixed tilt — and pans back
  // while it pauses.
  const AXOLOTL_FACE_CENTER_YAW = 0.4;
  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const creatureState = {
    axolotl: {
      obj: null, inner: null, mats: [], norm: 1, size: new THREE.Vector3(1, 1, 1),
      base: new THREE.Vector3(), prev: new THREE.Vector3(),
      phase: 0.0, yaw: _ay, roll: 0, frontOffset: AXOLOTL_FRONT_OFFSET,
      mixer: null, idle: null, swim: null, swimBlend: 0,
      dance: null, danceBlend: 0,
      facePan: { value: 0, from: 0, target: 0, t: 0, dur: 1.1 },
      danceCycle: { dancing: true, timer: rand(3.5, 6) },
      hit: { active: false, t: 0, dur: 0.4, dirSign: 1 },
    },
    octopus: {
      obj: null, inner: null, mats: [], norm: 1, size: new THREE.Vector3(1, 1, 1),
      base: new THREE.Vector3(), prev: new THREE.Vector3(),
      phase: 2.1, yaw: _oy, roll: 0, frontOffset: OCTOPUS_FRONT_OFFSET,
      mixer: null, idle: null, swim: null, swimBlend: 0,
    },
  };

  // ---------- cassette-jury only: octopus randomly turns + strikes the axolotl ----------
  // Reuses the octopus's existing "swim" slot, which is already bound to its
  // GLB's rigged "Attack" clip (see loadCreatures below) — no procedural pose,
  // just a deliberate one-shot trigger instead of the movement-driven blend.
  // The axolotl has no reaction clip, so its "hit" is a small procedural
  // knockback + wobble layered onto its normal position/roll.
  const attackFX = {
    phase: 'idle', // idle -> turning -> striking -> returning -> idle
    timer: rand(3, 6), // seconds until the next attempt, counted down while idle in-section
    t: 0,
    dx: 0,
    baseYaw: 0,
    turnYaw: 0,
    currentYaw: 0,
    turnDur: 0.45,
    strikeDur: 0.8,
    hitAt: 0.35,
    hitFired: false,
  };

  // map a normalised screen point (sx,sy) at view depth d to a world position
  function screenToWorld(sx, sy, d, out) {
    const ndcX = sx * 2 - 1,
      ndcY = -(sy * 2 - 1);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    out.set(ndcX * d * tanHalf * camera.aspect, ndcY * d * tanHalf, -d);
    return camera.localToWorld(out);
  }

  const _wp = new THREE.Vector3(),
    _head = new THREE.Vector3(),
    _proj = new THREE.Vector3(),
    _cfwd = new THREE.Vector3();

  // drives attackFX's state machine; called once per frame, before the per-creature loop
  function stepAttackFX(dt) {
    const octo = creatureState.octopus,
      axo = creatureState.axolotl;
    const fx = attackFX;
    if (!octo.obj || !axo.obj) return;
    const inSection = controls.activeSection === 'cassette-jury';

    if (!inSection) {
      if (fx.phase !== 'idle') {
        fx.phase = 'idle';
        fx.t = 0;
        fx.timer = rand(3, 6);
        if (octo.swim) {
          octo.swim.setLoop(THREE.LoopRepeat, Infinity);
          octo.swim.clampWhenFinished = false;
        }
        axo.hit.active = false;
      }
      return;
    }

    switch (fx.phase) {
      case 'idle': {
        fx.timer -= dt;
        if (fx.timer <= 0 && octo.swim) {
          fx.dx = axo.base.x - octo.base.x; // which side the axolotl is on
          fx.baseYaw = octo.yaw;
          fx.turnYaw = octo.yaw + (fx.dx < 0 ? -0.6 : 0.6); // turn toward it
          fx.currentYaw = fx.baseYaw;
          fx.t = 0;
          fx.phase = 'turning';
        }
        break;
      }
      case 'turning': {
        fx.t += dt;
        const p = Math.min(1, fx.t / fx.turnDur);
        fx.currentYaw = fx.baseYaw + (fx.turnYaw - fx.baseYaw) * easeInOut(p);
        if (p >= 1) {
          fx.t = 0;
          fx.hitFired = false;
          fx.phase = 'striking';
          octo.swim.setLoop(THREE.LoopOnce, 1);
          octo.swim.clampWhenFinished = true;
          octo.swim.reset();
          octo.swim.play();
          fx.strikeDur = octo.swim.getClip().duration || 0.8;
          fx.hitAt = fx.strikeDur * 0.4; // moment the tentacle actually reaches the axolotl
        }
        break;
      }
      case 'striking': {
        fx.t += dt;
        const fadeT = 0.15;
        const e = Math.min(1, fx.t / fadeT);
        if (octo.idle) octo.idle.setEffectiveWeight(1 - e);
        if (octo.swim) octo.swim.setEffectiveWeight(e);
        if (!fx.hitFired && fx.t >= fx.hitAt) {
          fx.hitFired = true;
          axo.hit.active = true;
          axo.hit.t = 0;
          axo.hit.dirSign = fx.dx < 0 ? -1 : 1; // knock the axolotl further away from the octopus
        }
        if (fx.t >= fx.strikeDur) {
          fx.t = 0;
          fx.phase = 'returning';
        }
        break;
      }
      case 'returning': {
        fx.t += dt;
        const p = Math.min(1, fx.t / fx.turnDur);
        const e = easeInOut(p);
        fx.currentYaw = fx.turnYaw + (fx.baseYaw - fx.turnYaw) * e;
        if (octo.idle) octo.idle.setEffectiveWeight(e);
        if (octo.swim) octo.swim.setEffectiveWeight(1 - e);
        if (p >= 1) {
          octo.swim.setLoop(THREE.LoopRepeat, Infinity);
          octo.swim.clampWhenFinished = false;
          fx.phase = 'idle';
          fx.timer = rand(4, 8);
        }
        break;
      }
      default:
        break;
    }
  }

  function updateCreatures(t, dt) {
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(_cfwd); // view axis: creatures get pushed back along it
    const k = Math.min(1, dt * 6); // smoothing toward target anchor (swim)
    stepAttackFX(dt);
    for (const id of ['axolotl', 'octopus']) {
      const st = creatureState[id];
      if (st.mixer) st.mixer.update(dt);
      if (!st.obj) continue;
      const cc = controls.creatures[id];
      // The creature is centred on the focal plane, but the yaw turns its FACE
      // toward the camera — so the face floats in front of focus and the tight
      // DOF band reads it as soft. Push the creature back along its view ray by
      // half its view-facing depth so the front (face) sits exactly on the plane,
      // and scale up by the same ratio so its on-screen size is unchanged.
      const S = st.norm * CREATURE_HEIGHT * cc.scale;
      const cy = Math.cos(st.yaw),
        sny = Math.sin(st.yaw);
      const hx = 0.5 * st.size.x * S,
        hy = 0.5 * st.size.y * S,
        hz = 0.5 * st.size.z * S;
      // half-extent of the yawed bounding box projected onto the camera axis
      const halfDepth =
        hx * Math.abs(cy * _cfwd.x - sny * _cfwd.z) +
        hy * Math.abs(_cfwd.y) +
        hz * Math.abs(sny * _cfwd.x + cy * _cfwd.z);
      const depth = controls.focusDist + halfDepth;
      const sizeComp = depth / controls.focusDist;
      screenToWorld(cc.sx, cc.sy, depth, _wp);
      st.prev.copy(st.base);
      st.base.lerp(_wp, k);
      // face the live camera position every frame (rather than holding the
      // fixed _ay/_oy yaw) so both creatures keep looking at the camera
      // through the camY dive/tilt too
      st.yaw = yawToFace(camera.position, st.base, st.frontOffset);
      // idle ↔ swim crossfade by how fast it's travelling on screen
      const speed = st.prev.distanceTo(st.base) / Math.max(dt, 1e-3);
      const target = speed > 0.5 ? 1 : 0;
      st.swimBlend += (target - st.swimBlend) * Math.min(1, dt * 3.5);
      // axolotl-only: the flâneur section has a looping dance clip that takes
      // over from idle/swim while parked there, crossfading both ways so the
      // handoff never pops. It dances in bursts (a few seconds on, a
      // couple off) rather than nonstop, panning to face the centred content
      // as each burst starts and panning back as it pauses.
      if (id === 'axolotl' && st.dance) {
        const inSection = controls.activeSection === 'flaneur';
        if (inSection) {
          st.danceCycle.timer -= dt;
          if (st.danceCycle.timer <= 0) {
            st.danceCycle.dancing = !st.danceCycle.dancing;
            st.danceCycle.timer = st.danceCycle.dancing ? rand(3.5, 6) : rand(1.8, 3.2);
          }
        } else {
          st.danceCycle.dancing = true; // start dancing again next time it enters the section
          st.danceCycle.timer = 0;
        }
        const dancing = inSection && st.danceCycle.dancing;
        st.danceBlend += ((dancing ? 1 : 0) - st.danceBlend) * Math.min(1, dt * 2.5);

        // eased pan toward/away from centre — retriggers whenever the target
        // flips, so it reads as a deliberate turn rather than a static tilt
        const pan = st.facePan;
        const panTarget = dancing ? 1 : 0;
        if (panTarget !== pan.target) {
          pan.target = panTarget;
          pan.from = pan.value;
          pan.t = 0;
        }
        pan.t += dt;
        pan.value = pan.from + (pan.target - pan.from) * easeInOut(Math.min(1, pan.t / pan.dur));
      }
      // during the cassette-jury attack sequence, stepAttackFX drives the
      // octopus's idle/swim weights directly — don't fight it with the
      // movement-based blend above
      if (st.idle && st.swim && !(id === 'octopus' && attackFX.phase !== 'idle')) {
        const dance = id === 'axolotl' ? st.danceBlend : 0;
        st.swim.setEffectiveWeight(st.swimBlend * (1 - dance));
        st.idle.setEffectiveWeight((1 - st.swimBlend) * (1 - dance));
        if (st.dance) st.dance.setEffectiveWeight(dance);
      }
      const bob = Math.sin(t * 1.1 + st.phase) * 0.04;
      // the axolotl has no reaction clip, so a hit is a small procedural
      // knockback + wobble decaying over st.hit.dur
      let hitX = 0,
        hitRoll = 0;
      if (id === 'axolotl' && st.hit.active) {
        st.hit.t += dt;
        const hp = Math.min(1, st.hit.t / st.hit.dur);
        const decay = 1 - hp;
        hitX = Math.sin(hp * Math.PI) * 0.22 * st.hit.dirSign * decay;
        hitRoll = Math.sin(hp * Math.PI * 3) * 0.18 * decay;
        if (hp >= 1) st.hit.active = false;
      }
      st.obj.position.set(st.base.x + hitX, st.base.y + bob, st.base.z);
      st.obj.scale.setScalar(S * sizeComp);
      st.obj.rotation.z = st.roll + hitRoll; // screen-z flip (+ hit wobble)
      const yawNow = id === 'octopus' && attackFX.phase !== 'idle' ? attackFX.currentYaw : st.yaw;
      const centerYaw = id === 'axolotl' ? AXOLOTL_FACE_CENTER_YAW * st.facePan.value : 0;
      if (st.inner) st.inner.rotation.set(0, yawNow + centerYaw + Math.sin(t * 0.6 + st.phase) * 0.1, 0);
      for (const m of st.mats) m.uniforms.uOpacity.value = cc.opacity;
      st.obj.visible = cc.opacity > 0.01;
      // screen anchor just above the head, for the DOM conversation bubbles
      _head.set(st.base.x, st.base.y + S * sizeComp * 0.6, st.base.z);
      _proj.copy(_head).project(camera);
      anchors[id].x = (_proj.x * 0.5 + 0.5) * window.innerWidth;
      anchors[id].y = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
      anchors[id].visible = _proj.z < 1 && cc.opacity > 0.05;
    }
  }

  // ---------- asset-ready tracking (drives the loader / intro) ----------
  let readyFired = false;
  const readyCbs = [];
  const loadFlags = { fish: false, axolotl: false, octopus: false };
  function checkReady() {
    if (readyFired) return;
    if (loadFlags.fish && loadFlags.axolotl && loadFlags.octopus) {
      readyFired = true;
      readyCbs.forEach((cb) => cb());
    }
  }
  function whenReady(cb) {
    if (readyFired) cb();
    else readyCbs.push(cb);
  }

  (function loadCreatures() {
    for (const id of Object.keys(creatureUrls)) {
      const st = creatureState[id];
      loader.load(
        creatureUrls[id],
        (gltf) => {
          if (disposed) return;
          const prep = prepCreature(gltf);
          st.obj = prep.object;
          st.inner = prep.inner;
          st.mats = prep.mats;
          st.norm = 1 / (prep.height || 1);
          st.size.copy(prep.size);
          // animation: idle by default, blend to swim while travelling
          if (prep.animations.length) {
            st.mixer = new THREE.AnimationMixer(prep.animRoot);
            const clips = prep.animations;
            const find = (re) => clips.find((c) => re.test(c.name));
            const idleClip = find(/idle/i) || clips[0];
            const swimClip = find(/swim/i) || find(/attack|move|walk/i) || idleClip;
            const danceClip = find(/dance/i);
            st.idle = st.mixer.clipAction(idleClip);
            st.idle.play();
            if (swimClip !== idleClip) {
              st.swim = st.mixer.clipAction(swimClip);
              st.swim.play();
              st.swim.setEffectiveWeight(0);
            }
            if (danceClip && danceClip !== idleClip) {
              st.dance = st.mixer.clipAction(danceClip);
              st.dance.setLoop(THREE.LoopRepeat, Infinity);
              st.dance.play();
              st.dance.setEffectiveWeight(0);
            }
            st.idle.setEffectiveWeight(1);
          }
          screenToWorld(controls.creatures[id].sx, controls.creatures[id].sy, controls.focusDist, st.base);
          st.prev.copy(st.base);
          st.obj.position.copy(st.base);
          st.obj.scale.setScalar(st.norm * CREATURE_HEIGHT);
          scene.add(st.obj);
          loadFlags[id] = true;
          checkReady();
        },
        undefined,
        (err) => {
          console.error('creature load failed', id, err);
          loadFlags[id] = true; // don't hang the loader on a missing model
          checkReady();
        },
      );
    }
  })();

  // ---------- floating food flecks (the colourful specks) ----------
  const FOOD = LOW_POWER ? 140 : 320;
  const foodGeo = new THREE.BufferGeometry();
  const foodPos = new Float32Array(FOOD * 3);
  const foodCol = new Float32Array(FOOD * 3);
  const foodSpd = new Float32Array(FOOD);
  const foodPal = [0x6fae3a, 0x4f8f2a, 0xff8fb0, 0xffe07a, 0xff9a3c, 0xeae0c8, 0xd14b78];
  const _c = new THREE.Color();
  for (let i = 0; i < FOOD; i++) {
    foodPos[i * 3] = rand(-12, 12);
    foodPos[i * 3 + 1] = rand(-5, 6);
    foodPos[i * 3 + 2] = rand(-11, 8);
    foodSpd[i] = rand(0.08, 0.3);
    _c.setHex(foodPal[(Math.random() * foodPal.length) | 0]);
    foodCol[i * 3] = _c.r;
    foodCol[i * 3 + 1] = _c.g;
    foodCol[i * 3 + 2] = _c.b;
  }
  foodGeo.setAttribute('position', new THREE.BufferAttribute(foodPos, 3));
  foodGeo.setAttribute('color', new THREE.BufferAttribute(foodCol, 3));
  const foodMat = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
    fog: true,
  });
  const food = new THREE.Points(foodGeo, foodMat);
  scene.add(food);

  // ---------- bubbles (shared shader) ----------
  const bubbleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uPR: { value: PR } },
    vertexShader: /* glsl */ `
      attribute float aSize; uniform float uPR;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPR * (8.0 / max(-mv.z,0.1));
      }`,
    fragmentShader: /* glsl */ `
      precision mediump float;
      void main(){
        vec2 c = gl_PointCoord*2.0-1.0; float r = length(c);
        if(r>1.0) discard;
        float rim = smoothstep(0.72,0.97,r) * (1.0 - smoothstep(0.97,1.02,r));
        vec2 hl = c - vec2(-0.34,0.34);
        float spec = smoothstep(0.30,0.0,length(hl));
        float alpha = rim*0.85 + spec*0.9 + 0.05;
        vec3 col = mix(vec3(0.7,0.9,0.92), vec3(1.0), spec);
        gl_FragColor = vec4(col, alpha);
      }`,
  });

  // bubbles: emitted only while the cursor moves (plus the entry burst); they
  // swirl upward and shrink as they rise. Sized with headroom above the entry
  // burst's count so it doesn't recycle (and cut short) still-rising bubbles.
  const NB = LOW_POWER ? 260 : 520;
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(NB * 3),
    bVel = new Float32Array(NB * 3);
  const bSize = new Float32Array(NB),
    bBase = new Float32Array(NB);
  const bSpawnY = new Float32Array(NB),
    bPh = new Float32Array(NB);
  for (let i = 0; i < NB; i++) {
    bSize[i] = 0;
    bPos[i * 3 + 1] = 999;
  } // start inactive (size 0 = invisible)
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute('aSize', new THREE.BufferAttribute(bSize, 1));
  // bubbles live in a separate scene so they can be composited AFTER the
  // depth-of-field pass — i.e. always crisp, never blurred, per spec.
  const fxScene = new THREE.Scene();
  const bubbles = new THREE.Points(bGeo, bubbleMat);
  bubbles.frustumCulled = false; // positions start parked off-screen; keep it drawable
  fxScene.add(bubbles);

  const TOP_Y = 6.0;
  let bIdx = 0;
  function emitBubble(x, y, z, big) {
    const i = bIdx;
    bIdx = (bIdx + 1) % NB;
    bPos[i * 3] = x + rand(-0.15, 0.15);
    bPos[i * 3 + 1] = y + rand(-0.1, 0.1);
    bPos[i * 3 + 2] = z + rand(-0.15, 0.15);
    bVel[i * 3] = rand(-0.25, 0.25);
    bVel[i * 3 + 1] = 0.8 + Math.random() * 0.9;
    bVel[i * 3 + 2] = rand(-0.25, 0.25);
    bBase[i] = (big ? 12 : 7) + Math.random() * (big ? 16 : 15);
    bSize[i] = bBase[i];
    bSpawnY[i] = bPos[i * 3 + 1];
    bPh[i] = Math.random() * 6.28;
  }

  // pointer -> emit along the movement path (so a still cursor emits nothing)
  const pointer = new THREE.Vector2(0, 0);
  const ray = new THREE.Raycaster();
  const emitPlane = new THREE.Plane();
  const _fwd = new THREE.Vector3();
  const _planePt = new THREE.Vector3();
  const pWorld = new THREE.Vector3();
  let lastEmit = null;
  function pointerWorld(x, y) {
    pointer.x = (x / window.innerWidth) * 2 - 1;
    pointer.y = -(y / window.innerHeight) * 2 + 1;
    // emit on the focal plane (perpendicular to view dir, at focusDist) so the
    // bubbles spawn exactly where the creatures are — i.e. always in focus.
    camera.getWorldDirection(_fwd);
    _planePt.copy(camera.position).addScaledVector(_fwd, controls.focusDist);
    emitPlane.setFromNormalAndCoplanarPoint(_fwd, _planePt);
    ray.setFromCamera(pointer, camera);
    if (!ray.ray.intersectPlane(emitPlane, pWorld)) pWorld.copy(_planePt);
  }
  function onMove(x, y) {
    pointerWorld(x, y);
    if (lastEmit) {
      const dx = pWorld.x - lastEmit.x,
        dy = pWorld.y - lastEmit.y,
        dz = pWorld.z - lastEmit.z;
      const dist = Math.hypot(dx, dy, dz);
      const steps = Math.min(Math.floor(dist / 0.16), 7); // more bubbles the faster you move
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        emitBubble(lastEmit.x + dx * f, lastEmit.y + dy * f, lastEmit.z + dz * f, false);
      }
      if (steps > 0) lastEmit.set(pWorld.x, pWorld.y, pWorld.z);
    } else lastEmit = pWorld.clone();
  }
  function burst(x, y) {
    pointerWorld(x, y);
    for (let n = 0; n < 22; n++) emitBubble(pWorld.x, pWorld.y, pWorld.z, true);
  }

  // entrance effect: a wave of bubbles streaming up from across the bottom
  // edge, spread over `duration` ms — same emitBubble() as the cursor trail,
  // so lifecycle/size/swirl force all match.
  function burstFromBottom(total = 320, duration = 2200) {
    // the pool is half-size on mobile (NB above); emitting the full desktop
    // count would wrap bIdx and cut still-rising bubbles short mid-flight
    if (LOW_POWER) total = Math.min(total, 150);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const start = performance.now();
    let emitted = 0;
    const wave = () => {
      if (disposed) return;
      const elapsed = performance.now() - start;
      const target = Math.min(total, Math.floor((elapsed / duration) * total));
      while (emitted < target) {
        pointerWorld(rand(0, w), h - rand(0, 50));
        emitBubble(pWorld.x, pWorld.y, pWorld.z, Math.random() < 0.4);
        emitted++;
      }
      if (elapsed < duration) requestAnimationFrame(wave);
    };
    wave();
  }

  const onMouseMove = (e) => onMove(e.clientX, e.clientY);
  const onTouchMove = (e) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  };
  const onMouseDown = (e) => burst(e.clientX, e.clientY);
  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (t) burst(t.clientX, t.clientY);
  };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('touchstart', onTouchStart, { passive: true });

  // ---------- section prop models (cassette-jury / santa-beer / flaneur) ----------
  // Each project section shows its own 3D model where the content cloud used
  // to sit. On arrival the model FALLS in from above the frame — accelerating
  // like a real object dropped into the tank, trailing a bubble wake, then
  // splashing and settling with a damped bob. It idles on the focal plane
  // (always sharp), reacts to hover (pointer cursor, slight grow + tilt
  // toward the cursor), and clicking it is what opens the section's content
  // cloud: React registers a callback per section in `propClickHandlers`
  // (exposed on the returned API). Leaving the section fades the prop out and
  // re-arms the drop so every re-entry replays it.
  const propUrls = opts.propUrls ?? {
    'cassette-jury': '/models/cassette-jury.glb',
    'santa-beer': '/models/santa-beer.glb',
    'flaneur': '/models/flaneur.glb',
  };
  const PROP_HEIGHT = 3.0; // world height at prop.scale 1 (creatures are 1.75)
  // Props read darker than the creatures under the dimmed lit-stage look —
  // several of the models are near-black materials to begin with (cassette
  // deck, beer bottle) — so they get their own brightness lift on top of the
  // creatures' dim curve. >1 is fine: uDim is a plain colour multiplier.
  const PROP_LIGHT_BOOST = 1.45;
  const PROP_DROP_FROM = 8.5; // drop start, world units above the rest point (well off the top of the frame)
  const PROP_DROP_DUR = 1.1; // seconds of free fall
  const propClickHandlers = {}; // section id -> cb(id), registered by Section.jsx
  const propState = {};
  for (const id of Object.keys(propUrls)) {
    propState[id] = {
      obj: null, inner: null, mats: [], norm: 1, size: new THREE.Vector3(1, 1, 1),
      pos: new THREE.Vector3(), mixer: null, yaw: 0,
      fade: 0, dropT: -1, landT: 0, splashed: false, hoverBlend: 0,
      phase: Math.random() * 6.28,
    };
  }
  (function loadProps() {
    for (const id of Object.keys(propUrls)) {
      const st = propState[id];
      loader.load(
        propUrls[id],
        (gltf) => {
          if (disposed) return;
          const prep = prepCreature(gltf); // same candy material / centring / group nesting as the creatures
          st.obj = prep.object;
          st.inner = prep.inner;
          st.mats = prep.mats;
          st.norm = 1 / (prep.height || 1);
          st.size.copy(prep.size);
          if (prep.animations.length) {
            st.mixer = new THREE.AnimationMixer(prep.animRoot);
            st.mixer.clipAction(prep.animations[0]).play();
          }
          st.obj.visible = false;
          scene.add(st.obj);
        },
        undefined,
        (err) => console.error('prop load failed', id, err),
      );
    }
  })();

  // ---------- 3D section titles (BEHIND the prop models) ----------
  // The movie-style section name must be occluded by the 3D model, and DOM
  // can never paint under WebGL content — so the title lives in the scene
  // itself: the text is rasterised to a canvas texture on a camera-facing
  // plane placed just behind the model's back face. Sitting a little past
  // the focal plane, the DOF pass softens it slightly, which reads as depth.
  // Section.jsx skips its DOM <h2> for these sections.
  // Brand red pre-darkened to compensate for the post pipeline: colour
  // management is disabled scene-wide and the custom composite shaders do
  // their own gamma, which washes a raw sRGB canvas texel out pale — this
  // value round-trips to roughly --c-red (#d94e3b) on screen.
  const TITLE_COLOR = '#b2200f';
  const TITLE_FONT_PX = 240; // raster resolution, not on-screen size
  const TITLE_SCREEN_H = 0.19; // on-screen glyph height as a fraction of viewport height
  const TITLE_SY_LIFT = 0.17; // raised above the model's anchor so the name peeks over it
  const titleState = {}; // id -> { mesh, aspect, hFactor }
  function buildPropTitles() {
    for (const id of Object.keys(propUrls)) {
      if (titleState[id]) continue;
      const section = SECTIONS.find((s) => s.id === id);
      if (!section || !section.title) continue;
      const text = section.title;
      const font = `${TITLE_FONT_PX}px Quedami, "Helvetica Neue", Arial, sans-serif`;
      const cv = document.createElement('canvas');
      let ctx = cv.getContext('2d');
      ctx.font = font;
      const pad = TITLE_FONT_PX * 0.2; // accents/descenders overhang the em box
      cv.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
      cv.height = Math.ceil(TITLE_FONT_PX * 1.5);
      ctx = cv.getContext('2d'); // resizing reset the context state
      ctx.font = font;
      ctx.fillStyle = TITLE_COLOR;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, pad, cv.height * 0.55);
      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 4;
      // Lives in fxScene (composited AFTER the depth-of-field pass, like the
      // mouse bubbles) so the text stays CRISP — in the main scene the DOF
      // smeared it illegible. fxScene has no depth buffer from the scene, so
      // occlusion is done by hand: sample the scene pass's depth texture and
      // discard wherever something (the prop model) sits nearer than the
      // title plane.
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: false,
          uniforms: {
            uMap: { value: tex },
            uOpacity: { value: 0 },
            tDepth: { value: null }, // rebound every frame — resize recreates the target
            uRes: { value: new THREE.Vector2(1, 1) },
            uNear: { value: NEAR },
            uFar: { value: FAR },
          },
          vertexShader: /* glsl */ `
            varying vec2 vUv; varying float vViewZ;
            void main(){
              vUv = uv;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vViewZ = mv.z;
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            #include <packing>
            uniform sampler2D uMap; uniform sampler2D tDepth;
            uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uOpacity;
            varying vec2 vUv; varying float vViewZ;
            void main(){
              vec4 c = texture2D(uMap, vUv);
              float a = c.a * uOpacity;
              if (a < 0.01) discard;
              float sceneZ = perspectiveDepthToViewZ(texture2D(tDepth, gl_FragCoord.xy / uRes).x, uNear, uFar);
              // view-space z is negative ahead of the camera: greater = nearer.
              if (sceneZ > vViewZ + 0.05) discard; // the scene (the model) is in front
              gl_FragColor = vec4(c.rgb, a);
            }`,
        }),
      );
      mesh.visible = false;
      fxScene.add(mesh);
      titleState[id] = { mesh, aspect: cv.width / cv.height, hFactor: cv.height / TITLE_FONT_PX };
    }
  }
  // wait for the display font — rasterising before it lands would bake the
  // fallback face into the texture for the whole session
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!disposed) buildPropTitles();
    });
  } else {
    buildPropTitles();
  }

  // hover needs to know the pointer has actually moved (it starts parked at
  // NDC 0,0 = screen centre, right where the props sit) and whether it's over
  // DOM UI (the open content cloud) rather than the tank.
  let hasPointer = false;
  let pointerOnUI = false;
  let propCursorOn = false;
  const onPropPointerTrack = (e) => {
    hasPointer = true;
    pointerOnUI = !!(e.target && e.target.closest && e.target.closest('.content-cloud'));
  };
  // Touch browsers synthesise a mousemove on tap, which armed `hasPointer` for
  // the rest of the session — and from then on updateProps ran a full recursive
  // raycast against the active prop's un-accelerated geometry (flâneur is ~90k
  // verts) on EVERY frame, to drive a hover state a touch device can't show.
  // Never arming it on mobile skips that pass entirely; tap-to-open still works,
  // since handlePropTap raycasts on its own, once per tap.
  if (!LOW_POWER) window.addEventListener('mousemove', onPropPointerTrack);

  // click/tap → raycast the active section's prop and fire its React callback.
  // Clicks landing on the open content cloud are ignored so interacting with
  // the cloud never "clicks through" to the model behind the frosted glass.
  function handlePropTap(x, y, domTarget) {
    if (domTarget && domTarget.closest && domTarget.closest('.content-cloud')) return;
    const id = controls.activeSection;
    const st = propState[id];
    if (!st || !st.obj || controls.diveActive || st.dropT < PROP_DROP_DUR || st.fade < 0.5) return;
    pointerWorld(x, y); // updates the shared `pointer` NDC
    ray.setFromCamera(pointer, camera);
    if (ray.intersectObject(st.obj, true).length) {
      const cb = propClickHandlers[id];
      if (cb) cb(id);
    }
  }
  const onPropMouseDown = (e) => handlePropTap(e.clientX, e.clientY, e.target);
  const onPropTouchStart = (e) => {
    const t0 = e.touches[0];
    if (t0) handlePropTap(t0.clientX, t0.clientY, e.target);
  };
  window.addEventListener('mousedown', onPropMouseDown);
  window.addEventListener('touchstart', onPropTouchStart, { passive: true });

  const _pwp = new THREE.Vector3();
  const _twp = new THREE.Vector3();
  const _res2 = new THREE.Vector2();
  function updateProps(t, dt) {
    // the prop only lives while its section is settled — held off during the
    // cinematic dive (same reason as the chat bubbles: activeSection flips at
    // the scroll crossing, well before the camera actually arrives)
    const anchor = controls.propAnchor;
    const targetId =
      !controls.diveActive && anchor && propState[controls.activeSection]
        ? controls.activeSection
        : null;
    let anyHover = false;
    for (const id of Object.keys(propState)) {
      const st = propState[id];
      if (!st.obj) continue;
      if (id !== targetId) {
        // Not (or no longer) this section's turn. If it was still mid-fall —
        // e.g. the drop armed during the dive-debounce window before
        // diveActive flipped true — vanish outright instead of ghost-fading
        // at the rest point; a settled prop fades out where it is, holding
        // its last WORLD position (not re-anchored to the diving camera, so
        // it reads as left behind in the water).
        if (st.dropT >= 0 && st.dropT < PROP_DROP_DUR) st.fade = 0;
        st.dropT = -1;
        st.hoverBlend = 0;
        st.fade += (0 - st.fade) * Math.min(1, dt * 7);
        if (st.fade < 0.02) st.fade = 0;
        for (const m of st.mats) m.uniforms.uOpacity.value = st.fade;
        st.obj.visible = st.fade > 0.001;
        const tsOut = titleState[id];
        if (tsOut) {
          // fades out in place alongside the prop (same "left behind" rule)
          tsOut.mesh.material.uniforms.uOpacity.value = st.fade;
          tsOut.mesh.visible = st.fade > 0.001;
        }
        continue;
      }
      if (st.dropT < 0) {
        st.dropT = 0; // (re)arm: every section entry replays the drop
        st.landT = 0;
        st.splashed = false;
        st.hoverBlend = 0;
      }
      st.dropT += dt;
      st.fade += (1 - st.fade) * Math.min(1, dt * 10);
      if (st.mixer) st.mixer.update(dt);

      // seat it on the focal plane like the creatures: push it back by half
      // its yawed bounding box projected onto the view axis so the FRONT face
      // sits exactly on the plane (= always sharp under the tight DOF band).
      // Uses last frame's yaw (like updateCreatures) — it changes slowly.
      const S = st.norm * PROP_HEIGHT * (anchor.scale ?? 1);
      const cy = Math.cos(st.yaw),
        sny = Math.sin(st.yaw);
      const hx = 0.5 * st.size.x * S,
        hy = 0.5 * st.size.y * S,
        hz = 0.5 * st.size.z * S;
      const halfDepth =
        hx * Math.abs(cy * _cfwd.x - sny * _cfwd.z) +
        hy * Math.abs(_cfwd.y) +
        hz * Math.abs(sny * _cfwd.x + cy * _cfwd.z);
      const depth = controls.focusDist + halfDepth;
      const sizeComp = depth / controls.focusDist;
      screenToWorld(anchor.sx, anchor.sy, depth, _pwp);

      // drop-in: accelerating fall (p²) → splash burst → damped settle bob
      let yOff = 0;
      const falling = st.dropT < PROP_DROP_DUR;
      if (falling) {
        const p = st.dropT / PROP_DROP_DUR;
        yOff = PROP_DROP_FROM * (1 - p * p);
        // bubble wake trailing the fall
        if (Math.random() < 0.75) {
          emitBubble(_pwp.x, _pwp.y + yOff + rand(0.1, 0.6), _pwp.z, false);
          emitBubble(_pwp.x, _pwp.y + yOff + rand(0.4, 1.2), _pwp.z, false);
        }
      } else {
        if (!st.splashed) {
          st.splashed = true;
          for (let n = 0; n < 16; n++) emitBubble(_pwp.x, _pwp.y, _pwp.z, true);
          for (let n = 0; n < 10; n++) emitBubble(_pwp.x, _pwp.y, _pwp.z, false);
        }
        st.landT += dt;
        // plunges a touch past the rest point on impact, then springs back
        yOff = Math.sin(st.landT * 7.0) * -0.22 * Math.exp(-st.landT * 3.2);
      }

      // hover: pointer cursor + slight grow + tilt toward the cursor
      let hovered = false;
      if (!falling && hasPointer && !pointerOnUI) {
        ray.setFromCamera(pointer, camera);
        hovered = ray.intersectObject(st.obj, true).length > 0;
      }
      anyHover = anyHover || hovered;
      st.hoverBlend += ((hovered ? 1 : 0) - st.hoverBlend) * Math.min(1, dt * 8);

      st.pos.set(_pwp.x, _pwp.y + yOff + Math.sin(t * 1.1 + st.phase) * 0.05, _pwp.z);
      st.obj.position.copy(st.pos);
      st.obj.scale.setScalar(S * sizeComp * (1 + 0.08 * st.hoverBlend));
      // face the camera (plus the per-section yaw trim), sway gently, and
      // lean toward the cursor while hovered
      st.yaw = yawToFace(camera.position, st.pos, anchor.yaw ?? 0);
      _proj.copy(st.pos).project(camera);
      const tiltY = (pointer.x - _proj.x) * 0.35 * st.hoverBlend;
      const tiltX = -(pointer.y - _proj.y) * 0.25 * st.hoverBlend;
      st.inner.rotation.set(tiltX, st.yaw + Math.sin(t * 0.5 + st.phase) * 0.1 + tiltY, 0);
      for (const m of st.mats) m.uniforms.uOpacity.value = st.fade;
      st.obj.visible = true;

      // The cinematic title: camera-facing plane, lifted above the model's
      // anchor so the name peeks out over it. It only needs to sit a bit
      // past the model's FRONT surface — the shader's manual depth test
      // hides it wherever the model (always nearer) covers it.
      const ts = titleState[id];
      if (ts) {
        const depthT = controls.focusDist + halfDepth + 0.4;
        screenToWorld(anchor.sx, anchor.sy - TITLE_SY_LIFT, depthT, _twp);
        ts.mesh.position.copy(_twp);
        ts.mesh.quaternion.copy(camera.quaternion);
        // constant on-screen GLYPH height (so all three titles match), then
        // clamped to the viewport width for the long names on phones
        const worldScreenH = 2 * depthT * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        let h = worldScreenH * TITLE_SCREEN_H * ts.hFactor;
        const maxW = worldScreenH * camera.aspect * 0.94;
        if (h * ts.aspect > maxW) h = maxW / ts.aspect;
        ts.mesh.scale.set(h * ts.aspect, h, 1);
        const u = ts.mesh.material.uniforms;
        u.uOpacity.value = st.fade;
        u.tDepth.value = rtScene.depthTexture; // rebound each frame: setSizes() recreates the target
        u.uRes.value.copy(renderer.getDrawingBufferSize(_res2));
        ts.mesh.visible = st.fade > 0.001;
      }
    }
    if (anyHover !== propCursorOn) {
      propCursorOn = anyHover;
      document.body.style.cursor = anyHover ? 'pointer' : '';
    }
  }

  const SWIRL = 2.4;
  function updateBubbles(dt, t) {
    const sz = bGeo.attributes.aSize.array;
    for (let i = 0; i < NB; i++) {
      if (bSize[i] <= 0.05) continue; // inactive
      const y = bPos[i * 3 + 1];
      // swirl force (rotational drift that varies with height + time)
      bVel[i * 3] += Math.cos(t * 1.6 + bPh[i] + y * 0.6) * SWIRL * dt;
      bVel[i * 3 + 2] += Math.sin(t * 1.4 + bPh[i] + y * 0.6) * SWIRL * dt;
      bVel[i * 3] *= 0.93;
      bVel[i * 3 + 2] *= 0.93;
      bPos[i * 3] += bVel[i * 3] * dt;
      bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt;
      bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
      // shrink as it rises
      let prog = (bPos[i * 3 + 1] - bSpawnY[i]) / Math.max(TOP_Y - bSpawnY[i], 0.5);
      prog = prog < 0 ? 0 : prog > 1 ? 1 : prog;
      bSize[i] = bBase[i] * (1.0 - 0.82 * prog);
      sz[i] = bSize[i];
      if (bPos[i * 3 + 1] > TOP_Y) {
        bSize[i] = 0;
        sz[i] = 0;
        bPos[i * 3 + 1] = 999;
      } // pop at the surface
    }
    bGeo.attributes.position.needsUpdate = true;
    bGeo.attributes.aSize.needsUpdate = true;
  }

  // ---------- post: render target with depth ----------
  function makeTargets(w, h) {
    const depthTex = new THREE.DepthTexture(w, h);
    depthTex.minFilter = THREE.NearestFilter;
    depthTex.magFilter = THREE.NearestFilter;
    const rtScene = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      depthTexture: depthTex,
    });
    const rtDOF = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    return { rtScene, rtDOF };
  }
  let { rtScene, rtDOF } = makeTargets((window.innerWidth * PR) | 0, (window.innerHeight * PR) | 0);

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadScene.add(quad);

  // depth of field (aperture): foreground + background blur.
  // The tap count is the scene's most expensive single number — it's a
  // dependent texture fetch per sample over every pixel of a full-screen pass.
  // Mobile takes 10 taps at a smaller max radius: the golden-angle spiral stays
  // evenly distributed at low counts, and a tighter blur circle over fewer
  // samples keeps the bokeh smooth rather than dotty.
  const DOF_SAMPLES = LOW_POWER ? 10 : 24;
  const dofMat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: NEAR },
      uFar: { value: FAR },
      uFocus: { value: FOCUS_DIST }, // creatures sit exactly here → sharp
      uRange: { value: 1.9 }, // tight focus band so the background school is always soft
      uMaxBlur: { value: LOW_POWER ? 11.0 : 16.0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float; varying vec2 vUv;
      uniform sampler2D tColor, tDepth; uniform vec2 uRes;
      uniform float uNear,uFar,uFocus,uRange,uMaxBlur;
      float linDepth(vec2 uv){ float z=texture2D(tDepth,uv).x; float ndc=z*2.0-1.0;
        return (2.0*uNear*uFar)/(uFar+uNear - ndc*(uFar-uNear)); }
      void main(){
        vec3 base = texture2D(tColor, vUv).rgb;
        float d = linDepth(vUv);
        float coc = clamp(abs(d-uFocus)/uRange, 0.0, 1.0);
        coc = pow(coc,1.25)*uMaxBlur;
        if(coc < 0.6){ gl_FragColor=vec4(base,1.0); return; }
        const int N=${DOF_SAMPLES}; float ga=2.39996323; vec3 acc=base; float total=1.0;
        for(int i=0;i<N;i++){
          float fi=float(i); float rr=sqrt((fi+0.5)/float(N)); float a=fi*ga;
          vec2 off=vec2(cos(a),sin(a))*rr*coc/uRes;
          acc += texture2D(tColor, vUv+off).rgb; total+=1.0;
        }
        gl_FragColor=vec4(acc/total,1.0);
      }`,
  });

  // glass: edge/corner distortion, chromatic fringe, rim, vignette, grade
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, uAspect: { value: 1.0 }, uMaxR: { value: 1.0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform float uAspect,uMaxR;
      vec3 aces(vec3 x){ float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
        return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
      void main(){
        vec2 c = vUv-0.5; c.x*=uAspect;
        float r2=dot(c,c); float r=sqrt(r2);
        vec2 n=(vUv-0.5)*2.0;
        float edge = smoothstep(0.9, 1.0, max(abs(n.x),abs(n.y))); // warp only near edges/corners
        float k = (0.19*r2 + 0.36*r2*r2)*edge;
        vec2 cd = c*(1.0+k);
        cd += sign(c)*(abs(c.x)*abs(c.y))*0.17*edge;
        vec2 duv = cd; duv.x/=uAspect; duv+=0.5;
        vec2 dir = (r>1e-4)? c/r : vec2(0.0);
        vec2 ca = dir; ca.x/=uAspect; ca*=(0.004+0.032*r2)*edge;
        float cr=texture2D(tColor, clamp(duv+ca,0.0,1.0)).r;
        float cg=texture2D(tColor, clamp(duv,    0.0,1.0)).g;
        float cb=texture2D(tColor, clamp(duv-ca,0.0,1.0)).b;
        vec3 col=vec3(cr,cg,cb);
        float rr=r/uMaxR;
        col += smoothstep(0.84,1.0,rr)*vec3(0.06,0.11,0.11);
        col *= mix(0.5,1.0,smoothstep(1.18,0.35,rr));
        col = aces(col*1.06);
        col = pow(col, vec3(1.0/2.2));
        gl_FragColor=vec4(col,1.0);
      }`,
  });

  function setSizes() {
    const w = window.innerWidth,
      h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const bw = (w * PR) | 0,
      bh = (h * PR) | 0;
    rtScene.setSize(bw, bh);
    rtScene.depthTexture.image.width = bw;
    rtScene.depthTexture.image.height = bh;
    rtDOF.setSize(bw, bh);
    dofMat.uniforms.uRes.value.set(bw, bh);
    glassMat.uniforms.uAspect.value = w / h;
    glassMat.uniforms.uMaxR.value = Math.hypot(0.5 * (w / h), 0.5);
  }
  window.addEventListener('resize', setSizes);
  setSizes();

  function renderQuad(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target || null);
    renderer.render(quadScene, quadCam);
  }

  // ---------- animate ----------
  const clock = new THREE.Clock();
  const _envColor = new THREE.Color();
  const _spotAnchor = new THREE.Vector3();
  let mx = 0,
    my = 0;
  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // --- camera first: intro drop (top→bottom) + scroll-driven z + idle drift ---
    // creatures are placed relative to the camera, so it must be current.
    mx += (pointer.x - mx) * 0.04;
    my += (pointer.y - my) * 0.04;
    const intro = controls.introY; // 1 = parked high above; 0 = settled
    camera.position.x = CAM_BASE.x + (Math.sin(t * 0.12) * 0.5 + mx * 1.1) * (1 - intro);
    camera.position.y =
      CAM_BASE.y + controls.camY + (Math.sin(t * 0.16) * 0.3 + my * 0.7) * (1 - intro) + intro * 18.0;
    camera.position.z = controls.cameraZ + intro * 3.0;
    // The look-at target partially follows the camera down (CAM_TARGET_FOLLOW)
    // rather than staying fully fixed — sinking below it still tilts the view
    // up as a section gets deeper, but a target that never moved let the tilt
    // angle grow unbounded on the deepest dives, which pushed the creatures'
    // faces out of the DOF focal plane (their bounding-box "front" offset is
    // computed from the camera's forward vector, and a steep tilt inflates it).
    // Following most of the way keeps the tilt modest at any depth.
    _lookTarget.set(CAM_TARGET.x, CAM_TARGET.y + controls.camY * CAM_TARGET_FOLLOW, CAM_TARGET.z);
    camera.lookAt(_lookTarget);

    // ---------- environment tint + "lit stage" mood ----------
    // (cassette-jury / santa-beer / flaneur dim the tank and add an overhead
    // spotlight; see controls.envR/G/B + controls.stageLight in choreography.js)
    _envColor.setRGB(controls.envR, controls.envG, controls.envB);
    scene.background.copy(_envColor);
    scene.fog.color.copy(_envColor);
    // Three separate dim curves, not one: the static environment (floor/back
    // wall/water) drops hard toward near-black so the tank reads as a dark
    // stage; the hero creatures barely dim at all — they're the ones
    // standing "in the spotlight" and should stay clearly visible/bright,
    // with the contrast against the dark surroundings doing the work instead;
    // the background fish get a milder dim than the environment — cut as hard
    // as the floor/walls, they read as murky near-black silhouettes instead of
    // a soft blurred school.
    const envDim = 1 - controls.stageLight * 0.78; // 1 → ~0.22 at full stage light
    const creatureDim = 1 - controls.stageLight * 0.08; // 1 → ~0.92 — stays bright
    const fishDim = 1 - controls.stageLight * 0.45; // 1 → ~0.55 — muted, not blacked out
    floorMat.uniforms.uFogColor.value.copy(_envColor);
    floorMat.uniforms.uDim.value = envDim;
    backMat.uniforms.uFogColor.value.copy(_envColor);
    backMat.uniforms.uDim.value = envDim;
    surfaceMat.uniforms.uFogColor.value.copy(_envColor);
    surfaceMat.uniforms.uDim.value = envDim;
    // hidden outright (not faded) through the whole dive sequence, including
    // mid-transition — with the camera tilting steeply upward at depth, this
    // plane (the tank's top boundary, seen from below) swings into the middle
    // of the frame instead of staying near the top edge, reading as a stray
    // "second surface" underwater rather than the ceiling it's meant to be.
    // Keyed off activeSection (flips the instant scroll crosses the section
    // boundary) rather than stageLight (which only ramps in over the dive),
    // so it's gone from the moment the dive starts, not partway through.
    const inStageLightSection = STAGE_LIGHT_SECTIONS.has(controls.activeSection);
    surface.visible = !inStageLightSection;
    // same problem, same fix, for the tank floor: once the camera sinks below
    // it and tilts up, this flat opaque plane swings up into frame and cuts
    // off the creatures' legs/tentacles instead of staying below them
    floor.visible = !inStageLightSection;
    // fade the background school down too (not just dim its colour) — a busy
    // school of fish reads as clutter against a clean single-spotlight stage
    // look, so it recedes almost out of sight rather than just going darker
    const fishOpacityMul = 1 - controls.stageLight * 0.7;
    for (const g of fishGroups) {
      g.mesh.material.uniforms.uFogColor.value.copy(_envColor);
      g.mesh.material.uniforms.uDim.value = fishDim;
      g.mesh.material.uniforms.uOpacity.value = 0.95 * fishOpacityMul;
    }
    for (const id of ['axolotl', 'octopus']) {
      for (const m of creatureState[id].mats) {
        m.uniforms.uFogColor.value.copy(_envColor);
        m.uniforms.uDim.value = creatureDim;
        m.uniforms.uSpot.value = controls.stageLight;
      }
    }
    // section props share the creatures' "in the spotlight" dim curve — they
    // stand centre-stage in the same lit-stage sections — plus their own
    // brightness lift (their materials are much darker than the candy pets).
    // Per-section override via prop.boost in choreography.js (not
    // breakpoint-dependent, so reading the desktop STAGE table is fine).
    for (const id of Object.keys(propState)) {
      const boost = STAGE[id]?.prop?.boost ?? PROP_LIGHT_BOOST;
      for (const m of propState[id].mats) {
        m.uniforms.uFogColor.value.copy(_envColor);
        m.uniforms.uDim.value = creatureDim * boost;
        m.uniforms.uSpot.value = controls.stageLight;
      }
    }
    hemi.intensity = BASE_LIGHT_INTENSITY.hemi * envDim;
    key.intensity = BASE_LIGHT_INTENSITY.key * envDim;
    fill.intensity = BASE_LIGHT_INTENSITY.fill * envDim;
    ambient.intensity = BASE_LIGHT_INTENSITY.ambient * envDim;
    // single warm overhead cone stays screen-centred (camera-relative, like
    // the creatures) through the camY dive; the window shafts + glow it
    // replaces fade down at the same time so only the one clean beam reads,
    // instead of the whole scattered multi-shaft wash
    camera.updateMatrixWorld(true);
    // kept close to the focal plane (vs. the window shafts, which sit well
    // behind it) so DOF doesn't blur it into a shapeless glow — it should
    // read as a distinct cone, not a soft haze
    screenToWorld(0.5, 0.42, controls.focusDist * 1.08, _spotAnchor);
    spotBeam.position.x = _spotAnchor.x;
    spotBeam.position.z = _spotAnchor.z;
    spotMat.uniforms.uTime.value = t;
    spotMat.uniforms.uInten.value = controls.stageLight * 1.9;
    const otherShaftMul = 1 - controls.stageLight * 0.92;
    glowMat.uniforms.uInten.value = otherShaftMul;

    floorMat.uniforms.uTime.value = t;
    backMat.uniforms.uTime.value = t * 0.8;
    surfaceMat.uniforms.uTime.value = t;
    surfaceMat.uniforms.uCam.value.copy(camera.position);
    shafts.children.forEach((s, i) => {
      s.material.uniforms.uTime.value = t;
      s.material.uniforms.uInten.value = s.userData.baseInten * otherShaftMul;
      s.position.x = s.userData.baseX + Math.sin(t * s.userData.sp + i) * 0.45;
    });
    dofMat.uniforms.uFocus.value = controls.focusDist;

    updateFish(t);
    updateCreatures(t, dt);
    updateProps(t, dt);
    updateBubbles(dt, t);

    // food flecks drift slowly down with lateral wobble
    const fp = foodGeo.attributes.position.array;
    for (let i = 0; i < FOOD; i++) {
      fp[i * 3 + 1] -= foodSpd[i] * dt;
      fp[i * 3] += Math.sin(t * 0.4 + i) * 0.004;
      fp[i * 3 + 2] += Math.cos(t * 0.35 + i) * 0.004;
      if (fp[i * 3 + 1] < -5.5) {
        fp[i * 3 + 1] = 6.0;
        fp[i * 3] = rand(-12, 12);
        fp[i * 3 + 2] = rand(-11, 8);
      }
    }
    foodGeo.attributes.position.needsUpdate = true;

    // render: scene → depth-of-field → sharp bubble overlay → glass
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);
    dofMat.uniforms.tColor.value = rtScene.texture;
    dofMat.uniforms.tDepth.value = rtScene.depthTexture;
    renderQuad(dofMat, rtDOF);
    // composite the crisp mouse bubbles on top of the blurred frame
    renderer.setRenderTarget(rtDOF);
    renderer.autoClear = false;
    renderer.render(fxScene, camera);
    renderer.autoClear = true;
    glassMat.uniforms.tColor.value = rtDOF.texture;
    renderQuad(glassMat, null);
  }
  tick();

  // ---------- context loss / background tab ----------
  // When a mobile GPU's watchdog or the OS memory reaper kills the WebGL
  // context, the canvas goes black permanently — and the rAF loop kept spinning,
  // burning CPU issuing draw calls into a dead context (and re-triggering the
  // very pressure that killed it). Preventing the default event lets the browser
  // hand the context back, and three.js re-uploads its resources on the next
  // frame; parking the loop in between is what makes the recovery survivable.
  const canvas = renderer.domElement;
  let contextLost = false;
  const resumeLoop = () => {
    if (disposed || contextLost || raf || document.hidden) return;
    clock.getDelta(); // flush the paused interval so dt doesn't jump on resume
    raf = requestAnimationFrame(tick);
  };
  const pauseLoop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onContextLost = (e) => {
    e.preventDefault();
    contextLost = true;
    pauseLoop();
  };
  const onContextRestored = () => {
    contextLost = false;
    resumeLoop();
  };
  // backgrounding a tab already throttles rAF, but not before the frame in
  // flight — and on mobile that last full-resolution frame lands exactly when
  // the OS is reclaiming memory for whatever the visitor switched to
  const onVisibility = () => (document.hidden ? pauseLoop() : resumeLoop());
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- teardown ----------
  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', setSizes);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('mousemove', onPropPointerTrack);
    window.removeEventListener('mousedown', onPropMouseDown);
    window.removeEventListener('touchstart', onPropTouchStart);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    document.removeEventListener('visibilitychange', onVisibility);
    if (propCursorOn) document.body.style.cursor = '';
    const disposeTree = (root) =>
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
    disposeTree(scene);
    disposeTree(fxScene);
    rtScene.dispose();
    rtDOF.dispose();
    quad.geometry.dispose();
    renderer.dispose();
    // hands the GPU allocation back immediately instead of waiting for the
    // canvas to be collected — matters in React StrictMode, which mounts the
    // scene twice, and on any phone tight enough to be crashing in the first place
    renderer.forceContextLoss();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  /**
   * @returns {{
   *   dispose: () => void,
   *   renderer: THREE.WebGLRenderer,
   *   controls: object,   // mutate to drive camera (introY, cameraZ) + creatures (sx,sy,scale,opacity)
   *   anchors: object,    // live screen-px anchor above each creature's head (for DOM bubbles)
   *   whenReady: (cb: () => void) => void, // fires once fish + both creatures have loaded
   *   burstFromBottom: (total?: number, duration?: number) => void, // entry bubble wave
   *   propClickHandlers: object, // section id -> cb(id); Section.jsx registers these to open its cloud on prop click
   * }}
   */
  return { dispose, renderer, controls, anchors, whenReady, burstFromBottom, propClickHandlers };
}
