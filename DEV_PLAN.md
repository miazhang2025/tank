# AQUARIA · tank study — Dev Plan

> Living checklist. We always work against this list. Check items off as they land.
> Last updated: 2026-06-30

---

## 0. Confirmed decisions (from Q&A)

- **Scroll model:** Section **snap** — 6 full-viewport sections, scroll snaps section→section with a smooth transition. On each transition the animals swim to the next spot, old bubbles/content fade out, camera moves (mainly on **z**), animals stay in focus.
- **Animation stack:** **GSAP + ScrollTrigger + Lenis** (smooth inertial scroll + per-section timelines).
- **Loading page:** **Rising-bubbles loader** — animated underwater bubbles/caustics while GLB models load, no progress bar, then fades into the top→bottom camera intro.
- **Scope:** **Desktop + mobile** responsive from the start (mobile mockups + `content bubble-mobile.svg` provided).

## Section order
`main → about → cassette jury → santa beer → flaneur → more`

## Brand palette (from attached swatch — tune as needed)
| token | hex (approx) | use |
|---|---|---|
| `--c-blue`  | `#A7D8E5` | accents / cool light |
| `--c-teal`  | `#6FAFAD` | water mid-tone |
| `--c-pink`  | `#F186AF` | axolotl bubbles (@~30% over glass) |
| `--c-red`   | `#D94E3B` | octopus bubbles (@~30% over glass) + headings |
| `--c-cream` | `#FDF5E7` | content-cloud glass / light text bg |
| `--c-ink`   | `#4B4B4B` | body & dialogue text |

---

## A. Assumptions derived from the mockups (please confirm / correct)

- **A1 — Two bubble systems, both DOM/CSS glass overlays (always sharp), anchored above each animal's on-screen position:**
  - **Conversation bubbles** — small chat blobs, **IBM Plex Mono** text, fixed width / auto height, pop in with a squish-deform, stack upward (newest near the animal, older ones higher).
  - **Content bubbles** — large cloud/thought shape (`content bubble.svg`), holding a **Darker Grotesque** heading + **Crimson Text** body + an **IBM Plex Mono** button (e.g. "Talk with the Jury.", "Drink Beer").
  - Both use the **same frosted-glass `backdrop-filter`** as the sidebar (so text stays crisp, immune to the 3D depth-of-field). Only the **mouse bubbles** and the **animals** live in the 3D scene.
- **A2 — Speaker → side → colour:** axolotl (left) speaks with **pink** bubbles; octopus (right) speaks with **red** bubbles. Both are the **brand pink / brand red at ~30% opacity layered on the frosted-glass shader** — over the teal water this reads as the muted lavender/peach seen in the mockups. (Confirmed.)
- **A3 — "Santa Beer"** is the correct label (current sidebar says "Santa Beet" — will fix).
- **A4 — Buttons are non-functional placeholders** for now (no destinations yet); easy to wire later.
- **A5 — Flaneur mockup provided** → real content: cloud content bubble (heading "Flaneur" + Crimson Text body about the location-aware iOS music app + "Take a walk" button), axolotl lower-left with a "What is this?" bubble, octopus lower-right. Built in the same system.
- **A6 — Animals "always sharp":** keep them on the **focal plane** and make the DOF **focus distance track their depth** every frame; mouse-bubble emit plane = same focal plane.
- **A7 — Animal anchors per section (screen-space, from mockups; tunable):**
  - `main`: axolotl lower-left-centre, octopus lower-right-centre (apart).
  - `about`: axolotl lower-left, octopus lower-centre-right (apart). Sidebar shown open in mockup.
  - `cassette jury`: axolotl + octopus **together**, lower-left.
  - `santa beer`: axolotl lower-left, octopus lower-right (far apart).
  - `flaneur`: placeholder (TBD).
  - `more`: axolotl lower-left, octopus lower-right (apart).

---

## B. Content / data the user will fill in later

Framework is **data-driven**. After scaffolding, drop text into `src/content/sections.js`; drop models/art into `public/`.

