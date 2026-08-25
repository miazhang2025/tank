/**
 * CRÈCHE — per-section stage choreography (TUNABLE).
 * ------------------------------------------------------------------
 * Keyed by section id (see src/content/sections.js). One entry per section.
 * v2 is FOUR sections: main → about → work → more.
 *
 *   axolotl / octopus : target screen anchor, normalised.
 *       sx 0 = left edge … 1 = right edge
 *       sy 0 = top edge  … 1 = bottom edge
 *     The animals are placed CAMERA-RELATIVE at `focusDist` in front of the
 *     camera and re-projected to this screen point every frame — so they keep
 *     their on-screen spot (and stay on the focal plane = always sharp) no
 *     matter how the camera moves on z.
 *
 *   cameraZ  : camera world-z for this section. Lowering it pushes the camera
 *     deeper into the tank. Held constant from `about` onward — camY carries
 *     the movement instead.
 *
 *   camY : world-y offset (default 0) for the camera position. Going negative
 *     sinks the rig straight down — no sideways turning at all. The look-at
 *     target mostly follows, so the tilt stays modest at any depth.
 *     v2 sinks MONOTONICALLY: 0 → 0 → −3.5 → −9. The descent never reverses;
 *     `more` gets brighter while still going down (see deepGlow).
 *
 *   focusDist: view-space distance of the animals + the mouse-bubble plane.
 *     Fish are confined BEHIND this; DOF keeps everything past it blurred.
 *
 *   envColor: environment tint (default: the base teal fog colour baked into
 *     createAquarium, #0E3A3C). Recoloring the fog/background retints
 *     everything depth-fades into (floor, back wall, water surface, fish,
 *     creatures) since they all mix toward this colour.
 *
 *   stageLight: 0..1, default 0. At 1 the scene reads as a lit stage: the
 *     overall lighting dims and the hero creatures pick up an overhead key
 *     light (plus a soft spotlight beam) instead of the usual window-left
 *     lighting.
 *
 *   camFollow: 0..1, default 0.72 — how much the look-at target follows camY.
 *     Sinking the camera below a FIXED target is what tilts the view upward as
 *     a section gets deeper; raising this flattens that tilt back out. `more`
 *     runs it near 1 so the view looks straight ahead at the pale bed instead
 *     of up past it (a steep tilt showed the bed only in the frame's corners).
 *
 *   deepGlow: 0..1, default 0. Fades in the pale light pool that sits BELOW
 *     the stage depth. This is how `more` gets bright while the camera keeps
 *     sinking: the shallow-water shell (water surface at y=6.2, floor at
 *     y=−5.2) is far above and stays hidden at these depths, so brightness
 *     can't come from restoring it — it comes from a new light source further
 *     down, which the camera descends INTO. See REDESIGN_PLAN.md §2b.
 *
 *   bigTitle: optional { text, sx, sy, h, maxW } — a wordmark-scale name
 *     rendered INSIDE the scene, behind the creatures, so they swim in front of
 *     the letters (DOM can never paint under WebGL). `h` is the glyph height as
 *     a fraction of the viewport; `maxW` caps its width the same way.
 *
 *   social: `more` only — where the social-link orb cluster sits on screen.
 *     { sx, sy } is the cluster's centre, `spread` how far the outliers sit
 *     from it (in screen fractions), `depth` how far they stagger back in
 *     world-z, `scale` their size relative to a project orb.
 *
 *   lineup: `work` only — where the project-orb arc sits on screen.
 *     { sx, sy } is the ACTIVE orb's anchor (it lands on the focal plane, so
 *     it's the sharp one); `spread` is the on-screen distance between
 *     neighbours along the arc, `bend` how far the arc bows outward, `depth`
 *     how far each step recedes in world-z (that recession is what lets the
 *     existing DOF soften the non-active orbs).
 */

export const FOCUS_DIST = 6.0; // shared focal-plane depth (animals + mouse bubbles)

// Darker shade of the brand teal (--c-teal #6FAFAD / scene fog #0E3A3C — see
// DESIGN_SYSTEM.md) — the "lit stage" environment tint for `work`.
const STAGE_ENV = 0x0a2224;
// Brand cream (--c-cream #FDF5E7 — see DESIGN_SYSTEM.md). `more` fades to this
// as it descends: warm light at the bottom instead of the tank's cold teal.
const BRIGHT_ENV = 0xfdf5e7;

