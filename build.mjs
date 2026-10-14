// Zero dependency static build for scentandstory.co
// Assembles src/pages with src/partials into dist/, copies static/, and writes
// sitemap.xml, robots.txt, site.webmanifest and the _headers security policy.
//
//   node build.mjs
//
// Preview builds for GitHub Pages, which serves the site from a sub path:
//   BASE_PATH=/scentandstory-website PREVIEW=1 node build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import site from './src/config.mjs';
import { packages, faqs, testimonials } from './src/content.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const SRC = join(root, 'src');
const STATIC = join(root, 'static');
const DIST = join(root, 'dist');
const now = new Date();
const year = String(now.getFullYear());
const today = now.toISOString().slice(0, 10);

const read = (p) => readFileSync(p, 'utf8');
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = (buf, len = 10) => createHash('sha256').update(buf).digest('hex').slice(0, len);
const photos = JSON.parse(read(join(STATIC, 'img/photos/manifest.json')));

// Preview builds live under a sub path and are never indexed, so search engines
// only ever see the real domain.
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const PREVIEW = process.env.PREVIEW === '1';
const withBase = (text) =>
  !BASE
    ? text
    : text
        .replace(/(\s(?:href|src|action)=")\/(?!\/)/g, `$1${BASE}/`)
        .replace(/(\ssrcset=")([^"]*)"/g, (_, attr, v) => `${attr}${v.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE}/`)}"`)
        .replace(/url\((['"]?)\/(?!\/)/g, `url($1${BASE}/`);

// ---------------------------------------------------------------- clean + copy
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(STATIC, DIST, { recursive: true, filter: (src) => !src.endsWith('manifest.json') });
if (BASE) writeFileSync(join(DIST, 'css/main.css'), withBase(read(join(STATIC, 'css/main.css'))));

// ---------------------------------------------------------------- boot script
// Runs before first paint: flags JS + motion so content can be pre-hidden for
// entrance animations. A failsafe reveals everything if the main bundle never
// arrives. Its hash is whitelisted in the Content Security Policy below.
const bootScript =
  "(function(d,w){var h=d.documentElement;h.classList.remove('no-js');h.classList.add('js');" +
  "var r=w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches;" +
  "if(!r){h.classList.add('motion');w.setTimeout(function(){if(!w.__ssReady){h.classList.remove('motion')}},4000)}})(document,window);";
const bootHash = createHash('sha256').update(bootScript).digest('base64');

// ---------------------------------------------------------------- helpers
const icons = {
  arrow:
    '<svg class="icon icon--arrow" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path d="M4 12h15m0 0l-6-6m6 6l-6 6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  instagram:
    '<svg class="icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  tiktok:
    '<svg class="icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22"><path d="M14 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3M14 3.5c.4 2.6 2.2 4.4 5 4.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function picture(name, alt = '', sizes = '100vw', loading = 'lazy', cls = '') {
  const m = photos[name];
  if (!m) throw new Error(`Unknown photo "${name}"`);
  const set = (ext) => m.widths.map((w) => `/img/photos/${name}-${w}.${ext} ${w}w`).join(', ');
  const fallbackW = m.widths.includes(800) ? 800 : m.widths[m.widths.length - 1];
  const eager = loading === 'eager';
  return (
    `<picture${cls ? ` class="${cls}"` : ''}>` +
    `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">` +
    `<img src="/img/photos/${name}-${fallbackW}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${m.width}" height="${m.height}" alt="${esc(alt)}"` +
    `${eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"'} decoding="async">` +
    `</picture>`
  );
}

function social() {
  const links = Object.entries(site.social).filter(([, url]) => url);
  if (!links.length) return '';
  const label = { instagram: 'Instagram', tiktok: 'TikTok' };
  return (
    '<ul class="social" role="list">' +
    links
      .map(
        ([k, url]) =>
          `<li><a class="social__link" href="${esc(url)}" target="_blank" rel="noopener me">${icons[k] || ''}<span class="visually-hidden">${label[k] || k} (opens in a new tab)</span></a></li>`,
      )
      .join('') +
    '</ul>'
  );
}

const renderers = {
  packages: () =>
    packages
      .map(
        (p, i) => `          <span class="stack__marker" aria-hidden="true" data-stack-marker></span>
          <article class="pkg pkg--${p.theme}" id="package-${p.id}" aria-labelledby="pkg-${p.id}-title" data-stack-card>
            <div class="pkg__content">
              <p class="pkg__numeral" aria-hidden="true">${p.numeral}</p>
              <h3 class="pkg__title" id="pkg-${p.id}-title">${esc(p.name)}</h3>
              <p class="pkg__tagline">${esc(p.tagline)}</p>
              ${p.body.map((b) => `<p>${esc(b)}</p>`).join('\n              ')}
              <dl class="pkg__details">
                ${p.details.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n                ')}
              </dl>
              <a class="btn ${p.theme === 'wine' ? 'btn--light' : ''}" href="#inquire" data-experience="${esc(p.name)}" data-magnetic><span class="btn__label">Inquire about ${esc(p.name)}</span></a>
            </div>
            <figure class="pkg__media arch">${picture(p.image, p.alt, '(min-width: 64em) 36vw, 90vw', 'lazy')}</figure>
          </article>`,
      )
      .join('\n'),
  faq: () =>
    faqs
      .map(
        (f, i) => `          <div class="faq__item" data-faq-item>
            <h3 class="faq__q">
              <button class="faq__button" type="button" id="faq-${i + 1}-btn" aria-expanded="true" aria-controls="faq-${i + 1}">
                <span>${esc(f.q)}</span>
                <span class="faq__icon" aria-hidden="true">+</span>
              </button>
            </h3>
            <div class="faq__panel" id="faq-${i + 1}" role="region" aria-labelledby="faq-${i + 1}-btn">
              <div class="faq__inner">
                ${f.a.map((p) => `<p>${esc(p)}</p>`).join('\n                ')}
              </div>
            </div>
          </div>`,
      )
      .join('\n'),
  testimonials: () =>
    `        <ul class="quotes" role="list">\n` +
    testimonials
      .map(
        (t) => `          <li class="quote" data-fade>
            <figure>
              <blockquote class="quote__text"><p>“${esc(t.quote)}”</p></blockquote>
              <figcaption class="quote__cite"><span class="quote__name">${esc(t.name)}</span> <span class="quote__role">${esc(t.role)}</span></figcaption>
            </figure>
          </li>`,
      )
      .join('\n') +
    `\n        </ul>`,
};

// ---------------------------------------------------------------- structured data
function jsonld(page) {
  const url = site.url;
  const business = {
    '@type': 'LocalBusiness',
    '@id': `${url}/#business`,
    name: site.legalName,
    alternateName: site.name,
    description: site.description,
    url: `${url}/`,
    email: site.email,
    logo: `${url}/icon-512.png`,
    image: [`${url}/img/og-image.jpg`, `${url}/img/photos/hero-1202.jpg`],
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.locality,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    areaServed: site.areaServed.map((name) => ({ '@type': 'AdministrativeArea', name })),
    knowsAbout: ['Custom perfume', 'Fragrance blending', 'Perfume bar events', 'Wedding favors', 'Bridal shower activities', 'Brand activations'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Perfume bar experiences',
      itemListElement: packages.map((p) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: p.name,
          description: `${p.tagline} ${p.body[0]}`,
          serviceType: 'Perfume bar experience',
          provider: { '@id': `${url}/#business` },
          areaServed: site.areaServed.map((name) => ({ '@type': 'AdministrativeArea', name })),
        },
      })),
    },
  };
  const sameAs = Object.values(site.social).filter(Boolean);
  if (sameAs.length) business.sameAs = sameAs;

  const website = {
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    url: `${url}/`,
    name: site.legalName,
    alternateName: site.name,
    inLanguage: 'en-US',
    publisher: { '@id': `${url}/#business` },
  };

  let graph;
  if (page.schema === 'home') {
    graph = [
      website,
      business,
      {
        '@type': 'WebPage',
        '@id': `${url}/#webpage`,
        url: `${url}/`,
        name: page.title,
        description: page.description,
        isPartOf: { '@id': `${url}/#website` },
        about: { '@id': `${url}/#business` },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${url}/img/photos/hero-1202.jpg` },
        inLanguage: 'en-US',
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}/#faq`,
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a.join(' ') },
        })),
      },
    ];
  } else if (page.schema === 'page') {
    graph = [
      {
        '@type': 'WebPage',
        '@id': `${page.canonical}#webpage`,
        url: page.canonical,
        name: page.title,
        description: page.description,
        isPartOf: { '@id': `${url}/#website` },
        inLanguage: 'en-US',
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${url}/` },
            { '@type': 'ListItem', position: 2, name: page.crumb, item: page.canonical },
          ],
        },
      },
    ];
  } else return '';
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

// ---------------------------------------------------------------- templating
const partial = (name) => read(join(SRC, 'partials', `${name}.html`));
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const assetUrl = (p) => `${p}?v=${hash(readFileSync(join(STATIC, p)), 8)}`;

function render(tpl, page) {
  let out = tpl;
  for (let i = 0; i < 5 && /\{\{>\s*[\w-]+\s*\}\}/.test(out); i++) {
    out = out.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => partial(n));
  }
  out = out
    .replace(/\{\{render:(\w+)\}\}/g, (_, n) => renderers[n]())
    .replace(/\{\{pic:([^}]*)\}\}/g, (_, args) => picture(...args.split('|')))
    .replace(/\{\{icon:(\w+)\}\}/g, (_, n) => icons[n])
    .replace(/\{\{roll:([^}]*)\}\}/g, (_, t) => `<span class="roll"><span class="roll__a">${t}</span><span class="roll__b" aria-hidden="true">${t}</span></span>`)
    .replace(/\{\{asset:([^}]*)\}\}/g, (_, p) => assetUrl(p))
    .replace(/\{\{social\}\}/g, social)
    .replace(/\{\{jsonld\}\}/g, () => jsonld(page))
    .replace(/\{\{bootScript\}\}/g, () => bootScript)
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{(site|page)\.([\w.]+)\}\}/g, (m, scope, key) => {
      const v = getPath(scope === 'site' ? site : page, key);
      if (v === undefined) throw new Error(`Missing value for ${m} in ${page.out}`);
      return esc(v);
    });
  const left = out.match(/\{\{[^}]*\}\}/);
  if (left) throw new Error(`Unrendered tag ${left[0]} in ${page.out}`);
  return out;
}

// ---------------------------------------------------------------- pages
const layout = partial('layout');
const built = [];
for (const file of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'))) {
  const raw = read(join(SRC, 'pages', file));
  const fm = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!fm) throw new Error(`Missing front matter in ${file}`);
  const page = JSON.parse(fm[1]);
  page.canonical = `${site.url}${page.path === '/404' ? '/' : page.path}`;
  page.robots = PREVIEW ? 'noindex, nofollow' : page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large';
  page.bodyClass = page.bodyClass || '';
  const body = raw.slice(fm[0].length);
  const html = render(layout.replace('{{content}}', () => body.replace(/\s+$/, '')), page);
  if (/[–—]/.test(html)) throw new Error(`En or em dash found in ${page.out}. House style forbids dashes.`);
  const dest = join(DIST, page.out);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, withBase(html));
  built.push(page);
}

// ---------------------------------------------------------------- sitemap + robots + manifest
const indexable = built.filter((p) => !p.noindex).sort((a, b) => a.path.localeCompare(b.path));
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((p) => `  <url><loc>${site.url}${p.path}</loc><lastmod>${today}</lastmod><priority>${p.priority || '0.5'}</priority></url>`).join('\n')}
</urlset>
`,
);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site.url}/sitemap.xml\n`);
writeFileSync(
  join(DIST, 'site.webmanifest'),
  JSON.stringify(
    {
      name: site.legalName,
      short_name: site.name,
      start_url: `${BASE}/`,
      display: 'browser',
      background_color: '#FFF8F6',
      theme_color: site.themeColor,
      icons: [
        { src: `${BASE}/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${BASE}/icon-512.png`, sizes: '512x512', type: 'image/png' },
        { src: `${BASE}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------- headers
// Static asset responses get these from Cloudflare. API responses set their own
// headers inside src/worker.js. When you add analytics, extend script-src and
// connect-src here with the provider's domains.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${bootHash}'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

if (!PREVIEW) writeFileSync(
  join(DIST, '_headers'),
  `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
  Cross-Origin-Opener-Policy: same-origin

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/css/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable

/vendor/*
  Cache-Control: public, max-age=31536000, immutable

/img/*
  Cache-Control: public, max-age=2592000, stale-while-revalidate=86400
`,
);

console.log(`Built ${built.length} pages into dist/${PREVIEW ? ` as a noindex preview under ${BASE || '/'}` : ''} (${built.map((p) => p.out).join(', ')})`);
