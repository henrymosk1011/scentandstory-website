// Cloudflare Worker for scentandstory.co
// Static files in dist/ are served directly by Workers Static Assets.
// This script only runs for /api/* (see run_worker_first in wrangler.jsonc).
//
// Required secrets:  RESEND_API_KEY        (npx wrangler secret put RESEND_API_KEY)
//                    TURNSTILE_SECRET_KEY  (only while src/config.mjs has a turnstileSiteKey)
// Plain variables:   CONTACT_TO, CONTACT_FROM, ALLOWED_ORIGINS (wrangler.jsonc "vars")

import site from './config.mjs';

const MAX_BODY_BYTES = 20_000;
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MIN_FILL_MS = 2500; // humans take longer than this to fill the form

const LIMITS = {
  firstName: 80,
  lastName: 80,
  email: 160,
  phone: 40,
  eventDate: 10,
  guests: 5,
  location: 160,
  experience: 60,
  message: 4000,
};

const EXPERIENCES = new Set([
  'Not sure yet',
  'The Prelude',
  'The Interlude',
  'The Signature Soirée',
  'A custom signature scent',
]);

// Words that only ever show up in spam (lowercase). A submission that contains one
// in the name, email, location or message gets a quiet success and is never sent.
// The "Biasp" bot signs as RobertBiasp, WillieBiaspGM, KevinBiaspGM and so on.
const BLOCKED_WORDS = ['biasp'];

const API_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      try {
        return await handleContact(request, env, url);
      } catch (err) {
        console.error('contact: unexpected error', err && err.message);
        return reply(request, 500, { ok: false, message: genericFailure(env) });
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return json(404, { ok: false, message: 'Not found.' });
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env, url) {
  if (request.method !== 'POST') {
    return json(405, { ok: false, message: 'Method not allowed.' }, { Allow: 'POST' });
  }

  // Same origin only. Browsers always send Origin on cross site POSTs.
  const origin = request.headers.get('Origin');
  const allowed = new Set([url.origin, ...String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)]);
  if (origin && !allowed.has(origin)) {
    return json(403, { ok: false, message: 'Forbidden.' });
  }

  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) {
    return reply(request, 413, { ok: false, message: 'That message is a little too long. Please shorten it and try again.' });
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (env.CONTACT_LIMITER) {
    const { success } = await env.CONTACT_LIMITER.limit({ key: `contact:${ip || 'unknown'}` });
    if (!success) {
      return reply(request, 429, { ok: false, message: 'Too many messages in a short time. Please wait a minute and try again.' });
    }
  }

  const raw = await readBody(request);
  if (!raw) {
    return reply(request, 400, { ok: false, message: 'We could not read that submission. Please try again.' });
  }

  // Spam traps: a hidden field humans never see, and a minimum fill time.
  // Bots get a quiet success so they do not learn what tripped them.
  const started = Number(raw.started || 0);
  if (clean(raw.website, 200) || (started && Date.now() - started < MIN_FILL_MS)) {
    return reply(request, 200, { ok: true });
  }

  const data = {};
  for (const [key, max] of Object.entries(LIMITS)) data[key] = clean(raw[key], max, key === 'message');
  if (!EXPERIENCES.has(data.experience)) data.experience = 'Not sure yet';

  const haystack = [data.firstName, data.lastName, data.email, data.location, data.message].join(' ').toLowerCase();
  if (BLOCKED_WORDS.some((word) => haystack.includes(word))) {
    console.log('contact: dropped a submission containing a blocked word');
    return reply(request, 200, { ok: true });
  }

  const errors = validate(data);
  if (Object.keys(errors).length) {
    return reply(request, 422, { ok: false, message: 'Please correct the highlighted fields.', errors });
  }

  // Cloudflare Turnstile: the token proves a real browser passed the check.
  // Checked after field validation so a typo does not use up the token.
  if (site.turnstileSiteKey) {
    if (!env.TURNSTILE_SECRET_KEY) {
      console.error('contact: TURNSTILE_SECRET_KEY is not configured');
      return reply(request, 503, { ok: false, message: genericFailure(env) });
    }
    if (!(await verifyTurnstile(raw['cf-turnstile-response'], ip, env))) {
      return reply(request, 403, {
        ok: false,
        message: `We could not confirm that this inquiry came from a person. Please try again, or email us directly at ${contactEmail(env)}.`,
      });
    }
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
    console.error('contact: RESEND_API_KEY, CONTACT_TO or CONTACT_FROM is not configured');
    return reply(request, 503, { ok: false, message: genericFailure(env) });
  }

  const name = `${data.firstName} ${data.lastName}`.trim();
  const subject = `New inquiry from ${name}${data.eventDate ? ` for ${formatDate(data.eventDate)}` : ''}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM,
      to: env.CONTACT_TO.split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: `${name.replace(/[<>"]/g, '')} <${data.email}>`,
      subject,
      text: emailText(data),
      html: emailHtml(data),
      tags: [{ name: 'source', value: 'website_inquiry' }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('contact: Resend rejected the message', res.status, detail.slice(0, 300));
    return reply(request, 502, { ok: false, message: genericFailure(env) });
  }

  return reply(request, 200, { ok: true });
}

// ------------------------------------------------------------------ helpers

// Tokens are single use and expire after five minutes. A network failure throws
// and is answered with the generic failure message.
async function verifyTurnstile(token, ip, env) {
  if (typeof token !== 'string' || !token || token.length > 2048) {
    console.warn('contact: missing or malformed Turnstile token');
    return false;
  }
  const res = await fetch(TURNSTILE_VERIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, ...(ip && { remoteip: ip }) }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await res.json().catch(() => ({}));
  if (result.success === true) return true;
  console.warn('contact: Turnstile rejected the token', res.status, (result['error-codes'] || []).join(','));
  return false;
}

async function readBody(request) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    if (type.includes('application/json')) {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    }
    if (type.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(text));
    }
  } catch {
    return null;
  }
  return null;
}

