/**
 * CRÈCHE — project data layer.
 * ------------------------------------------------------------------
 * The work section is entirely data-driven from `public/creche-projects.json`
 * — that file is the ONE place to add/remove/edit a project. Nothing here
 * hard-codes a project id.
 *
 * Per-project presentation (orb colour, the model that eventually replaces the
 * placeholder sphere, the hover preview clip) is optional and lives in the same
 * JSON under an `orb` key, so it stays editable without touching code:
 *
 *   "orb": { "color": "#F186AF", "model": "/models/flaneur.glb", "preview": "/preview/flaneur.gif" }
 *
 * Anything omitted falls back to the brand palette / legacy asset map below.
 */

const SRC = '/creche-projects.json';

/** Brand palette (see DESIGN_SYSTEM.md), assigned round-robin when a project
 *  has no `orb.color` of its own. Ordered so neighbours in the lineup contrast.
 *  The paler brand swatches are deepened here: the orb material brightens and
 *  clear-coats whatever tint it is given, so #A7D8E5 / #FDF5E7 straight off the
 *  palette both come out as the same white ball. */
const ORB_PALETTE = [
  '#E8511E', // orange
  '#F186AF', // brand pink
  '#6FB7CE', // brand blue, deepened
  '#D94E3B', // brand red
  '#4FA39F', // brand teal, deepened
  '#EAD3A8', // brand cream, deepened to sand
];

/** Clips shot for the v1 site — kept as a fallback for the projects that have one. */
const LEGACY_PREVIEWS = {
  'cassette-jury': '/preview/cassette-jury.gif',
  'santa-beer': '/preview/santa-beer.gif',
  flaneur: '/preview/flaneur.gif',
};

/** GLBs modelled for the v1 site, reusable as a project's lineup model. */
const LEGACY_MODELS = {
  'cassette-jury': '/models/cassette-jury.glb',
  'santa-beer': '/models/santa-beer.glb',
  flaneur: '/models/flaneur.glb',
};

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** Title-case a camelCase / snake_case key for display ("whyItMatters" → "Why it matters"). */
const labelise = (key) =>
  key
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

/**
 * Turn a share URL into one an <iframe> will actually load. A youtu.be or
 * /watch?v= link refuses to frame (X-Frame-Options), so pasting one straight
 * into the JSON would render an empty box — this accepts whatever form you
 * copied out of the browser and converts it.
 */
function toEmbed(url) {
  if (!url) return null;
  let m = url.match(/^https?:\/\/youtu\.be\/([\w-]+)/i);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/^https?:\/\/(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([\w-]+)/i);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/i);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return url; // already an embed URL (or some other host) — trust it
}

/** @returns {{label: string|null, value: string}[]} */
function normaliseBrief(brief) {
  if (!brief) return [];
  if (typeof brief === 'string') return [{ label: null, value: brief }];
  return Object.entries(brief)
    .map(([k, v]) => ({ label: labelise(k), value: asArray(v).join(' · ') }))
    .filter((row) => row.value);
}

/** Flatten one raw JSON entry into the shape the UI consumes. */
function normalise(raw, i) {
  const orb = raw.orb || {};
  const sections = raw.sections || {};
  return {
    id: raw.id,
    title: raw.title || raw.id,
    status: raw.status || null,
    year: raw.year ?? null,
    tagline: raw.tagline || null,
    oneLiner: raw.oneLiner || null,
    summary: raw.summary || null,
    /** category tags — drive the rail's filter chips */
    types: asArray(raw.tags && raw.tags.type),
    /** free-form badges (platform / material / status) — shown next to the orb */
    display: asArray(raw.tags && raw.tags.display),
    cta: raw.cta || null,
    links: raw.links || {},
    // `brief` is authored two ways in the file: a plain string on some
    // projects, a keyed object (product / insight / competition / …) on the
    // spec-ad ones. Flattened here to one shape — [{label, value}] — so the
    // panel never has to know which kind it got.
    brief: normaliseBrief(raw.brief),
    sections: {
      concept: asArray(sections.concept),
      design: asArray(sections.design),
      technical: asArray(sections.technical),
      whyItMatters: asArray(sections.whyItMatters),
    },
    stack: asArray(raw.stack),
    awards: asArray(raw.awards),
    submissions: asArray(raw.submissions),
    credits: raw.credits || null,
    notes: raw.notes || null,
    color: orb.color || ORB_PALETTE[i % ORB_PALETTE.length],
    model: orb.model || LEGACY_MODELS[raw.id] || null,
    preview: orb.preview || LEGACY_PREVIEWS[raw.id] || null,
    /** the film itself, for Video projects — `"links": { "video": "…" }` */
    video: toEmbed(raw.links && raw.links.video),
  };
}

/** Video projects show their film; everything else shows a CTA. */
export function isVideo(project) {
  return project.types.includes('Video');
}

/** Work in progress — the lineup shows it, but it has no case study to open. */
export function isWip(project) {
  return project.status === 'wip';
}

/** First external link, in a sensible order of preference — powers the CTA. */
export function primaryLink(project) {
  const l = project.links || {};
  return l.site || l.caseStudy || l.portfolio || l.writeup || l.deck || Object.values(l)[0] || null;
}

/** True when `project` belongs to `category` ('All' matches everything). */
export function inCategory(project, category) {
  return category === 'All' || project.types.includes(category);
}

/**
 * Fetch + normalise the project file.
 * @returns {Promise<{projects: object[], categories: string[]}>}
 */
export async function loadProjects() {
  const res = await fetch(SRC, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`projects: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const projects = (data.projects || []).map(normalise);
  // Categories come from the file's own vocabulary so a new type is picked up
  // by adding it there — but only keep the ones something actually uses, or the
  // rail grows a chip that filters to nothing.
  const vocab = asArray(data.tagVocabulary && data.tagVocabulary.type);
  const used = new Set(projects.flatMap((p) => p.types));
  const categories = ['All', ...vocab.filter((t) => used.has(t))];
  return { projects, categories };
}
