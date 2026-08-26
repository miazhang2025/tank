import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SECTIONS } from './src/content/sections.js';
import { SOCIAL } from './src/content/social.js';

// ---------------------------------------------------------------------------
// EDIT ME — the production origin, no trailing slash.
// Everything canonical/OG/sitemap/JSON-LD below is built from this one value.
// A WRONG value here is worse than none at all (a bad canonical can drop the
// site out of the index), so check it before the first deploy.
// ---------------------------------------------------------------------------
const SITE = 'https://crechetank.com';

// Brand string kept first so the browser tab still reads as the brand; the
// descriptor after it is what actually tells a search engine what this is.
const TITLE = 'CRÈCHE · the tank — creative tech/media studio';

const projectsUrl = new URL('./public/creche-projects.json', import.meta.url);
const ogUrl = new URL('./public/og.png', import.meta.url);

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The studio one-liner, taken from the about section so the two can't drift. */
function studioBlurb() {
  const about = SECTIONS.find((s) => s.id === 'about');
  return (
    about?.content?.body ??
    'Crèche is a creative tech/media studio. It makes small, weird things.'
  );
}

function readProjects() {
  try {
    const data = JSON.parse(readFileSync(projectsUrl, 'utf8'));
    return (data.projects || []).filter((p) => p && p.id);
  } catch (err) {
    // never fail a build over metadata — ship the page without the extras
    console.warn('[seo] could not read creche-projects.json:', err.message);
    return [];
  }
}

const firstLink = (p) => {
  const l = p.links || {};
  return l.video || l.site || l.caseStudy || l.portfolio || l.writeup || l.deck || null;
};

/**
 * Structured data. This is the highest-leverage piece for answer engines
 * (ChatGPT/Perplexity/Google AI): it is machine-readable fact, and unlike the
 * rest of this site it does not need JavaScript to be executed to be read.
 */
function jsonLd(projects) {
  const blurb = studioBlurb();
  const org = {
    '@type': 'Organization',
    '@id': `${SITE}/#studio`,
    name: 'Crèche Tank',
    alternateName: ['CRÈCHE', 'Creche Tank'],
    url: SITE,
    email: 'knockonglass@crechetank.com',
    description: blurb,
    sameAs: SOCIAL.filter((s) => s.href && !s.href.startsWith('mailto:')).map((s) => s.href),
  };
  const site = {
    '@type': 'WebSite',
    '@id': `${SITE}/#site`,
    url: SITE,
    name: 'Crèche Tank',
    description: blurb,
    inLanguage: 'en',
    publisher: { '@id': `${SITE}/#studio` },
  };
  const work = {
    '@type': 'ItemList',
    '@id': `${SITE}/#work`,
    name: 'Work',
    numberOfItems: projects.length,
    itemListElement: projects.map((p, i) => {
      const types = (p.tags && p.tags.type) || [];
      const item = {
        '@type': 'CreativeWork',
        '@id': `${SITE}/#${p.id}`,
        name: p.title || p.id,
        headline: p.tagline || undefined,
        description: p.summary || p.oneLiner || p.tagline || undefined,
        datePublished: p.year ? String(p.year) : undefined,
        genre: types.length ? types : undefined,
        keywords: [...types, ...((p.tags && p.tags.display) || [])].join(', ') || undefined,
        creator: { '@id': `${SITE}/#studio` },
        url: firstLink(p) || undefined,
      };
      // Films get a VideoObject too. `uploadDate` is deliberately omitted rather
      // than invented — the data carries a year, not a date.
      if (types.includes('Video') && p.links && p.links.video) {
        item.video = {
          '@type': 'VideoObject',
          name: p.title || p.id,
          description: p.summary || p.oneLiner || undefined,
          embedUrl: p.links.video,
        };
      }
      return { '@type': 'ListItem', position: i + 1, item };
    }),
  };
  return { '@context': 'https://schema.org', '@graph': [org, site, work] };
}

/**
 * A real, readable fallback for anything that does not run JavaScript — which
 * includes a good share of the crawlers that feed AI answer engines. The site
 * itself is a WebGL canvas whose copy is fetched at runtime, so without this a
 * non-executing fetch of the page sees an empty <div id="root">.
 *
 * This is not cloaking: it is the same content the rendered site shows, and it
 * is hidden from every visitor who does have JavaScript.
 */
