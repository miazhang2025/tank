# Awwwards submission — Crèche Tank

Everything needed to fill in the submission form, plus the things worth fixing
before you do. Copy blocks are written to paste straight in.

> **Verify the form itself.** Awwwards changes field names, character limits and
> image dimensions from time to time. The copy below is written at a few lengths
> so you can pick whichever fits; check the live form for exact limits rather
> than trusting the ones here.

---

## 1. Copy bank

**Site title**
```
Crèche Tank
```

**URL** — confirm this is the live domain before submitting; it is also the
`SITE` constant in `vite.config.js` and was inferred from the contact email.
```
https://crechetank.com
```

**One line (~90 chars)**
```
An aquarium you scroll down through, with the studio's work suspended in it.
```

**Short description (~200 chars)**
```
An aquarium you scroll down through. An axolotl and an octopus argue in the
water while the camera sinks past the studio's work. Knock on the glass and
something in there answers.
```

**Longer description (~500 chars)**
```
Crèche Tank is a creative tech/media studio. Its site is the tank itself: one
WebGL scene you descend through rather than a page you scroll. Two characters
live in it — an axolotl and an octopus — holding a looping, deadpan conversation
in chat bubbles pinned above their heads as they swim.

The tank is not a backdrop. Knock on the glass and a shockwave crosses the
water, the fish scatter and both creatures turn to look at you. Poke either one
and it reacts — then answers you in the next bubble of its own conversation.
Sections are dives: the camera sinks, the light changes, and the studio's work
surfaces as a lineup of objects you steer through.
```

**Tags / keywords**
```
WebGL, Three.js, 3D, interactive, animation, portfolio, studio, GSAP, scroll,
experimental, characters, underwater
```

---

## 2. Technologies

From `package.json` — the real versions, not approximations.

| Tech | Version | Role |
|---|---|---|
| Three.js | 0.185 | the tank: scene, custom shaders, post stack |
| React | 19.2 | DOM/UI layer over the canvas |
| Vite | 8.1 | build |
| GSAP | 3.15 | all motion — ScrollTrigger + Observer |
| Lenis | 1.3 | smooth scroll |
| Vercel Analytics | 2.0 | analytics |

If the form wants a flat list:
```
Three.js, WebGL, GLSL, React, Vite, GSAP, ScrollTrigger, Lenis
```

---

## 3. Colours

Live values from `:root` in `src/index.css`.

| Hex | Name | Use |
|---|---|---|
| `#0E3A3C` | tank teal | scene fog / background — the dominant colour |
| `#D94E3B` | brand red | titles, octopus, CTA hover |
| `#F186AF` | brand pink | axolotl |
| `#FDF5E7` | cream | warm light, the pale floor of the last section |
| `#A7D8E5` | blue | cool accents |
| `#6FAFAD` | teal | water mid-tone |
| `#303030` | ink | all dialogue and body text |

If the form takes a limited palette, submit: `#0E3A3C` · `#D94E3B` · `#F186AF` ·
`#FDF5E7` · `#6FAFAD`.

---

## 4. Fonts

⚠️ **Do not copy the font list out of `DESIGN_SYSTEM.md` — it is stale.** It still
names *Darker Grotesque* as the display face; the site has since moved to
*Quedami*, and `index.html` only requests IBM Plex Mono and Crimson Text from
Google. These are the actual four:

| Family | Source | Role |
|---|---|---|
| **Quedami** | local OTF | all headings, section titles, the in-scene 3D title |
| **Glasset Demo** | local TTF | the CRÈCHE wordmark (top-left lockup + loader) |
| **IBM Plex Mono** | Google | dialogue, buttons, UI, captions |
| **Crimson Text** | Google | long-form body copy |

---

## 5. Credits

`creche-projects.json` credits Cassette Jury to "Mia & Ingrid" and For Here or To
Go to "Crèche Tank" — decide whether the site itself is credited to the studio or
to named people, and make sure anyone named has an Awwwards profile to be tagged
against.

```
Crèche Tank — design, development, 3D, direction
```

---

## 6. What to point the jury at

Awwwards juries are commonly described as scoring on **design, usability,
creativity and content**, weighted roughly in that order. Verify the current
weighting on their site. Mapped to what this build actually does:

