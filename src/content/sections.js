/**
 * AQUARIA — section content (EDIT ME)
 * ------------------------------------------------------------------
 * This is the single place to author dialogue + content. The site is
 * built from this array, in order. Drop/replace text freely.
 *
 * Schema per section:
 *   id      : stable key, also the scroll anchor (#about, #flaneur …). Don't rename casually.
 *   title   : big section heading (Darker Grotesque). null = no heading.
 *   chat    : conversation bubbles, in REVEAL order (index 0 reveals first).
 *             Each: { who: 'axolotl' | 'octopus', text: '…' }
 *             - axolotl → pink bubble, anchored on the LEFT
 *             - octopus → red bubble,  anchored on the RIGHT
 *             Newest bubble sits lowest (by the animal's head); the stack grows upward.
 *             Text is IBM Plex Mono. Width is fixed; height grows to fit.
 *   content : optional cloud "thought bubble" (frosted glass). null = none.
 *             { heading: string|null (Darker Grotesque),
 *               body:    string      (Crimson Text, long-form; blank line = paragraph break),
 *               button:  { label: string, href?: string } | null  (IBM Plex Mono) }
 *
 * Placeholder bubbles in the mockups (empty pills) = dialogue you haven't written yet:
 * just add more { who, text } entries here and they'll appear.
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
    ],
    content: null,
  },

  {
    id: 'about',
    title: 'About',
    chat: [
      { who: 'axolotl', text: 'So, what is AQUARIA?' },
      { who: 'octopus', text: 'A tank. Two of us live in it — the octopus and the axolotl.' },
      { who: 'axolotl', text: 'A creative studio. We make small weird things. The tank is real.' },
      { who: 'octopus', text: 'What do we make?' },
      { who: 'axolotl', text: 'Brands. Stories. The occasional creature you can poke in a browser.' },
      { who: 'octopus', text: 'How to work with us?' },
      { who: 'axolotl', text: 'Knock on the glass.' },
    ],
    content: {
      heading: null,
      body: 'AQUARIA is a new media studio. It makes small, weird things — interactive things, video things, story things.',
      button: null,
    },
  },

  {
    id: 'cassette-jury',
    title: 'Cassette Jury',
    chat: [
      { who: 'axolotl', text: 'Whenever we cannot decide on a thing...' },
      { who: 'axolotl', text: 'We fight.' },
    ],
    content: {
      heading: 'Cassette Jury',
      body:
        'Cassette Jury is a creative decision-support toy. It is a panel of 11 AI-simulated characters — each with their own job, taste, and agenda — who act as your on-demand jury when you hit a creative deadlock. Submit an open-ended question, watch them deliberate, get a verdict.\n\n' +
        'It is not a serious research tool. It is a delightful, slightly absurd alternative to running user tests or polling colleagues when you have no time or budget to do so. The product sits at the intersection of creative tooling and playful entertainment.',
      button: { label: 'Talk with the Jury.' },
    },
  },

  {
    id: 'santa-beer',
    title: 'Santa Beer',
    chat: [],
    content: {
      heading: 'Santa Beer',
      body:
        "We were making an ad for a holiday beer — a product that sits at the center of celebration, yet carries awkward cultural baggage: the seasonal guilt of indulgence. People love beer, but it's often framed as something to earn, burn off, or feel guilty about. Instead of avoiding that association, we reversed it.",
      button: { label: 'Drink Beer' },
    },
  },

  {
    id: 'flaneur',
    title: 'Flaneur',
    chat: [{ who: 'axolotl', text: 'What is this?' }],
    content: {
      heading: 'Flaneur',
      body:
        'Flâneur is a location-aware iOS app that scores your walk through the city—as you move, it detects your neighborhood and plays music matched to that place\'s cultural and atmospheric identity, never cutting a song off mid-track (the rule is music leads, geography follows). Each neighborhood carries a "sound identity" scored across four weighted dimensions—History, Atmosphere, People, and Time—each mapped to its own Last.fm data source, combined into a seed pool, then filtered through your own listening history. The place-to-music premise rests on Kaminskas & Ricci\'s research on music recommendation for points of interest, which establishes two matching pathways—emotion congruence and POI-semantic matching—that Flâneur engineers into its four-dimension scoring.',
      button: { label: 'Take a walk' },
    },
  },

  {
    id: 'more',
    title: "What's More",
    chat: [
      { who: 'axolotl', text: 'Knock on the glass.' },
      { who: 'octopus', text: 'How to work with us?' },
    ],
    content: null,
  },
];

/** Brand wordmark shown top-left on every section. */
export const WORDMARK = 'AQUARIA.TANK';

/** Sidebar menu — label + the section id it scrolls to. */
export const MENU = [
  { label: 'About', target: 'about' },
  { label: 'Cassette Jury', target: 'cassette-jury' },
  { label: 'Santa Beer', target: 'santa-beer' },
  { label: 'Flaneur', target: 'flaneur' },
  { label: 'More', target: 'more' },
];
