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

## Revisions — round 3 (section prop models)
- Cassette Jury / Santa Beer / Flâneur no longer show their content cloud on arrival:
  each section's **3D prop model** (`public/models/<section-id>.glb`) drops in from
  above the frame instead — accelerating fall with a bubble wake, splash burst, and a
  damped settle bob — landing where the cloud used to sit (`prop:` anchors in
  `choreography.js`, desktop + mobile variants, all three at `yaw: -π/2`).
- The prop is interactive: hover = pointer cursor + slight grow + tilt toward the
  cursor; **clicking it opens the content cloud** (all existing cloud hover features
  intact — GIF preview trail, magnetic CTA). Clicking/tapping anywhere outside the
  cloud closes it, and every re-entry into the section starts closed.
- Plumbing: `createAquarium.js` loads/animates the props (`updateProps`) and exposes
  `propClickHandlers`; `Stage.jsx` bridges the breakpoint-aware `prop` anchor into
  `controls.propAnchor`; `Section.jsx` owns the `cloudOpen` state; `ContentCloud`
  gained an `interactive` flag so the closed cloud never eats the model's events.
- Verified with Playwright on desktop (1440×900) + mobile (375×812): open/close,
  re-entry reset, per-section drop replay, no console errors.

### Phase 8 — home-section interactivity (main only, gated by `mainAmt`)
All effects are gated by a scene-side eased factor `mainAmt` (0..1, follows
`activeSection === 'main' && !diveActive && intro settled`, same easing pattern as
`bigTitle.fade`) so they fade out smoothly on the main→about cross-fade and can
never fire in later sections. Idle cost of every new effect is zero; no new render
passes / targets / per-frame raycasts.

- [x] 8.0 `mainAmt` factor + click routing in `createAquarium.js`
      (priority: nearest creature poke → knock glass; `.ui-surface` guard + orb handlers
      untouched). Also gated on `introY < 0.05` so the loader's Enter click can't knock.
- [x] 8.1 **Gaze follow** — creatures subtly turn head (yaw + slight pitch) toward the
      cursor; reuses the per-frame `yawToFace` + `inner.rotation`; `hasPointer` guard
      skips it on touch. Knock triggers a stronger 1.2s "glance" pulse (works on tap too).
- [~] 8.2 **Big-title water ripple** — built, then **cut** (design call): the rect-masked
      cursor ripple stays exclusive to the case-study panel, as it was.
- [x] 8.3 **Knock on the glass** — click empty water: expanding ring shockwave in the
      glass composite shader (3 round-robin slots, `uKnockOn` early-out when idle), fish
      within radius scatter (per-fish decaying flee offset on their Lissajous paths), both
      creatures glance at the point, thunk SFX. Tuned: 1.5s life, linear falloff,
      refraction 0.014 / crest 0.55.
- [x] 8.3b **"Let me in" easter egg** — five knocks in QUICK succession (each within 1.2s
      of the one before, or the count starts over) dives straight to `more`, where "Knock
      on the glass" is the actual way to get in touch. A run, never a running total: idly
      clicking around the tank can't fill up a tally. Undocumented on purpose — finding it
      is the point.
- [x] 8.4 **Poke the creatures** — screen-space hit test against the live anchors
      (orb-style, no raycast; radius = 0.38 of the model unit, NEAREST disc wins so the
      portrait overlap resolves correctly). Axolotl: existing procedural knockback/wobble
      (`st.hit`). Octopus: one-shot rigged Attack clip (procedural `hit` fallback when the
      clip is busy); never fights the cassette-jury `attackFX` state machine.
- [x] 8.5 **Reaction line — folded INTO the conversation.** A poke makes the next bubble
      to pop the poked creature's reaction, in its normal place in the stack, instead of a
      separate floating bubble (the earlier `PokeReaction.jsx` is deleted). Each column
      carries two extra reaction slots (`data-reaction`, `data-gi` 900/901) — a real
      bubble for that column's speaker, an invisible twin for the other — so a reaction
      lands in the shared two-column timeline exactly like a scripted turn. Reveal/retire
      is the shared `enterAtBottom` helper; a pending poke shortens the next beat to
      ≤0.4s so the answer feels immediate; the first-fill test moved from `shown` to `seq`
      so an injected line can't cut the scripted conversation short; a reaction retires
      for good when it reaches the top rather than rejoining the loop. Lines in
      `POKE_LINES` (sections.js), no immediate repeats, kept distinct from main's script.
- [x] 8.6 **Dive hint indicator** (`DiveHint.jsx`) — bottom-centre mono caption cycling
      "scroll to dive / knock on the glass / poke a creature" (touch: swipe/tap wording)
      over a sinking chevron; appears once the intro settles, only on main, dismissed for
      the session once the visitor first leaves main. Click = dive to the next section;
      carries `ui-surface` so that click isn't also read as a knock. Portrait makes it
      `pointer-events: none` — it sits over the octopus there and was eating its taps.
      `prefers-reduced-motion` = static.
- [x] 8.7 **SFX plumbing** (`src/scene/sfx.js`) — lazy WebAudio helper; plays
      `public/sounds/knock.(mp3|wav)` and `poke.(mp3|wav)` if present, silently no-ops if
      missing. Both are primed on the loader's Enter click (a real gesture, so the
      AudioContext starts unsuspended and the first knock is already audible).
      **→ drop your sound files into `public/sounds/` (see its README).**
- [x] 8.V Verified with Playwright, desktop 1440×900 + portrait 390×844: gaze, title
      knock (ring geometry confirmed by a frozen-amplitude capture), both pokes + their
      reaction lines landing in the conversation stacks, the conversation continuing past
      them, the five-knock dive to `more` firing on the 5th and NOT firing for four quick
      knocks or for knocks spaced past the run window, hint copy/dismissal,
      nothing firing in about/work/more,
      work + more sections unchanged, no console errors.

