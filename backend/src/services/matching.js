'use strict';

const { escapeRegex, normalize, termRegex } = require('./textUtils');
const { variantsFor } = require('./jd/skillsDictionary');

const cache = new Map();

function caseSensitiveRegex(text) {
  let body = escapeRegex(text.trim()).replace(/\s+/g, '[\\s\\-_/]+');
  // Some names are also English words: ignore "go to", "go live", "Spring 2024" etc.
  const NOT_FOLLOWED_BY = {
    Go: '(?!\\s+(?:to|live|ahead|beyond|through|back|for|on|out|with)\\b)',
    // "Spring 2024", "Spring internship", "Spring semester" are seasons, not the Java framework
    Spring: '(?!\\s+(?:(?:19|20)\\d{2}|\\d{2}\\b|intern\\w*|semester|term|break|season|fest\\w*|quarter)\\b)',
  };
  const extra = NOT_FOLLOWED_BY[text] || '';
  if (/[a-z]$/.test(text) && text.length > 3) body += '(?:e?s)?';
  return new RegExp(`(?<![A-Za-z0-9+#.])${body}(?![A-Za-z0-9+#\\-]|\\.[A-Za-z0-9])${extra}`);
}

function variantRegex(v) {
  const key = `${v.cs ? 'cs' : 'ci'}:${v.text}`;
  if (!cache.has(key)) cache.set(key, v.cs ? caseSensitiveRegex(v.text) : termRegex(v.text));
  return cache.get(key);
}

/** Prepare text once, then test many terms against it. */
function prepare(text) {
  const orig = String(text || '')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ');
  return { orig, lower: normalize(orig) };
}

function variantMatches(prepared, v) {
  const re = variantRegex(v);
  return v.cs ? re.test(prepared.orig) : re.test(prepared.lower);
}

/** Does the text mention the term (or any known alias of it)? */
function termMatches(prepared, term) {
  const p = typeof prepared === 'string' ? prepare(prepared) : prepared;
  return variantsFor(term).some((v) => variantMatches(p, v));
}

/** Count how many times the term (or an alias) appears. */
function countTerm(prepared, term) {
  const p = typeof prepared === 'string' ? prepare(prepared) : prepared;
  let total = 0;
  for (const v of variantsFor(term)) {
    const re = variantRegex(v);
    const g = new RegExp(re.source, re.flags + 'g');
    const m = (v.cs ? p.orig : p.lower).match(g);
    if (m) total += m.length;
  }
  return total;
}

module.exports = { prepare, variantRegex, variantMatches, termMatches, countTerm };
