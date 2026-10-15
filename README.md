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

## Preview on GitHub Pages

Every push to `main` or a `claude/*` branch publishes a preview to
**https://henrymosk1011.github.io/scentandstory-website/** through
`.github/workflows/pages.yml`.

* One time setup: repo **Settings**, **Pages**, **Build and deployment**, **Source: GitHub Actions**.
  Then rerun the latest workflow from the **Actions** tab (or push any commit).
* The preview is built with `BASE_PATH` and `PREVIEW=1`, so every link points inside the sub path
  and every page is `noindex`. Search engines only see the real domain.
* The inquiry form needs the Cloudflare Worker, so it does not send from the preview.

## Deploying

### Already set up in Cloudflare (account: henrymm@gmail.com)

* Zone `scentandstory.co` added, waiting on the nameserver switch. Existing records were imported:
  the five Google Workspace MX records, the Google Search Console TXT, DMARC, and SPF (flattened from
  GoDaddy's `_spfm` include to `v=spf1 include:_spf.google.com ~all`). `pay` and `_domainconnect` are DNS only.
* Worker `scentandstory` created and attached to `scentandstory.co` as a custom domain (certificate issued
  by Cloudflare). The old GoDaddy website A records (`13.248.243.5`, `76.223.105.230`) were removed.
  Until the first GitHub build runs, the Worker serves a simple "almost ready" holding page.
* `www.scentandstory.co` is a proxied CNAME with a redirect rule sending it to `https://scentandstory.co`.
* Zone settings: SSL Full (strict), Always Use HTTPS, Automatic HTTPS Rewrites, minimum TLS 1.2, TLS 1.3,
  Brotli, HTTP/3 on; Rocket Loader and Email Obfuscation off (both inject scripts).
* Worker secret `RESEND_API_KEY` set (a Resend key limited to sending from `scentandstory.co`).
* Resend domain `scentandstory.co` added with its DKIM, SPF and return path records already in the zone.

### Remaining steps

1. **Connect GitHub to the Worker.** Cloudflare dashboard, **Workers & Pages**, `scentandstory`,
   **Settings**, **Builds**, **Connect**. Pick `henrymosk1011/scentandstory-website` and the production
   branch. Leave the build command empty and keep the deploy command `npx wrangler deploy`
   (Wrangler runs `node build.mjs` itself). Save, then run the first build. When it finishes,
   `https://scentandstory.henrymm.workers.dev` shows the full site.
2. **Switch nameservers at GoDaddy.** If DNSSEC is on for the domain, turn it off first. Then
   **My Products**, `scentandstory.co`, **DNS**, **Nameservers**, **Change nameservers**,
   **I'll use my own nameservers**, and enter `kira.ns.cloudflare.com` and `viddy.ns.cloudflare.com`.
3. **Wait for Cloudflare to mark the zone Active** (usually under an hour, occasionally up to 24 hours).
   Then check `https://scentandstory.co`, the `www` redirect, and send a test email to
   `info@scentandstory.co`.
4. **Verify the domain in Resend** (Domains, `scentandstory.co`, Verify), then send a test inquiry
   through the site's form.

To rotate the email key later: create a new sending only key in Resend for `scentandstory.co`, then
`npx wrangler secret put RESEND_API_KEY` (or Worker, Settings, Variables and Secrets), and delete the old key.

Recommended while you are in there: Google Workspace has no DKIM key published for this domain
(`google._domainkey` does not exist). In the Google Admin console, **Apps**, **Google Workspace**,
**Gmail**, **Authenticate email**, generate a key and add the TXT record in Cloudflare.

### Search and analytics

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

* Fonts: Noto Serif Display and Jost, SIL Open Font License, self hosted.
* GSAP: GreenSock standard no charge license. Lenis: MIT.
* Photography: Scent and Story events.
