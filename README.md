# Scent and Story Perfume Bar

Website for **Scent and Story**, a luxury perfume blending bar in Los Angeles.
Live at [scentandstory.co](https://scentandstory.co) once DNS is switched.

Designed by [TENELEVENMEDIA](https://tenelevenmedia.com).

## Stack

| Piece | What it does |
| --- | --- |
| Static HTML, CSS, JS | No framework. `build.mjs` (zero dependencies) assembles pages from `src/` into `dist/`. |
| GSAP 3.15 + ScrollTrigger + SplitText, Lenis 1.3 | Smooth scroll, pinned horizontal scroll, split text reveals, parallax. Vendored in `static/vendor/`. |
| Cloudflare Workers + Static Assets | Serves `dist/` from the edge. A tiny Worker (`src/worker.js`) only handles `/api/contact`. |
| Resend | Delivers inquiry form submissions to `info@scentandstory.co`. |

## Project layout

```
src/
  config.mjs        business name, email, domain, social links (edit here)
  content.mjs       packages, FAQ, testimonials (also feeds Google structured data)
  pages/            one HTML file per page, with JSON front matter for SEO
  partials/         layout, header, footer, form
  worker.js         contact API (validation, spam traps, rate limit, Resend)
static/             copied to dist/ as is (css, js, fonts, images, icons)
build.mjs           builds dist/, sitemap.xml, robots.txt, manifest, _headers (CSP)
wrangler.jsonc      Cloudflare Worker config
```

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # add a Resend API key to test real sends
npm run dev                      # http://localhost:8787, rebuilds on save
```

`npm run build` writes the static site to `dist/` without starting a server.

## Deploying

### 1. Cloudflare Worker from GitHub

1. Cloudflare dashboard, **Workers & Pages**, **Create**, **Import a repository**.
2. Pick `henrymosk1011/scentandstory-website` and the production branch (`main`).
3. Leave the build command empty. Deploy command: `npx wrangler deploy` (the default).
   Wrangler runs `node build.mjs` automatically before each deploy.
4. Every push to `main` now deploys. Pull requests get preview URLs.

### 2. Resend API key (secret)

1. In Resend, create an API key with **Sending access** limited to `scentandstory.co`.
2. Add it to the Worker: dashboard, the `scentandstory` Worker, **Settings**, **Variables and Secrets**,
   add a **Secret** named `RESEND_API_KEY`. Or from a terminal: `npx wrangler secret put RESEND_API_KEY`.

The sender and recipient live in `wrangler.jsonc` under `vars`
(`CONTACT_FROM`, `CONTACT_TO`). Several recipients can be comma separated.

### 3. Domain: GoDaddy to Cloudflare

The `scentandstory.co` zone has been added to the Cloudflare account (status: pending) and its
existing records were imported from GoDaddy:

* **Email is Google Workspace.** All five Google MX records were imported.
* The SPF record at GoDaddy pointed to a GoDaddy managed include
  (`dc-aa8e722993._spfm.scentandstory.co`) that would stop resolving after the move. It has been
  replaced in Cloudflare with its actual value, `v=spf1 include:_spf.google.com ~all`.
* The existing DMARC record and the Google Search Console verification TXT were kept.
* `pay` (GoDaddy payment links) and `_domainconnect` are set to DNS only.

Steps:

1. In GoDaddy, **My Products**, the domain, **DNS**, **Nameservers**, **Change**, **I'll use my own
   nameservers**, and enter:
   * `kira.ns.cloudflare.com`
   * `viddy.ns.cloudflare.com`
2. Wait for the zone to show **Active** (minutes to a few hours). Send a test email to
   `info@scentandstory.co` to confirm mail still arrives.
3. Delete the two old apex `A` records (`13.248.243.5`, `76.223.105.230`) and the `www` CNAME.
4. Attach the domain to the Worker: either uncomment the `routes` block in `wrangler.jsonc` and push,
   or in the dashboard go to the Worker, **Settings**, **Domains & Routes**, **Add**, **Custom domain**,
   and add both `scentandstory.co` and `www.scentandstory.co`.
5. Redirect `www` to the apex: **Rules**, **Redirect Rules**, template **Redirect from WWW to root**.
6. Recommended zone settings: SSL/TLS **Full (strict)**, **Always Use HTTPS** on, **Rocket Loader** off
   (it rewrites scripts and fights the Content Security Policy).

### 4. Resend domain verification

`scentandstory.co` has been added to Resend, and its records were created in the Cloudflare zone
ahead of time (`resend._domainkey` TXT, `send` MX and TXT, `rsend` CNAME). After the nameserver
switch, open the domain in Resend and click **Verify**. Mail from `website@scentandstory.co` will then
pass DKIM, SPF and the domain's existing DMARC policy.

Recommended while you are in there: Google Workspace has no DKIM key published for this domain
(`google._domainkey` does not exist). In the Google Admin console, **Apps**, **Google Workspace**,
**Gmail**, **Authenticate email**, generate a key and add the TXT record in Cloudflare.

### 5. Search and analytics

* Google Search Console: add the domain property, then submit `https://scentandstory.co/sitemap.xml`.
* When adding analytics, allow its domains in the Content Security Policy in `build.mjs`
  (`script-src`, `connect-src`, `img-src`) and update the cookie paragraph in `src/pages/privacy.html`.

## House style

* No dashes or em dashes anywhere in visible copy. The build fails if an en or em dash appears.
* No dot graphics, bullet dots, or pulse dots. Lists use the brand `+` as their marker.
* No decorative lines next to or under headings.
* Footer year updates automatically. It is written at build time and refreshed in the browser.

## Accessibility

Built to WCAG 2.2 AA and audited with axe-core in every mode (0 violations):

* Skip link, landmarks, one `h1` per page, logical heading outline.
* All motion is disabled under **Reduce motion**: pinned and horizontal sections become a static grid,
  and nothing autoplays (the marquee only moves while you scroll).
* Keyboard friendly menu (focus moves in, `Esc` closes, background is inert), accordion buttons with
  `aria-expanded`, and stacked cards that never hide a focused control.
* Form fields have visible labels, required text, inline errors linked with `aria-describedby`,
  and a live status region. Without JavaScript the form still posts and redirects to `/thanks/`.

## Security

* Strict Content Security Policy (no third party scripts, inline boot script allowed by hash),
  HSTS, `nosniff`, `frame-ancestors 'none'`, locked down Permissions Policy. See `dist/_headers`.
* Contact API: same origin check, 20 KB body limit, honeypot and minimum fill time traps,
  per IP rate limit (5 per minute), server side validation, HTML escaped email body, and the
  Resend key kept as a Worker secret.

## Credits and licenses

* Fonts: Bodoni Moda and Jost, SIL Open Font License, self hosted.
* GSAP: GreenSock standard no charge license. Lenis: MIT.
* Photography: Scent and Story events.
