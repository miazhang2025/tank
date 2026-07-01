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
 *   cameraZ  : camera world-z for this section. Lowering it across sections
 *     pushes the camera deeper into the tank (the z-axis travel between
 *     sections); animals ride along, background fish/caustics parallax past.
 *
 *   focusDist: view-space distance of the animals + the mouse-bubble plane.
 *     Fish are confined BEHIND this; DOF keeps everything past it blurred.
 */

export const FOCUS_DIST = 6.0; // shared focal-plane depth (animals + mouse bubbles)

export const STAGE = {
  // sx 0..1 across the screen. Kept more centered (in from the edges); santa-beer
  // and flaneur flank a centred content cloud symmetrically.
  'main':          { axolotl: { sx: 0.36, sy: 0.80 }, octopus: { sx: 0.64, sy: 0.82 }, cameraZ: 9.4 },
  'about':         { axolotl: { sx: 0.40, sy: 0.83 }, octopus: { sx: 0.62, sy: 0.83 }, cameraZ: 9.0 },
  'cassette-jury': { axolotl: { sx: 0.26, sy: 0.83 }, octopus: { sx: 0.38, sy: 0.85 }, cameraZ: 8.6 },
  'santa-beer':    { axolotl: { sx: 0.16, sy: 0.82 }, octopus: { sx: 0.84, sy: 0.82 }, cameraZ: 8.2 },
  'flaneur':       { axolotl: { sx: 0.16, sy: 0.80 }, octopus: { sx: 0.84, sy: 0.82 }, cameraZ: 7.8 },
  'more':          { axolotl: { sx: 0.36, sy: 0.83 }, octopus: { sx: 0.64, sy: 0.83 }, cameraZ: 7.4 },
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
  'main':          { axolotl: { sx: 0.30, sy: 0.78 }, octopus: { sx: 0.66, sy: 0.84 }, cameraZ: 9.4 },
  'about':         { axolotl: { sx: 0.28, sy: 0.80 }, octopus: { sx: 0.69, sy: 0.85 }, cameraZ: 9.0 },
  'cassette-jury': { axolotl: { sx: 0.26, sy: 0.83 }, octopus: { sx: 0.71, sy: 0.86 }, cameraZ: 8.6 },
  'santa-beer':    { axolotl: { sx: 0.24, sy: 0.80 }, octopus: { sx: 0.72, sy: 0.85 }, cameraZ: 8.2 },
  'flaneur':       { axolotl: { sx: 0.26, sy: 0.78 }, octopus: { sx: 0.71, sy: 0.84 }, cameraZ: 7.8 },
  'more':          { axolotl: { sx: 0.30, sy: 0.83 }, octopus: { sx: 0.69, sy: 0.85 }, cameraZ: 7.4 },
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