- `src/content/sections.js` schema (placeholders shipped):
  ```js
  {
    id: 'about',
    title: 'About',                 // Darker Grotesque heading (null = none)
    chat: [                         // conversation bubbles, in reveal order
      { who: 'octopus', text: 'So, what is AQUARIA?' },
      { who: 'axolotl', text: 'A tank. Two of us live in it…' },
    ],
    content: {                      // optional cloud content bubble
      heading: 'About',
      body: 'AQUARIA is a new media studio…',   // Crimson Text
      button: { label: 'Knock on the glass.' }, // IBM Plex Mono
    },
  }
  ```
- Asset folders (exist / to create): `public/models/` (octopus.glb, axolotl.glb present), `public/UI/` (bubble SVGs present), `public/textures/` (placeholders if needed).

---

## C. Build phases & checklist

### Phase 0 — Scaffolding & dependencies
- [ ] Install `gsap`, `lenis`.
- [ ] Add **Darker Grotesque** + **Crimson Text** to `index.html` (IBM Plex Mono already loaded).
- [ ] CSS design tokens: 3 font families + glass-material variables (sidebar glass + bubble colour variants).
- [ ] Create folder structure & stub files: `src/scene/creatures.js`, `src/scroll/`, `src/content/sections.js` (placeholder dialogue), `src/components/{Loader,Section,ConversationBubble,ContentBubble,Stage}.jsx`.

### Phase 1 — Scene upgrades (Three.js) ✅
- [x] Refactor `createAquarium` to return an **API** (`controls`, `anchors`, `whenReady`).
- [x] Load & add **octopus + axolotl**, normalised, front-facing (axolotl yaw π/4, octopus 3π/4), gentle bob/sway; kept on the **focal plane**, always sharp.
- [x] DOF **focus = focal-plane depth**; **mouse-bubble emit plane** aligned to it; bubbles composited **after** DOF so they're always crisp.
- [x] Constrained **fish school** to deep background (world-z negative); tuned `focus=6/range=1.9/maxBlur=16` so fish are always soft while creatures + bubbles stay sharp. Verified via screenshots.

### Phase 2 — Loading page ✅
- [x] Rising-bubbles loader overlay (teal depth gradient, AQUARIA wordmark), tracks real GLB load via `whenReady`.
- [x] On ready: loader dissolves while the **top→bottom camera intro** (`introY` 1→0) drops into the `main` framing. Verified via screenshots.

### Phase 3 — Scroll framework ✅
- [x] Lenis smooth scroll + GSAP ScrollTrigger, 6 **snap** sections over a tall spacer (fixed WebGL canvas + fixed `.stage` overlay).
- [x] Continuous progress→state interpolation: camera **z** + creature **anchors** lerp from scroll progress (animals swim, camera moves); section layers cross-fade.
- [x] Sidebar: **default closed**; labels from content config (incl. SANTA BEER fix); `scrollToSection` nav hook. Verified across about/santa/more.
- [x] Scroll held until the intro settles (`active`), then released.

### Phase 4 — Bubbles & content (DOM glass) ✅
- [x] Glass tokens matching sidebar; conversation tints = brand pink/red @30% over the glass (axolotl left, octopus right).
- [x] Conversation bubbles: fixed width / auto height, IBM Plex Mono, text aligned to speaker side, **elastic squish pop-in** (GSAP), reveal in conversation order.
- [x] `ContentCloud`: `content bubble.svg`-masked frosted cloud with Darker Grotesque heading + Crimson Text body + IBM Plex Mono glass button; per-section placement.
- [x] Stacks anchored above each creature via the scene's screen anchors, followed every frame as they swim. Verified across main/about/cassette/flaneur.

### Phase 5 — Per-section choreography ✅
- [x] Animal anchors + camera z per section driven continuously by scroll progress; creatures swim, camera moves on z, content cross-fades on exit. Verified across all 6 sections + a mid-transition frame.
- [x] Bubbles reveal in conversation order with the squish pop-in; content clouds fade in/out.
- [x] Flaneur built with real content (heading/body/button + "What is this?" bubble).