---

## Revisions — round 4 (polish pass)
- **Loader readout reaches 100%.** The water still holds at `BRIM` (0.97) so its wavy
  surface stays on screen — at a true 1.0 the crests are pushed past the top edge and the
  tank reads as a flat block — but the readout is now scaled against `BRIM`, so `ready`
  (which genuinely means loaded) shows "ready 100%" instead of parking on a puzzling 97%.
- **Loader wordmark de-glowed.** `.loader-word` gets `text-shadow: none`; at 150px the
  glow `.loader-brand` sets for the small text read as a smudge around the letters. The
  status line and Enter button keep theirs.
- **About copy surfaces through the water.** The plain-copy block now enters blurred and
  low, pulling into focus over ~1.15s, instead of sliding down like a section heading —
  it settles onto the focal plane the way everything else in the tank does. The filter is
  cleared on completion so a parked section isn't holding a compositor layer.
- **`more` links completed** — Are.na and RED (小红书) filled in; all five social orbs live.

## Revisions — round 5
- **Loader's Enter button matches the case-study CTA.** Same hover language as `.panel-cta`
  (fills with `--c-red`, label flips to `--c-cream`) and the same magnetic cursor-follow
  (`gsap.quickTo`, STRENGTH 0.4, scale 1.06, elastic spring back) the CTA and content-cloud
  button already use. It keeps its pale outline at rest — the loader sits on light water,
  where the CTA's dark-ink resting state would disappear. GSAP now owns the element's
  transform outright, so the CSS `transform` transition and the `loader-enter-in` keyframe
  were removed (either would have fought a 0.25s ease into every mousemove) and the
  entrance is a tween instead.
- **About copy resolves character by character, in random order.** `splitChars` wraps each
  character in a `.about-ch` span (spaces stay plain text, so wrapping is unchanged — an
  inline span introduces no break opportunity), and the entrance staggers their opacity
  with `from: 'random'`. `amount: 0.9` rather than `each:` so editing the copy can't
  silently stretch the entrance to several seconds. The block still carries the rise +
  focus-pull; only opacity animates per character, so nothing reflows.
- **Focus pull retimed so it's actually visible.** The blur was being spent before there
  was any text to blur: an out-ease drops most of its distance in the first fifth of the
  tween, so at 12px/0.85s/`power3.out` the copy was sharp before the characters had
  finished arriving. Now 18px over 1.3s on `power2.inOut`, which holds it soft through the
  middle and lands after the reveal — measured at 10px blur with 106/106 characters
  already on screen, where the old curve was at 0. `y` is a separate tween (1s,
  `power3.out`) so the position still settles early.

## Revisions — round 6 (SEO / GEO)

The site is one client-rendered WebGL page whose copy is fetched at runtime, so a
crawler that doesn't execute JS saw an empty `<div id="root">` and nothing else.
Everything below is **generated from the real data** by the `creche-seo` plugin in
`vite.config.js` (it imports `sections.js` / `social.js` and reads
`creche-projects.json`), so adding a project updates the metadata with it.

- **`<head>`** — description (from the about copy), canonical, robots, theme-color,
  Open Graph + Twitter card. `og:image` is emitted **only if `public/og.png` exists**,
  so the card never points at a 404; drop a 1200×630 in and it lights up.
- **JSON-LD** — `Organization` + `WebSite` + an `ItemList` of every project
  (`CreativeWork`, plus a `VideoObject` for the films). This is the main GEO lever:
  machine-readable fact that needs no JavaScript. `uploadDate` is omitted rather than
  invented — the data carries a year, not a date.
- **`<noscript>` fallback** — the studio blurb and every project's title/year/tagline/
  summary/link as real prose (~2.6 kB). Not cloaking: same content as the rendered
  site, and inert for anyone with JS (measured 0px tall).
- **`public/robots.txt`** — allow-all, with the answer-engine crawlers (OAI-SearchBot,
  PerplexityBot, ClaudeBot, …) called out explicitly since being cited by them is the
  point of GEO. Training-only crawlers are grouped separately and commented, so
  refusing them later is a one-word edit.
- **`sitemap.xml` + `llms.txt`** — emitted at build. `lastmod` tracks the project
  file's own `updated` field.

**Known gaps, deliberately not fixed here**
- `SITE` in `vite.config.js` is inferred from the contact email. **Verify before the
  first deploy** — a wrong canonical is worse than none.
- `flaneur` and `ep0ch-art` have no `year`, so they ship without `datePublished`.
- One URL, no per-project routes, no prerender. Per-project URLs + a prerender pass
  is the biggest remaining SEO win and is an architecture change, not a metadata one.

## E. How to feed in your content (after framework)
- **Dialogue / copy:** edit `src/content/sections.js` (each section's `chat[]`, `content.heading/body/button`). Width is fixed, height auto — just write text.
- **Models:** drop GLBs in `public/models/` (current: `axolotl.glb`, `octopus.glb`, fish `red.glb` + `white fish.glb`). Creature front-facing yaws live in `createAquarium.js` (axolotl π/4, octopus 3π/4) — re-tune via `?ay=&oy=` if you swap models.
- **Positions / camera:** `src/scene/choreography.js` — per-section creature screen anchors + `cameraZ`. Content-cloud placement is per-section CSS in `src/index.css`.
- **Button links:** add `href` to any `button` in `sections.js`.

---

## D. Open questions
- (none blocking — see assumptions A1–A7; will refine as content arrives)
