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
  'main':          { axolotl: { sx: 0.34, sy: 0.80 }, octopus: { sx: 0.66, sy: 0.82 }, cameraZ: 9.4 },
  'about':         { axolotl: { sx: 0.40, sy: 0.83 }, octopus: { sx: 0.66, sy: 0.83 }, cameraZ: 9.0 },
  'cassette-jury': { axolotl: { sx: 0.11, sy: 0.83 }, octopus: { sx: 0.21, sy: 0.85 }, cameraZ: 8.6 },
  'santa-beer':    { axolotl: { sx: 0.10, sy: 0.82 }, octopus: { sx: 0.90, sy: 0.82 }, cameraZ: 8.2 },
  'flaneur':       { axolotl: { sx: 0.12, sy: 0.80 }, octopus: { sx: 0.90, sy: 0.82 }, cameraZ: 7.8 },
  'more':          { axolotl: { sx: 0.30, sy: 0.83 }, octopus: { sx: 0.66, sy: 0.83 }, cameraZ: 7.4 },
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