### Phase 6 — Polish & responsive ✅
- [x] **Mobile** layouts: single-column iMessage chat for chat-only sections, full-width portrait clouds (`content bubble-mobile.svg`) for content sections; responsive title/wordmark/bubble sizing. Verified at 402×874.
- [x] `prefers-reduced-motion` fallback (intro + bubble reveals); creatures composited cheaply; follow-rAF gated to near-active sections.
- [x] Final pass against mockups (main / about / cassette / santa / flaneur / more, desktop + mobile).

---

### Phase 7 — "Figma glass" material (refraction · depth · dispersion · frost · splay)
Upgrade the existing flat frosted-glass (`--glass-bg` + `blur/saturate/brightness`) on the
**sidebar, conversation bubbles, CTA button, content cloud** toward the fuller glass look
described by Figma's Glass effect knobs. These are DOM/CSS elements over an animating WebGL
canvas, not native Figma nodes, so each attribute is *approximated*:

| attribute | how |
|---|---|
| **Frost** | existing `backdrop-filter: blur()/saturate()/brightness()` (plain CSS, universal) + a faint static noise-grain layer for an "etched" texture. |
| **Depth** | plain CSS: layered `box-shadow` (inset top highlight + inset bottom shadow + outer ambient shadow) on the existing masked `::before` glass layer — the mask clips the shadow to the blob silhouette, reading as glass thickness. Universal, no SVG needed. |
| **Refraction** | new `::after` overlay per surface, same mask as the surface's own shape, `backdrop-filter: url(#glass-x)` — a low-frequency `feTurbulence` → `feDisplacementMap` bending the backdrop like a lens. |
| **Splay** | inside the same filter: a second, stronger displacement pass blended in only near the shape edges via a static radial-gradient mask (`feImage`, cheap — not recomputed from the animating backdrop), so bend increases toward the rim like real glass. |
| **Dispersion** | inside the same filter: split the warped result into R/G/B (`feColorMatrix`), nudge R/B a pixel apart, recombine with `feBlend mode="screen"` → a subtle chromatic fringe at edges. |

**Architecture** (mirrors the sidebar's existing `.sidebar` + `.sidebar-refract` two-layer
pattern, extended to the other 3 surfaces as `::before` base glass + `::after` SVG-warp overlay
— no new DOM nodes needed except where a surface's mask is JS-driven like the sidebar):
- `index.html`: replace the single `#glassWarp` filter with 4 tuned variants —
  `#glass-sidebar`, `#glass-cloud`, `#glass-cta` (full 5-attribute treatment — larger, few
  on-screen at once) and a **lighter** `#glass-bubble` (refraction + frost + depth + mild
  dispersion, **skip the edge-splay pass**) since several chat bubbles can be on-screen and
  animating at once — full per-bubble splay risks jank for a barely-visible payoff at that size.
- `src/index.css`: add the depth box-shadow to the shared `--glass-*` rim treatment; add each
  surface's `::after` refract overlay (reusing that surface's existing mask/mask-border).
- **Fallback (Firefox/Safari):** `backdrop-filter: url(#...)` silently no-ops there, so the
  `::after` overlay simply contributes nothing — surfaces fall back to the plain blur + new
  depth box-shadow + frost grain (all plain CSS, render everywhere). Only refraction/splay/
  dispersion are Chromium-only, same precedent as `mask-border` ([[bubble-shape-mask-border]]).
- **Perf:** filters are only recomputed on repaint, but these surfaces sit over a continuously
  animating canvas so they repaint every frame — keep filter regions tight to each shape's
  bbox, avoid `feMorphology` (expensive; use the static `feImage` radial mask instead for splay),
  and profile once landed; dial back per-surface if any surface causes visible frame drops.

**Checklist**
- [x] `index.html`: author `#glass-sidebar`, `#glass-bubble`, `#glass-cloud`, `#glass-cta` filters.
- [x] `index.css`: depth box-shadow added to sidebar / `.cbubble::before` / `.content-cloud::before` / `.cloud-button-shape`.
- [x] `index.css`: frost grain layer (shared, low opacity, tuned per surface).
- [x] `index.css`: `::after` refract overlay wired to each surface's existing mask, using its filter.
- [x] Verify in Chromium — **found a real bug**: `backdrop-filter: url(#svg)` on the `::after`
  overlay rendered as **flat opaque gray** instead of layering distortion over the transparent
  tinted glass, on real hardware Chrome (not just the headless test harness). Reproduced on
  sidebar/bubbles/CTA/content-cloud.