function clean(value, max, multiline = false) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  let s = String(value).normalize('NFC');
  // Strip control characters. Keep newlines and tabs only in the message.
  s = multiline ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/[​-‏‪-‮⁦-⁩]/g, '').trim();
  return s.slice(0, max);
}

function validate(d) {
  const e = {};
  if (!d.firstName) e.firstName = 'Please enter your first name.';
  if (!d.lastName) e.lastName = 'Please enter your last name.';
  if (!d.email) e.email = 'Please enter your email address.';
  else if (!/^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[A-Za-z]{2,}$/.test(d.email)) e.email = 'Please enter a valid email address, like name@example.com.';
  if (d.phone && !/^[0-9+().\s‐-―-]{7,40}$/.test(d.phone)) e.phone = 'Please enter a valid phone number.';
  if (d.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.eventDate)) e.eventDate = 'Please choose a valid date.';
  // A day of slack so a visitor west of UTC can still pick their own today.
  else if (d.eventDate && d.eventDate < new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)) e.eventDate = 'Please choose a date that has not already passed.';
  if (d.guests && (!/^\d{1,5}$/.test(d.guests) || Number(d.guests) < 1)) e.guests = 'Please enter a guest count between 1 and 5000.';
  if (!d.message) e.message = 'Please share a few details about your event.';
  return e;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function rows(d) {
  return [
    ['Name', `${d.firstName} ${d.lastName}`],
    ['Email', d.email],
    ['Phone', d.phone || 'Not provided'],
    ['Event date', d.eventDate ? formatDate(d.eventDate) : 'Not provided'],
    ['Estimated guests', d.guests || 'Not provided'],
    ['Location', d.location || 'Not provided'],
    ['Experience', d.experience],
  ];
}

function emailText(d) {
  return [
    'New inquiry from scentandstory.co',
    '',
    ...rows(d).map(([k, v]) => `${k}: ${v}`),
    '',
    'About the event:',
    d.message,
    '',
    'Reply to this email to respond directly to the client.',
  ].join('\n');
}

function emailHtml(d) {
  const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const tr = rows(d)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 16px 8px 0;color:#62454b;font:500 12px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:8px 0;color:#2a1518;font:16px/1.5 Georgia,serif">${esc(v)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#fff8f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px">
<tr><td style="padding:32px 32px 8px">
<p style="margin:0 0 6px;color:#79111f;font:500 12px/1.4 Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase">Scent and Story</p>
<h1 style="margin:0 0 20px;color:#2a1518;font:400 28px/1.2 Georgia,serif">New inquiry from ${esc(d.firstName)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0">${tr}</table>
<h2 style="margin:28px 0 8px;color:#79111f;font:500 12px/1.4 Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase">About the event</h2>
<p style="margin:0 0 28px;color:#2a1518;font:16px/1.6 Georgia,serif;white-space:pre-wrap">${esc(d.message)}</p>
<p style="margin:0 0 32px;color:#62454b;font:14px/1.5 Arial,sans-serif">Reply to this email to respond directly to ${esc(d.firstName)}.</p>
</td></tr></table></body></html>`;
}

function contactEmail(env) {
  return String(env.CONTACT_TO || 'info@scentandstory.co').split(',')[0].trim();
}

function genericFailure(env) {
  return `Sorry, something went wrong and your inquiry was not sent. Please try again, or email us directly at ${contactEmail(env)}.`;
}

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...API_HEADERS, ...extra },
  });
}

// JSON for fetch() callers, a redirect for the no JavaScript form post.
function reply(request, status, body) {
  const accept = request.headers.get('Accept') || '';
  const type = request.headers.get('Content-Type') || '';
  const wantsJson = accept.includes('application/json') || type.includes('application/json');
  if (wantsJson) return json(status, body);
  const target = body.ok ? '/thanks/' : `/?error=1#inquire`;
  return new Response(null, { status: 303, headers: { Location: target, ...API_HEADERS } });
}
