import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NOISE } from './shaders.js';
import { STAGE, FOCUS_DIST } from './choreography.js';

// The reference scene predates three.js colour management. Disable it so raw
// THREE.Color uniform values stay the same byte-for-byte as r128 (the custom
// shaders do their own sRGB <-> linear gamma), keeping the look identical.
THREE.ColorManagement.enabled = false;

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

  // ---------- live control bridge (GSAP / React mutate these; tick() reads them) ----------
  const controls = {
    introY: 1, // 1 = camera parked high above (loader); 0 = settled into the main framing
    cameraZ: STAGE.main.cameraZ, // base camera z (scroll moves the camera along z)
    focusDist: FOCUS_DIST, // view-space depth of the focal plane (creatures + mouse bubbles)
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
  const PR = Math.min(window.devicePixelRatio || 1, 2);
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
  camera.position.copy(CAM_BASE);
  camera.lookAt(CAM_TARGET);

  // ---------- lights: warm key from the left, cool fill from the right ----------
  scene.add(new THREE.HemisphereLight(0x8fdcef, 0x07302e, 0.55));
  const key = new THREE.DirectionalLight(0xffe6c2, 1.3); // warm window light, left
  key.position.set(-7, 9, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x74d2e2, 0.45); // cool fill, right
  fill.position.set(6, 4, 6);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x115560, 0.42));

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
        uniform float uTime, uFogDensity; uniform vec3 uDeep, uLit, uFogColor;
        void main(){
          vec2 uv = vWorld.xz * 0.14;
          float c = caustic(uv, uTime);
          vec3 col = mix(uDeep, uLit, clamp(c*0.95,0.0,1.0));
          col += vec3(0.4,0.5,0.45) * pow(clamp(c-0.6,0.0,1.0),1.5) * 0.8;
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
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying float vDepth;
      void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz;
        vec4 mv=viewMatrix*wp; vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader:
      NOISE +
      /* glsl */ `
      varying vec3 vWorld; varying float vDepth;
      uniform float uTime, uFogDensity; uniform vec3 uCam, uDeep, uBright, uWarm, uFogColor;
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
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:
      NOISE +
      /* glsl */ `
      varying vec2 vUv; uniform float uTime,uPhase,uInten; uniform vec3 uColor;
      void main(){
        float v = smoothstep(0.0,1.0,vUv.y);
        float streak = fbm(vec2(vUv.x*3.5 + uPhase, vUv.y*0.6 - uTime*0.05));
        float edge = smoothstep(0.0,0.18,vUv.x)*smoothstep(0.0,0.18,1.0-vUv.x);
        float a = v*(0.18+0.55*streak)*edge;
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
    s.userData = { baseX: cf.x, sp: 0.18 + Math.random() * 0.18 };
    shafts.add(s);
  });
  scene.add(shafts);

  // blown-out warm window glow, upper-left
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0xfff0d2) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `varying vec2 vUv; uniform vec3 uColor;
      void main(){ float d=length(vUv-0.5)*2.0; float a=smoothstep(1.0,0.0,d); gl_FragColor=vec4(uColor,a*a*0.55);}`,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), glowMat);
  glow.position.set(-7.5, 3.6, -6.5);
  scene.add(glow);

  // ---------- fish (loaded GLB models, rendered with the translucent veil) ----------
  const Z = new THREE.Vector3(0, 0, 1);
  const FISH_N = 40;
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
        uniform sampler2D uMap; uniform vec3 uFogColor; uniform float uOpacity,uFogDensity;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vFog;
        void main(){
          vec3 N=normalize(vN), V=normalize(vView);
          vec3 tex = pow(texture2D(uMap, vUv).rgb, vec3(2.2));   // sRGB -> linear
          float fres = pow(1.0 - clamp(dot(N,V),0.0,1.0), 2.0);  // clear centre, brighter rim
          float lite = 0.55 + 0.5*clamp(dot(N, normalize(vec3(-0.3,1.0,0.4))),0.0,1.0);
          vec3 col = tex*(0.72 + 0.5*lite) + vec3(0.13,0.18,0.20)*fres;
          float alpha = clamp(uOpacity*(0.36 + 0.85*fres), 0.0, 1.0);
          float f = 1.0 - exp(-uFogDensity*uFogDensity*vFog*vFog);
          col = mix(col, uFogColor, clamp(f,0.0,1.0));
          gl_FragColor = vec4(col, alpha);
        }`,
    });
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
    return { geo, mat: makeFishMat(mesh.material.map) };
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
    _d = new THREE.Vector3();
  const _q = new THREE.Quaternion(),
    _qs = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0),
    _dummy = new THREE.Object3D();
  let fishGroups = []; // one InstancedMesh per model type: { mesh, list:[params] }

  function updateFish(t) {
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
        uniform sampler2D uMap; uniform float uHasMap,uOpacity,uFogDensity,uDesat,uBright,uCoat;
        uniform vec3 uTint,uFogColor;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vFog;
        void main(){
          vec3 N=normalize(vN), V=normalize(vView);
          vec3 base = uTint;
          if(uHasMap > 0.5){ base = pow(texture2D(uMap, vUv).rgb, vec3(2.2)); }
          // desaturate toward luma + brighten a touch
          float luma = dot(base, vec3(0.299,0.587,0.114));
          base = clamp(mix(base, vec3(luma), uDesat) * uBright, 0.0, 1.0);

          vec3 L = normalize(vec3(-0.3,1.0,0.5));
          float diff = 0.66 + 0.4*clamp(dot(N,L),0.0,1.0);
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
          col += vec3(1.0)*spec*0.7;                  // coat hotspot
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
    root.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false;
        const srcMap = o.material && o.material.map ? o.material.map : null;
        const srcTint = o.material && o.material.color ? o.material.color.getHex() : 0xffffff;
        o.material = makeCreatureMat(srcMap, srcMap ? 0xffffff : srcTint);
        mats.push(o.material);
      }
    });
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
  const _ay = _qp.has('ay') ? parseFloat(_qp.get('ay')) : -Math.PI / 2;
  const _oy = _qp.has('oy') ? parseFloat(_qp.get('oy')) : -Math.PI / 2;
  const creatureState = {
    axolotl: {
      obj: null, inner: null, mats: [], norm: 1, size: new THREE.Vector3(1, 1, 1),
      base: new THREE.Vector3(), prev: new THREE.Vector3(),
      phase: 0.0, yaw: _ay, roll: 0,
      mixer: null, idle: null, swim: null, swimBlend: 0,
    },
    octopus: {
      obj: null, inner: null, mats: [], norm: 1, size: new THREE.Vector3(1, 1, 1),
      base: new THREE.Vector3(), prev: new THREE.Vector3(),
      phase: 2.1, yaw: _oy, roll: 0,
      mixer: null, idle: null, swim: null, swimBlend: 0,
    },
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

  function updateCreatures(t, dt) {
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(_cfwd); // view axis: creatures get pushed back along it
    const k = Math.min(1, dt * 6); // smoothing toward target anchor (swim)
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
      // idle ↔ swim crossfade by how fast it's travelling on screen
      const speed = st.prev.distanceTo(st.base) / Math.max(dt, 1e-3);
      const target = speed > 0.5 ? 1 : 0;
      st.swimBlend += (target - st.swimBlend) * Math.min(1, dt * 3.5);
      if (st.idle && st.swim) {
        st.swim.setEffectiveWeight(st.swimBlend);
        st.idle.setEffectiveWeight(1 - st.swimBlend);
      }
      const bob = Math.sin(t * 1.1 + st.phase) * 0.04;
      st.obj.position.set(st.base.x, st.base.y + bob, st.base.z);
      st.obj.scale.setScalar(S * sizeComp);
      st.obj.rotation.z = st.roll; // screen-z flip
      if (st.inner) st.inner.rotation.set(0, st.yaw + Math.sin(t * 0.6 + st.phase) * 0.1, 0);
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
            st.idle = st.mixer.clipAction(idleClip);
            st.idle.play();
            if (swimClip !== idleClip) {
              st.swim = st.mixer.clipAction(swimClip);
              st.swim.play();
              st.swim.setEffectiveWeight(0);
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
  const FOOD = 320;
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

  // bubbles: emitted only while the cursor moves; they swirl upward and shrink as they rise
  const NB = 340;
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

  // depth of field (aperture): foreground + background blur
  const dofMat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: NEAR },
      uFar: { value: FAR },
      uFocus: { value: FOCUS_DIST }, // creatures sit exactly here → sharp
      uRange: { value: 1.9 }, // tight focus band so the background school is always soft
      uMaxBlur: { value: 16.0 },
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
        const int N=24; float ga=2.39996323; vec3 acc=base; float total=1.0;
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
      CAM_BASE.y + (Math.sin(t * 0.16) * 0.3 + my * 0.7) * (1 - intro) + intro * 18.0;
    camera.position.z = controls.cameraZ + intro * 3.0;
    camera.lookAt(CAM_TARGET.x, CAM_TARGET.y, CAM_TARGET.z);

    floorMat.uniforms.uTime.value = t;
    backMat.uniforms.uTime.value = t * 0.8;
    surfaceMat.uniforms.uTime.value = t;
    surfaceMat.uniforms.uCam.value.copy(camera.position);
    shafts.children.forEach((s, i) => {
      s.material.uniforms.uTime.value = t;
      s.position.x = s.userData.baseX + Math.sin(t * s.userData.sp + i) * 0.45;
    });
    dofMat.uniforms.uFocus.value = controls.focusDist;

    updateFish(t);
    updateCreatures(t, dt);
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

  // ---------- teardown ----------
  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', setSizes);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('touchstart', onTouchStart);
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
   * }}
   */
  return { dispose, renderer, controls, anchors, whenReady };
}