**Creativity — the strongest card.** The navigation metaphor is literal: sections
are *depths*, and moving between them is a camera dive with the light and water
colour changing as you sink. The last section is bright not because you came back
up but because there is a pale light pool further down that you descend *into*.

**Design.** One glass material, derived once and reused by every floating surface;
9-sliced SVG bubble art so a chat bubble keeps its hand-drawn end-caps at any
height; a single-weight display face used at display sizes only.

**Interaction detail — worth calling out explicitly, it is easy to miss.**
- Knock on the glass: a refracting shockwave ring in the final composite pass.
  Rings are irregular, not circles, and two live rings deform each other.
- The fish scatter from the strike point and glide back onto their paths.
- Both creatures turn to look at where you knocked.
- Poke either creature: the octopus swings with its rigged clip, the axolotl
  takes a procedural knockback — and then answers you in the *next bubble of the
  running conversation*, not in a separate popup.
- Cursor gaze: the creatures' heads track your pointer while you're on the home
  section.
- Easter egg: five knocks in quick succession and the tank takes you to the
  contact section. ("Knock on the glass" is the studio's contact line.)

**Technical, if there's a field for it.**
- Two-pass post stack: scene → depth-of-field driven by the real depth texture →
  crisp overlay composite → glass pass (barrel distortion, chromatic aberration,
  ACES tonemap, vignette).
- The hero creatures are placed camera-relative *on* the focal plane every frame,
  so they are always sharp while everything else falls out of focus; background
  fish are depth-clamped per frame so they can never cross in front.
- The big in-scene title is a canvas texture composited after DOF, with occlusion
  done by hand against the depth texture — DOM can never paint under WebGL, so
  the creatures swim in front of the letters.
- A separate reduced pipeline on phones (halved pixel ratio, fewer particles, no
  backdrop-filters) because the full stack was pushing mobile GPUs into WebGL
  context loss.
- `prefers-reduced-motion` honoured throughout.

**Content.** Every project is a full case study — concept, design, technical —
loaded from a single JSON file.

---

## 7. Before you submit

Ordered by how much it can cost you. The first one is not optional.

- [ ] **`public/preview/santa-beer.gif` is 78 MB.** It loads when that case study
      opens, which is exactly what a juror will do. On anything but a fast
      connection the panel sits empty and reads as broken. Re-encode as MP4/WebM
      (a loop like this should be 1–3 MB) or cut it hard. The other two previews
      are 4.5 MB and 4.1 MB and are also worth compressing.
- [ ] **No share image.** `public/og.png` doesn't exist, so the OG/Twitter tags are
      deliberately not emitted and any share of the URL renders bare. Drop a
      1200×630 PNG at that path and it wires itself up on the next build.
- [ ] **Confirm the domain.** `SITE` in `vite.config.js` is `https://crechetank.com`,
      inferred from the contact email. It drives canonical, OG, sitemap and
      JSON-LD; a wrong canonical is worse than none.
- [ ] **The interaction sounds are silent.** `public/sounds/` has only its README,
      so knock and poke play nothing. Either add `knock.mp3` / `poke.mp3` or
      accept it — the code no-ops cleanly either way. Worth having for a jury.
- [ ] **First load is heavy.** 15.3 MB of GLB and a ~1 MB JS bundle (300 kB
      gzipped) before the Enter button appears. The loader covers it honestly,
      but a juror on a slow connection is still waiting. Draco/meshopt
      compression on the GLBs is the biggest lever if you have time.
- [ ] **Test on a real phone**, not just a narrow window. The mobile pipeline
      exists specifically because this scene can crash mobile GPUs — verify on
      actual hardware before a jury does it for you.
- [ ] `flaneur` and `ep0ch-art` have no `year` in the project JSON.
- [ ] `DESIGN_SYSTEM.md` §1 is out of date (fonts) — fix it or ignore it, but
      don't submit from it.

---

## 8. Known trade-offs, if anyone asks

- **`user-scalable=no`** is set deliberately. Pinch-zoom over a fixed full-viewport
  canvas with custom gesture handling breaks the scroll model. It is a genuine
  accessibility trade-off, made knowingly.
- **One URL, no per-project routes.** Case studies open in a panel rather than at
  their own address, so individual projects can't be linked or indexed
  separately. Fine for a jury, a real limit for SEO.
