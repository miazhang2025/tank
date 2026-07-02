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
      { who: 'axolotl', text: 'So, what is AQUARIA?' },
      { who: 'octopus', text: 'A tank. Two of us live in it — the octopus and the axolotl.' },
      { who: 'axolotl', text: 'A creative studio. We make small weird things. The tank is real.' },
      { who: 'octopus', text: 'What do we make?' },
      { who: 'axolotl', text: 'Brands. Stories. The occasional creature you can poke in a browser.' },
      // { who: 'octopus', text: 'How to work with us?' },
      // { who: 'axolotl', text: 'Knock on the glass.' },
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
      { who: 'octopus', text: 'We fight.' },
    ],
    content: {
      // heading: 'Cassette Jury',
      body:
        'Cassette Jury is a pocket jury for your creative decision-making. It is a panel of AI-simulated characters — each with their own job, taste, and agenda — who act as your on-demand jury when you hit a creative deadlock. Submit an open-ended question, watch them deliberate, get a verdict.\n\n' +
        'It is not a serious research tool. It is a delightful, slightly absurd alternative to running user tests or polling colleagues when you have no time or budget to do so. The product sits at the intersection of creative tooling and playful entertainment.',
      button: { label: 'Talk with the Jury.', href: 'https://cassettejury.farm/' },
    },
  },

  {
    id: 'santa-beer',
    title: 'Santa Beer',
    chat: [{ who: 'axolotl', text: 'I like beer.' },
      { who: 'octopus', text: 'I like santa.' }
    ],
    content: {
      // heading: 'Santa Beer',
      body:
        "A meta-advertisement for beer, told through the lens of an Ozempic-era cultural satire. A fat Santa decides to slim down after getting stuck in a chimney—one year later, he's a new man. But \"cut\" breaks the illusion: it's a commercial shoot. The thin Santa trudges off set, exhausted, only to find the real Santa waiting in the car with a cold beer. \n\nReal Taste, No Acting Required. ",
      button: { label: 'Drink Beer', href: 'https://miazhang2025.github.io/santabeer/' },
    },
  },

  {
    id: 'flaneur',
    title: 'Flaneur',
    chat: [{ who: 'octopus', text: 'What is this?' },
      { who: 'axolotl', text: 'I hope I can leave water one day.' }],
    content: {
      // heading: 'Flaneur',
      body:
        'Flâneur is an iOS app that plays music as your walk through the city. You walk, it notices the neighborhood,  and plays music matched to that places cultural and atmospheric identity. Every neighborhood has a sound, which we measure across four things: History, Atmosphere, People, and Time. Each neighborhood has a "sound identity", combined into a seed pool, then filtered through your own listening history.  \n\n The city writes its own poem in music.',
      button: { label: 'Take a walk', href: 'https://flaneur-neon.vercel.app/' },
    },
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
