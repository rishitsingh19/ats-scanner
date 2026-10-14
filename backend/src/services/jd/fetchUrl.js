'use strict';

/**
 * REQ-2.1 / REQ-2.4: fetch a job posting page and pull out its readable text.
 * If anything fails, the caller tells the user to paste the text instead.
 */

const dns = require('dns').promises;
const net = require('net');
const { badRequest } = require('../../utils/errors');

const PASTE_INSTEAD =
  'We could not read the job description from that link (the site may block automated access or need a login). Please copy the job description text and paste it instead.';

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v === '::';
}

/** Blocks requests to localhost / internal networks (prevents server-side request forgery). */
async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('INVALID_URL', 'That does not look like a valid web address. Please check the link or paste the job description text.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw badRequest('INVALID_URL', 'Only http:// and https:// links are supported.');
  try {
    const records = await dns.lookup(url.hostname, { all: true });
    if (records.some((r) => isPrivateIp(r.address))) throw new Error('private');
  } catch {
    throw badRequest('URL_FETCH_FAILED', PASTE_INSTEAD);
  }
  return url;
}

function htmlToText(html) {
  let h = html;
  // Prefer JSON-LD JobPosting data when the site provides it (LinkedIn, Indeed, Naukri, many ATS pages do).
  const ld = [...h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ld) {
    try {
      const data = JSON.parse(m[1].trim());
      const items = Array.isArray(data) ? data : data['@graph'] || [data];
      const job = items.find((x) => x && (x['@type'] === 'JobPosting' || (Array.isArray(x['@type']) && x['@type'].includes('JobPosting'))));
      if (job && job.description) {
        return { title: job.title || null, text: htmlToText(`<div>${job.description}</div>`).text };
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  const titleMatch = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  h = h
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|section|article|tr|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  const text = h
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1)
    .join('\n');
  return { title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null, text };
}

async function fetchJobPosting(rawUrl) {
  let url = await assertPublicUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let html;
  try {
    let res;
    // Follow up to 4 redirects manually so every hop is checked against internal addresses.
    for (let hop = 0; hop < 5; hop += 1) {
      // eslint-disable-next-line no-await-in-loop
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ATSScanner/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        // eslint-disable-next-line no-await-in-loop
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      break;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|xhtml/.test(type)) throw new Error('not html');
    html = (await res.text()).slice(0, 2_000_000);
  } catch {
    throw badRequest('URL_FETCH_FAILED', PASTE_INSTEAD);
  } finally {
    clearTimeout(timer);
  }
  const { title, text } = htmlToText(html);
  if (text.split(/\s+/).length < 60) throw badRequest('URL_FETCH_FAILED', PASTE_INSTEAD);
  return { title, text: text.slice(0, 20000) };
}

module.exports = { fetchJobPosting, htmlToText, isPrivateIp };