- [x] **Reverted** refraction/splay/dispersion entirely (deleted the `::after` overlays; sidebar's
  `.sidebar-refract` back on the original simple `#glassWarp`). Kept depth (box-shadow) + frost
  (noise grain) on `::before` — plain CSS, never implicated in the bug, confirmed good in every
  screenshot. Removed the unused `#glass-sidebar`/`#glass-cloud`/`#glass-cta`/`#glass-bubble`
  filter defs from `index.html`.
- [x] **Simplified for real**: rather than root-causing the custom multi-primitive filters, unified
  every surface onto the **sidebar's exact material** — same `--glass-bg` gradient (270deg teal,
  was a separate lighter cream gradient before), same `--glass-blur`, and the same proven simple
  `#glassWarp` filter (2 primitives: `feTurbulence` → `feDisplacementMap`, no channel-split/no
  edge-splay) reused as each surface's `::after` refract layer — no more per-surface custom
  filters. Removed `--glass-bg-solid` (content-cloud now uses the one shared `--glass-bg`).
  Verified clean (no gray) across main/about/santa-beer, including long-wait screenshots.
- [ ] Perf check: scroll through 2-3 sections with multiple bubbles + cloud on-screen, watch for jank.

---

## Revisions (post-review feedback)
- Axolotl was back-facing → front-facing yaw is now **−π/2** (octopus −π/2). Override via `?ay=&oy=`.
- Creatures use a **skinned** candy shader (`makeCreatureMat` with `skinning_*` chunks) so the GLB rigs animate while keeping correct colour; `AnimationMixer` blends **idle ↔ swim** by on-screen speed (axolotl `axolotl_idle`/`axolotl_swim`, octopus `Idle`/`Attack`).
- Conversation bubbles use `conversation bubble.svg` as a mask (organic blob), brighter glass + rim for legibility.
- Content cloud now matches the sidebar frosted material (more opaque); all bubble/cloud text is `#535353`.
- Conversation bubbles reveal **one-by-one paced by scroll progress** (`progressRef`), not all at once.
- Fish school pulled closer/bigger (`cz −8.5…−0.4`, `s 1.3…2.5`), still capped behind the focal plane.
- Headings use Darker Grotesque **800** (loader/section) / **700** (cloud); added 800/900 to the font request.

## Revisions — round 2 (UI/material pass)
- All bubbles, content clouds, and CTA buttons now share the **exact sidebar glass
  material** (`--glass-bg` + `--glass-blur`), transparent backdrop, solid `#535353`
  text with a white legibility halo (`--text-halo`); moved to the **UI layer** (z 8).
- CTA buttons use the `conversation bubble.svg` blob shape with wide padding.
- Increased bubble padding + cloud inset so masks never clip text.
- Animals re-staged more centred/symmetric; santa-beer & flaneur clouds **centred**
  with the two animals flanking them; about & cassette clouds pulled on-screen/centre.
- Titles + section/cloud headings → Darker Grotesque **300 (lightest)**.
- Added **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** (typography + colour + glass tokens).
- Note: the sidebar material is genuinely transparent, so over the (now closer) fish
  the glass reads very airy; the text halo keeps copy legible. Dial `--glass-bg`
  alpha up if you want the panels more solid.

## E. How to feed in your content (after framework)
- **Dialogue / copy:** edit `src/content/sections.js` (each section's `chat[]`, `content.heading/body/button`). Width is fixed, height auto — just write text.
- **Models:** drop GLBs in `public/models/` (current: `axolotl.glb`, `octopus.glb`, fish `red.glb` + `white fish.glb`). Creature front-facing yaws live in `createAquarium.js` (axolotl π/4, octopus 3π/4) — re-tune via `?ay=&oy=` if you swap models.
- **Positions / camera:** `src/scene/choreography.js` — per-section creature screen anchors + `cameraZ`. Content-cloud placement is per-section CSS in `src/index.css`.
- **Button links:** add `href` to any `button` in `sections.js`.

---

## D. Open questions
- (none blocking — see assumptions A1–A7; will refine as content arrives)
