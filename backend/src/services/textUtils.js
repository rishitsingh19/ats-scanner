'use strict';

/** Shared, dependency-free text helpers used by parsing, JD extraction and scoring. */

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could do does for from had has have he her his i if in into is it its ' +
    'me my no not of on or our ours she so such than that the their them then there these they this those to ' +
    'too up us was we were what when where which while who whom why will with would you your yours about above ' +
    'after again all also am any because before being below between both during each few further here how just ' +
    'more most must nor now once only other over own same should some through under until very off out per via ' +
    'within without across etc e.g i.e including include includes able ability work working role team teams ' +
    'strong good great excellent well new use using used year years month months day days'
  ).split(/\s+/)
);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lowercase and tidy text while keeping characters that matter in tech terms (+ # . / -). */
function normalize(text) {
  return String(text || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .toLowerCase();
}

/**
 * Builds a regex that finds a term as a whole "word", treating characters like + # . as part of it.
 * e.g. "c" will not match inside "c++", and "java" will not match "javascript".
 */
function termRegex(term) {
  const t = normalize(term).trim();
  let body = escapeRegex(t).replace(/\s+/g, '[\\s\\-_/]+');
  // allow simple plural forms for alphabetic terms ("api" -> "apis", "database" -> "databases")
  if (/[a-z]$/.test(t) && t.length > 3) body += '(?:e?s)?';
  return new RegExp(`(?<![a-z0-9+#.])${body}(?![a-z0-9+#]|\\.[a-z0-9])`, 'i');
}

function containsTerm(text, term) {
  return termRegex(term).test(normalize(text));
}

/** REQ-5.2: does a bullet contain a quantifiable metric? */
function hasMetric(text) {
  const t = String(text || '');
  return (
    /\d+(\.\d+)?\s*(%|percent|x\b|k\b|m\b|\+)/i.test(t) ||
    /[$₹€£]\s?\d/.test(t) ||
    /\b\d{1,3}(,\d{3})+\b/.test(t) ||
    /\b\d+(\.\d+)?\s*(users|customers|clients|students|people|members|hours|hrs|days|weeks|minutes|seconds|ms|requests|projects|teams|apps|features|countries|downloads|transactions|records|rows|lines|tickets|bugs|stores|schools|leads|sales|orders|sites|pages|servers|services|endpoints|reports|models|datasets|images)\b/i.test(
      t
    ) ||
    /\b(reduced|increased|improved|grew|cut|boosted|saved|decreased|raised|lowered|accelerated)\b[^.]{0,40}\b\d+/i.test(t) ||
    /\b\d+\s*(\/|out of)\s*\d+\b/.test(t)
  );
}

/** Word tokens for similarity (keeps c++, c#, node.js style tokens). */
function tokenize(text) {
  const tokens = normalize(text).match(/[a-z0-9][a-z0-9+#.]*[a-z0-9+#]|[a-z0-9]/g) || [];
  return tokens.filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** Very light stemmer so "developed"/"developing"/"develops" share a root. */
function stem(token) {
  if (token.length <= 4 || /[+#.]/.test(token)) return token;
  return token
    .replace(/(ies)$/, 'y')
    .replace(/(ing|edly|ed|ly|es|s)$/, '')
    .replace(/(ation|ment)$/, '');
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+(?=[A-Z])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

module.exports = { STOPWORDS, escapeRegex, normalize, termRegex, containsTerm, hasMetric, tokenize, stem, splitSentences, clamp };
