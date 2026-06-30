# AQUARIA · tank study — Design System

The shared visual language for the site. Tokens live in `:root` in
[`src/index.css`](src/index.css); this file documents intent and usage.

---

## 1. Typography

Three families, each with one job. Never mix roles.

| Role | Family | CSS var | Where |
|------|--------|---------|-------|
| **Headings / section names** | **Darker Grotesque** | `--display` | Section titles, content-cloud headings, loader wordmark |
| **Dialogue / UI / buttons** | **IBM Plex Mono** | `--mono` | Conversation bubbles, CTA buttons, sidebar menu, wordmark, footer |
| **Long-form body** | **Crimson Text** | `--serif` | Content-cloud body paragraphs |

```css
--display: "Darker Grotesque", "Helvetica Neue", Arial, sans-serif;
--mono:    "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
--serif:   "Crimson Text", Georgia, "Times New Roman", serif;
```

### Weights
- **Darker Grotesque — 300 (lightest).** All titles & section names render at 300;
  it reads as an airy, wide display face. (300–900 are loaded for flexibility.)
- **IBM Plex Mono — 400 / 500.** 400 for dialogue & body UI, 500 where slightly stronger.
- **Crimson Text — 400, 400 italic, 600.** 400 for body copy.

### Scale (fluid, `clamp(min, vw, max)`)
| Token | min → max |
|-------|-----------|
| Section title | 52 → 124 px |
| Cloud heading | 30 → 56 px |
| Loader wordmark | 56 → 150 px |
| Cloud body (Crimson) | 14 → 19 px |
| Conversation bubble (Mono) | 12 → 15 px |
| Sidebar menu (Mono) | 12 → 19 px |

Line-height: 0.9 for display titles, 1.5 for body & dialogue.

---

## 2. Color

Brand palette (from the project swatch). All defined as `:root` vars.

| Token | Hex | Use |
|-------|-----|-----|
| `--c-blue`  | `#A7D8E5` | cool light / accents |
| `--c-teal`  | `#6FAFAD` | water mid-tone |
| `--c-pink`  | `#F186AF` | axolotl (left speaker) tint |
| `--c-red`   | `#D94E3B` | octopus (right speaker) tint · **section titles** |
| `--c-cream` | `#FDF5E7` | warm light |
| `--c-ink`   | `#535353` | **all bubble / cloud / dialogue text** (100% opacity) |

Scene (WebGL) anchor colors, for reference: fog/background `#0E3A3C`, deep `#07262A`,
caustic-lit `#2E9A82`, warm window light `#FFE6C2`.

### Speaker mapping
- **Axolotl** → left side, faint **pink** tint over glass.
- **Octopus** → right side, faint **red** tint over glass.

---

## 3. Glass material (one material, everywhere)

The sidebar's frosted glass is the single surface treatment for **every** floating
element: conversation bubbles, content clouds, and CTA buttons. Transparent
backdrop, solid `--c-ink` text on top.

```css
--glass-bg: linear-gradient(160deg,
  rgba(46,82,92,0.42) 0%,
  rgba(66,116,130,0.22) 48%,
  rgba(160,215,228,0.06) 100%);
--glass-blur: blur(6px) saturate(112%) brightness(1.03);  /* backdrop-filter */
--glass-rim: rgba(255,255,255,0.5);                        /* white edge */
```

Recipe for a glass surface:
1. `background: var(--glass-bg)` (+ optional faint speaker tint layered on top).
2. `backdrop-filter: var(--glass-blur)`.
3. Silhouette via SVG `mask` — `conversation bubble.svg` for bubbles/CTAs,
   `content bubble.svg` / `content bubble-mobile.svg` for clouds.
4. Rim + depth via `filter: drop-shadow(0 0 .7px var(--glass-rim)) drop-shadow(0 5px 15px rgba(8,30,36,.2))`
   (box-shadow can't follow a mask, so the rim is a drop-shadow).
5. Generous padding so the narrowing mask never clips text.

All glass sits on the **UI layer** (z-index 8, the sidebar/menu band).

---

## 4. Motion
- Smooth scroll: Lenis; section **snap** via GSAP ScrollTrigger.
- Conversation bubbles reveal **one-by-one, paced by scroll progress**, with an
  elastic squish pop-in (`elastic.out(1, 0.6)`); reduced-motion → `power2.out`.
- Camera-z + creature anchors interpolate continuously with scroll.
- Creatures: rigged `idle ↔ swim` crossfade by on-screen speed.

---

## 5. Layer / z-index map
| z | layer |
|---|-------|
| 0 | WebGL tank (canvas) |
| 6–7 | sidebar panel / refraction |
| 8 | **stage** — bubbles, clouds, CTAs, wordmark |
| 9 | sidebar rim |
| 10 | footer caption |
| 11 | sidebar menu links |
| 12 | menu toggle button |
| 100 | loader overlay |
