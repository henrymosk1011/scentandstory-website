# Scent and Story Perfume Bar

Website for **Scent and Story**, a luxury perfume blending bar in Los Angeles.
Live at [scentandstory.co](https://scentandstory.co).

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

Every push to the production branch (currently `claude/fervent-volta-lzi6ww`) deploys automatically:
Cloudflare Workers Builds runs `npx wrangler deploy`, which runs `node build.mjs` and uploads `dist/`.
Build history is in the Cloudflare dashboard under **Workers & Pages**, `scentandstory`, **Deployments**.

### How it is set up (Cloudflare account: henrymm@gmail.com)

* DNS for `scentandstory.co` is on Cloudflare (`kira` and `viddy` nameservers, set at GoDaddy, the registrar).
  Google Workspace MX, SPF (`v=spf1 include:_spf.google.com ~all`), DMARC and the Google Search Console TXT
  were carried over from GoDaddy. `pay` and `_domainconnect` are DNS only.
* Worker `scentandstory` serves the apex domain as a custom domain. `www` is a proxied CNAME that a redirect
  rule sends to `https://scentandstory.co`.
* Zone settings: SSL Full (strict), Always Use HTTPS, Automatic HTTPS Rewrites, minimum TLS 1.2, TLS 1.3,
  Brotli, HTTP/3 on; Rocket Loader and Email Obfuscation off (both inject scripts and would break the CSP).
* The inquiry form sends through Resend from `website@scentandstory.co` to `info@scentandstory.co`, with the
  visitor as `reply_to`. The domain is verified in Resend (DKIM on `resend._domainkey`, SPF and return path on
  `send` and `rsend`). Receiving is off on purpose: inbound mail stays with Google Workspace.
* Worker secret `RESEND_API_KEY` holds a Resend key limited to sending from `scentandstory.co`.

### Maintenance

* **Rotate the email key:** create a new sending only key in Resend for `scentandstory.co`, save it with
  `npx wrangler secret put RESEND_API_KEY` (or Worker, **Settings**, **Variables and Secrets**), then delete the old key.
* **Google Workspace DKIM:** if `google._domainkey` does not exist yet, generate it in the Google Admin console
  (**Apps**, **Google Workspace**, **Gmail**, **Authenticate email**), add the TXT record in Cloudflare, then
  click **Start authentication**. DMARC is `p=quarantine`, so mail from Gmail needs DKIM to survive forwarding.
* **Switching the production branch:** after merging into `main`, change the branch under Worker,
  **Settings**, **Builds**.

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
