/**
 * CRÈCHE — section content (EDIT ME)
 * ------------------------------------------------------------------
 * This is the single place to author dialogue + copy. The site is built from
 * this array, in order. Drop/replace text freely.
 *
 * v2 note: the site is FOUR sections — main / about / work / more. Individual
 * project copy is NOT here any more; it lives in `public/creche-projects.json`
 * and is loaded by `src/content/projects.js` (see REDESIGN_PLAN.md).
 *
 * Schema per section:
 *   id      : stable key, also the scroll anchor (#about, #work …). Don't rename casually.
 *   title   : big section heading (Darker Grotesque). null = no heading.
 *             `work` has none — the 3D in-scene title shows the SELECTED
 *             PROJECT's name there instead.
 *   chat    : conversation bubbles, in REVEAL order (index 0 reveals first).
 *             Each: { who: 'axolotl' | 'octopus', text: '…' }
 *             - axolotl → pink bubble, anchored on the LEFT
 *             - octopus → red bubble,  anchored on the RIGHT
 *             ('regulars' = a third voice with no bubble art — it just holds
 *             its beat in the timeline.)
 *             Newest bubble sits lowest (by the animal's head); the stack grows upward.
 *             Text is IBM Plex Mono. Width is fixed; height grows to fit.
 *   content : optional cloud "thought bubble" (frosted glass). null = none.
 *             { heading: string|null (Darker Grotesque),
 *               body:    string      (Crimson Text, long-form; blank line = paragraph break),
 *               button:  { label: string, href?: string } | null  (IBM Plex Mono) }
 */

export const SECTIONS = [
  {
    id: 'main',
    title: null,
    chat: [
{ who: 'octopus', text: 'No.' },
{ who: 'octopus', text: 'I had a thought. I let it go.' },
{ who: 'axolotl', text: "Everything I build floats away eventually. It's fine." },
{ who: 'octopus', text: 'Are we a brand or a feeling.' },
{ who: 'axolotl', text: 'Yes.' },
{ who: 'axolotl', text: 'Still soft.' },
{ who: 'octopus', text: 'Something moved.' },
{ who: 'axolotl', text: 'That was you.' },
{ who: 'octopus', text: 'Was it.' },
{ who: 'regulars', text: 'Yeah.' },
{ who: 'axolotl', text: 'Santa was on pills. We filmed it anyway.' },
{ who: 'octopus', text: 'Does it need to exist?' },
{ who: 'axolotl', text: "...it's too late now." },
{ who: 'octopus', text: 'Tape remembers more than we do.' },
{ who: 'axolotl', text: 'Mostly tape.' },
{ who: 'regulars', text: '...yeah.' },
{ who: 'octopus', text: 'Air. Apparently. Sounds exhausting.' },
{ who: 'axolotl', text: "I'm going to be tired of water one day." },
{ who: 'octopus', text: 'Not today.' },
{ who: 'axolotl', text: 'Not today.' },
{ who: 'octopus', text: 'Correct.' },
{ who: 'axolotl', text: 'Do you ever wonder if the tank has a bottom.' },
    ],
    content: null,
  },

  {
    id: 'about',
    title: 'About',
    chat: [
      { who: 'axolotl', text: 'So, what is Crèche?' },
      { who: 'octopus', text: 'A tank. Two of us live in it — the octopus and the axolotl.' },
      { who: 'axolotl', text: 'A creative tech/media studio. We make small weird things. The tank is real.' },
      { who: 'octopus', text: 'What do we make?' },
      { who: 'axolotl', text: 'Brands. Stories. The occasional creature you can poke in a browser.' }
    ],
    content: {
      // `plain` = no frosted cloud around it. The title and this copy render as
      // a left-aligned block in the left half of the frame, with the creatures
      // and their chat pushed over to the right half (see .about-block).
      plain: true,
      heading: null,
      body: 'Crèche is a creative tech/media studio. It makes small, weird things — interactive things, video things, story things.',
      button: null,
    },
  },

  {
    // The work section: every project at once, as a lineup of orbs on the
    // right. No `content` cloud — a selected project opens its own panel
    // (ProjectPanel) instead, fed from creche-projects.json.
    id: 'work',
    title: null,
    chat: [
      { who: 'axolotl', text: 'Whenever we cannot decide on a thing...' },
      { who: 'octopus', text: 'We fight.' },
    ],
    content: null,
  },

  {
    id: 'more',
    title: "What's More",
    chat: [
      { who: 'octopus', text: 'How to work with us?' },
      { who: 'axolotl', text: 'Knock on the glass.' },
    ],
    content: null,
  },
];

/**
 * One-off reactions when a visitor pokes a creature on the HOME section.
 * A line is picked at random per poke and revealed as the NEXT bubble in the
 * `main` conversation stack (see Section.jsx's revealReaction) — so it reads as
 * that creature breaking off mid-conversation to answer you, then drifting up
 * and out of the stack like any other line.
 *
 * Same voices as above: the axolotl soft and unbothered, the octopus flat and
 * put-upon. Keep these DISTINCT from `main`'s scripted lines — a reaction that
 * duplicates a line already on screen reads as a rendering glitch, not a reply.
 */
export const POKE_LINES = {
  axolotl: ['oh.', 'hi.', 'that tickles.', "don't.", 'mm.', 'I felt that.', 'careful.'],
  octopus: ['Excuse me.', 'Do not.', 'Noted.', 'I saw that.', 'Was that necessary.', 'Hm.', 'Again?'],
};

/** Brand wordmark shown top-left on every section. */
export const WORDMARK = 'CRECHE';

/** Sidebar menu — label + the section id it scrolls to. */
export const MENU = [
  { label: 'About', target: 'about' },
  { label: 'Work', target: 'work' },
  { label: 'More', target: 'more' },
];