function noscriptHtml(projects) {
  const rows = projects
    .map((p) => {
      const meta = [p.year, ...((p.tags && p.tags.type) || [])].filter(Boolean).join(' · ');
      const href = firstLink(p);
      return [
        `<article>`,
        `<h3>${esc(p.title || p.id)}</h3>`,
        meta ? `<p>${esc(meta)}</p>` : '',
        p.tagline ? `<p><em>${esc(p.tagline)}</em></p>` : '',
        p.summary || p.oneLiner ? `<p>${esc(p.summary || p.oneLiner)}</p>` : '',
        href ? `<p><a href="${esc(href)}">${esc(p.cta || 'View')}</a></p>` : '',
        `</article>`,
      ].join('');
    })
    .join('');
  const links = SOCIAL.filter((s) => s.href)
    .map((s) => `<li><a href="${esc(s.href)}">${esc(s.label)}</a></li>`)
    .join('');
  return [
    `<main>`,
    `<h1>Crèche Tank</h1>`,
    `<p>${esc(studioBlurb())}</p>`,
    `<h2>Work</h2>`,
    rows,
    `<h2>Contact</h2>`,
    `<p>Knock on the glass — <a href="mailto:knockonglass@crechetank.com">knockonglass@crechetank.com</a></p>`,
    links ? `<ul>${links}</ul>` : '',
    `</main>`,
  ].join('');
}

/** Plain-text digest for AI answer engines (see llmstxt.org). */
function llmsTxt(projects) {
  const lines = [
    '# Crèche Tank',
    '',
    `> ${studioBlurb()}`,
    '',
    'Crèche Tank (also written CRÈCHE) is a creative tech/media studio. It makes',
    'interactive work, short films, and brand/story work. The site is a single',
    'WebGL page: an aquarium you scroll down through, with the studio\'s two',
    'characters — an axolotl and an octopus — talking in it.',
    '',
    '## Work',
    '',
  ];
  for (const p of projects) {
    const types = ((p.tags && p.tags.type) || []).join('/');
    const href = firstLink(p);
    lines.push(`### ${p.title || p.id}${p.year ? ` (${p.year})` : ''}${types ? ` — ${types}` : ''}`);
    if (p.tagline) lines.push(`${p.tagline}`);
    if (p.summary || p.oneLiner) lines.push('', `${p.summary || p.oneLiner}`);
    if (p.stack && p.stack.length) lines.push('', `Built with: ${p.stack.join(', ')}`);
    if (href) lines.push('', `Link: ${href}`);
    lines.push('');
  }
  lines.push('## Contact', '', 'Email: knockonglass@crechetank.com');
  for (const s of SOCIAL) if (s.href && !s.href.startsWith('mailto:')) lines.push(`${s.label}: ${s.href}`);
  lines.push('');
  return lines.join('\n');
}

/** Injects metadata built from the project data, and emits the crawler files. */
function seo() {
  return {
    name: 'creche-seo',
    transformIndexHtml() {
      const projects = readProjects();
      const blurb = studioBlurb();
      const tags = [
        { tag: 'meta', attrs: { name: 'description', content: blurb }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'canonical', href: `${SITE}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#0E3A3C' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'Crèche Tank' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:title', content: TITLE }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:description', content: blurb }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: `${SITE}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:title', content: TITLE }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:description', content: blurb }, injectTo: 'head' },
      ];
      // Only claim a share image once one actually exists — a card pointing at a
      // 404 renders worse than a card with no image at all. Drop a 1200×630
      // public/og.png in and these light up on the next build.
      if (existsSync(ogUrl)) {
        tags.push(
          { tag: 'meta', attrs: { property: 'og:image', content: `${SITE}/og.png` }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE}/og.png` }, injectTo: 'head' },
        );
      }
      tags.push({
        tag: 'script',
        attrs: { type: 'application/ld+json' },
        children: JSON.stringify(jsonLd(projects)),
        injectTo: 'head',
      });
      tags.push({ tag: 'noscript', children: noscriptHtml(projects), injectTo: 'body' });
      return tags;
    },
    generateBundle() {
      const projects = readProjects();
      let lastmod = new Date().toISOString().slice(0, 10);
      try {
        const data = JSON.parse(readFileSync(projectsUrl, 'utf8'));
        if (data.updated) lastmod = data.updated;
      } catch {
        /* today is fine */
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        // One URL on purpose: this is a single page with no per-project routes.
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      });
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(projects) });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seo()],
  server: {
    host: true,
    open: true,
  },
});
