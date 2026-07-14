/**
 * AQUARIA — per-section stage choreography (TUNABLE).
 * ------------------------------------------------------------------
 * Keyed by section id (see src/content/sections.js). One entry per section.
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
 *     deeper into the tank. Held constant (same as 'about') from cassette-jury
 *     onward now — see camY below, which carries that job instead.
 *
 *   camY : world-y offset (default 0) for the camera position. Going negative
 *     sinks the rig straight down — no sideways turning at all. The look-at
 *     target stays fixed, so sinking the camera below it automatically tilts
 *     the view up a little as a side effect (deeper section = camera further
 *     below the target = steeper upward look), rather than needing a
 *     separate tilt control.
 *
 *   focusDist: view-space distance of the animals + the mouse-bubble plane.
 *     Fish are confined BEHIND this; DOF keeps everything past it blurred.
 *
 *   envColor: optional environment tint override (default: the base teal fog
 *     colour baked into createAquarium, #0E3A3C — see DESIGN_SYSTEM.md's
 *     brand palette). Recoloring the fog/background this way retints
 *     everything depth-fades into (floor, back wall, water surface, fish,
 *     creatures) since they all mix toward this colour. Stage sections use a
 *     darker shade of the same brand teal, not an unrelated hue.
 *
 *   stageLight: 0..1, default 0. At 1 the scene reads as a lit stage: the
 *     overall lighting dims and the hero creatures pick up an overhead key
 *     light (plus a soft spotlight beam) instead of the usual window-left
 *     lighting. Eases in with the rest of the push transition.
 *
 *   prop: optional { sx, sy, scale, yaw } — screen anchor for the section's
 *     3D prop model (public/models/<section-id>.glb). Sections with a prop
 *     show the model where the content cloud used to sit; the cloud itself
 *     only opens when the model is clicked (see Section.jsx). `scale`
 *     multiplies the base PROP_HEIGHT in createAquarium.js; `yaw` (radians,
 *     default 0) trims which way the model's "front" faces.
 */

export const FOCUS_DIST = 6.0; // shared focal-plane depth (animals + mouse bubbles)

// Darker shade of the brand teal (--c-teal #6FAFAD / scene fog #0E3A3C — see
// DESIGN_SYSTEM.md) used as the "lit stage" environment tint below, instead
// of the base fog colour.
const STAGE_ENV = 0x0a2224;

export const STAGE = {
  // sx 0..1 across the screen. Kept more centered (in from the edges); santa-beer
  // and flaneur flank a centred content cloud symmetrically.
  'main':          { axolotl: { sx: 0.36, sy: 0.80 }, octopus: { sx: 0.64, sy: 0.82 }, cameraZ: 9.4, camY: 0 },
  'about':         { axolotl: { sx: 0.40, sy: 0.83 }, octopus: { sx: 0.62, sy: 0.83 }, cameraZ: 9.0, camY: 0 },
  // camera sinks straight down (camY) into cassette-jury and each section
  // after — camX/camTargetX/cameraZ never move again, so there's no turning,
  // just a deeper and deeper vertical drop (with the incidental upward tilt
  // that comes from sinking below a fixed look-at target). Each of these
  // three crossings (about→CJ, CJ→SB, SB→flaneur) is the one Stage.jsx plays
  // as a fixed-duration cinematic dive rather than a plain scroll-scrubbed
  // lerp — its UI layer is also held hidden until the dive completes (see
  // Stage.jsx). These three sections also switch to the dimmer "lit stage"
  // look (see stageLight above); flaneur→more is a normal scroll-scrubbed
  // rise back to the surface, not part of the dive sequence.
  // prop anchors sit where each section's content cloud used to: cassette-jury's
  // cloud leaned right-of-centre (both creatures crowd the left), the other two
  // were dead-centre with the creatures flanking symmetrically.
  'cassette-jury': { axolotl: { sx: 0.26, sy: 0.83 }, octopus: { sx: 0.38, sy: 0.85 }, cameraZ: 9.0, camY: -2.2, envColor: STAGE_ENV, stageLight: 1, prop: { sx: 0.62, sy: 0.44, scale: 1, yaw: -Math.PI / 2 } },
  'santa-beer':    { axolotl: { sx: 0.16, sy: 0.82 }, octopus: { sx: 0.84, sy: 0.82 }, cameraZ: 9.0, camY: -4.5, envColor: STAGE_ENV, stageLight: 1, prop: { sx: 0.50, sy: 0.44, scale: 1, yaw: -Math.PI / 2 } },
  'flaneur':       { axolotl: { sx: 0.16, sy: 0.80 }, octopus: { sx: 0.84, sy: 0.82 }, cameraZ: 9.0, camY: -6.5, envColor: STAGE_ENV, stageLight: 1, prop: { sx: 0.50, sy: 0.44, scale: 1, yaw: -Math.PI / 2 } },
  'more':          { axolotl: { sx: 0.36, sy: 0.83 }, octopus: { sx: 0.64, sy: 0.83 }, cameraZ: 9.0, camY: 0 },
};

/**
 * Mobile variant of STAGE. Portrait aspect makes the world-space gap between
 * two screen fractions much narrower than on desktop (screenToWorld scales
 * horizontal spread by camera.aspect) — same sx deltas that read fine on
 * desktop put the two creatures nose-to-nose on a phone. Pushed further
 * apart here (and nudged in sy) so they keep clear water between them while
 * still moving section-to-section.
 */
export const STAGE_MOBILE = {
  'main':          { axolotl: { sx: 0.30, sy: 0.78 }, octopus: { sx: 0.66, sy: 0.84 }, cameraZ: 9.4, camY: 0 },
  'about':         { axolotl: { sx: 0.28, sy: 0.80 }, octopus: { sx: 0.69, sy: 0.85 }, cameraZ: 9.0, camY: 0 },
  'cassette-jury': { axolotl: { sx: 0.26, sy: 0.83 }, octopus: { sx: 0.71, sy: 0.86 }, cameraZ: 9.0, camY: -2.2, envColor: STAGE_ENV, stageLight: 1, prop: { sx: 0.50, sy: 0.40, scale: 0.8, yaw: -Math.PI / 2 } },
  'santa-beer':    { axolotl: { sx: 0.24, sy: 0.80 }, octopus: { sx: 0.72, sy: 0.85 }, cameraZ: 9.0, camY: -4.5, envColor: STAGE_ENV, stageLight: 1, prop: { sx: 0.50, sy: 0.40, scale: 0.8, yaw: -Math.PI / 2 } },
  // extra clearance vs. the other rows: the axolotl's flâneur dance swings its
  // arms outward, so the resting gap needs more room before the animation adds
  // its own reach — otherwise the two read as touching on a narrow screen.
  'flaneur':       { axolotl: { sx: 0.18, sy: 0.78 }, octopus: { sx: 0.76, sy: 0.84 }, cameraZ: 9.0, camY: -6.5, envColor: STAGE_ENV, stageLight: 1, prop: { sx: 0.50, sy: 0.40, scale: 0.8, yaw: -Math.PI / 2 } },
  'more':          { axolotl: { sx: 0.30, sy: 0.83 }, octopus: { sx: 0.69, sy: 0.85 }, cameraZ: 9.0, camY: 0 },
};

/** Section ids in scroll order (mirrors SECTIONS order; used by the scroll rig). */
export const STAGE_ORDER = [
  'main',
  'about',
  'cassette-jury',
  'santa-beer',
  'flaneur',
  'more',
];