export const STAGE = {
  // sx 0..1 across the screen.
  'main':   {
    axolotl: { sx: 0.36, sy: 0.80 }, octopus: { sx: 0.64, sy: 0.82 }, cameraZ: 9.4, camY: 0,
    bigTitle: { text: 'Creche Tank', sx: 0.5, sy: 0.7, h: 0.26, maxW: 0.86 },
  },
  // about splits the frame: copy on the left, the pair (and their chat) pushed
  // over to the right half — see .about-block in index.css
  'about':  { axolotl: { sx: 0.63, sy: 0.80 }, octopus: { sx: 0.83, sy: 0.80 }, cameraZ: 9.0, camY: 0 },
  // work: both creatures crowd the lower LEFT (the old cassette-jury framing),
  // leaving the right two thirds to the project lineup — and to the case-study
  // panel that opens over it. camX/camTargetX/cameraZ never move from here on,
  // so there's no turning, just a deeper and deeper vertical drop.
  'work':   {
    // far enough left that the octopus's chat bubbles (236px wide, centred on
    // it) still clear the case-study panel's edge at 33.4vw when it opens
    axolotl: { sx: 0.22, sy: 0.83 }, octopus: { sx: 0.345, sy: 0.85 },
    cameraZ: 9.0, camY: -3.5, envColor: STAGE_ENV, stageLight: 1,
    lineup: { sx: 0.70, sy: 0.46, spread: 0.175, bend: 0.022, depth: 1.5 },
  },
  // more: keeps descending (camY −9) but the environment turns pale and the
  // light pool below fades in — bright at the bottom, not on the way back up.
  'more':   {
    axolotl: { sx: 0.16, sy: 0.74 }, octopus: { sx: 0.30, sy: 0.77 },
    cameraZ: 9.0, camY: -9.0, envColor: BRIGHT_ENV, stageLight: 0, deepGlow: 1, camFollow: 0.96,
    social: { sx: 0.68, sy: 0.48, spread: 0.14, depth: 1.1, scale: 0.72 },
  },
};

/**
 * Mobile variant of STAGE. Portrait aspect makes the world-space gap between
 * two screen fractions much narrower than on desktop (screenToWorld scales
 * horizontal spread by camera.aspect) — same sx deltas that read fine on
 * desktop put the two creatures nose-to-nose on a phone. Pushed further
 * apart here (and nudged in sy) so they keep clear water between them.
 */
export const STAGE_MOBILE = {
  'main':   {
    axolotl: { sx: 0.30, sy: 0.78 }, octopus: { sx: 0.66, sy: 0.84 }, cameraZ: 9.4, camY: 0,
    // portrait can't hold "Creche Tank" on one line at any readable size, so it
    // sits smaller and higher, above the pair rather than behind them
    bigTitle: { text: 'Creche Tank', sx: 0.5, sy: 0.56, h: 0.09, maxW: 0.9 },
  },
  // portrait keeps the copy above and the pair below (no left/right split)
  'about':  { axolotl: { sx: 0.28, sy: 0.81 }, octopus: { sx: 0.69, sy: 0.85 }, cameraZ: 9.0, camY: 0 },
  // portrait has no room for a left-third / right-two-thirds split: the
  // creatures drop to the bottom edge and the lineup runs up the middle above
  // them, so the orbs never land on top of the animals.
  'work':   {
    axolotl: { sx: 0.24, sy: 0.88 }, octopus: { sx: 0.70, sy: 0.90 },
    cameraZ: 9.0, camY: -3.5, envColor: STAGE_ENV, stageLight: 1,
    // left of centre: the rail owns the right edge, and each orb's label sits
    // under it, so the arc has to leave that column free
    lineup: { sx: 0.40, sy: 0.22, spread: 0.20, bend: 0.018, depth: 1.5, scale: 0.5 },
  },
  'more':   {
    axolotl: { sx: 0.26, sy: 0.84 }, octopus: { sx: 0.68, sy: 0.88 },
    cameraZ: 9.0, camY: -9.0, envColor: BRIGHT_ENV, stageLight: 0, deepGlow: 1, camFollow: 0.96,
    // Portrait: the cluster sits above the creatures rather than beside them —
    // and high enough that its lowest orbs clear the chat bubbles, which run
    // across the bottom third here instead of down one side.
    social: { sx: 0.50, sy: 0.34, spread: 0.16, depth: 1.1, scale: 0.62 },
  },
};

/** Section ids in scroll order (mirrors SECTIONS order; used by the scroll rig). */
export const STAGE_ORDER = ['main', 'about', 'work', 'more'];
