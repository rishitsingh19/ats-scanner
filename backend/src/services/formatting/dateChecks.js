'use strict';

/** REQ-4.3: find missing or inconsistent date formats in the experience section. */

const { makeFlag } = require('./flags');

const MONTHS_FULL = 'january|february|march|april|may|june|july|august|september|october|november|december';
const MONTHS_ABBR = 'jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

const FORMATS = [
  ['Month YYYY', new RegExp(`\\b(${MONTHS_FULL})\\s*,?\\s*(19|20)\\d{2}\\b`, 'gi')],
  ['Mon YYYY', new RegExp(`\\b(${MONTHS_ABBR})\\.?\\s*'?,?\\s*((19|20)\\d{2}|\\d{2})\\b`, 'gi')],
  ['MM/YYYY', /\b(0?[1-9]|1[0-2])\s*\/\s*(19|20)\d{2}\b/g],
  ['MM-YYYY', /\b(0?[1-9]|1[0-2])\s*-\s*(19|20)\d{2}\b/g],
  ['YYYY-MM', /\b(19|20)\d{2}\s*[-/]\s*(0[1-9]|1[0-2])\b(?!\s*[-/]\s*\d)/g],
  ['DD/MM/YYYY', /\b\d{1,2}[/.-]\d{1,2}[/.-](19|20)\d{2}\b/g],
];

function findFormats(text) {
  let rest = String(text || '');
  const used = {};
  // Most specific first; blank out what was matched so "Jan 2024" isn't also counted as a bare year.
  for (const [name, re] of [FORMATS[5], ...FORMATS.slice(0, 5)]) {
    const m = rest.match(re);
    if (m) {
      used[name] = m.length;
      rest = rest.replace(re, ' ');
    }
  }
  const bareYears = (rest.match(/\b(19|20)\d{2}\b/g) || []).length;
  if (bareYears) used['YYYY only'] = bareYears;
  return used;
}

/** @param {string} experienceText  text of the experience section */
function checkDates(experienceText) {
  const flags = [];
  const text = String(experienceText || '');
  if (!text.trim()) return flags;

  const used = findFormats(text);
  const names = Object.keys(used);
  const total = Object.values(used).reduce((a, b) => a + b, 0);

  if (total === 0) {
    flags.push(makeFlag('DATES_MISSING', { evidence: 'No dates found in the experience section' }));
    return flags;
  }

  // "Jan 2024" and "January 2024" are treated as the same style (both spell the month).
  // Mixing spelled months with numbers (01/2024) or bare years (2024) is flagged.
  const family = new Set(names.map((n) => (n === 'Month YYYY' || n === 'Mon YYYY' ? 'month-name' : n)));
  if (family.size > 1) {
    flags.push(makeFlag('DATES_INCONSISTENT', { evidence: `Formats used: ${names.join(', ')}` }));
  }

  // Each role normally has two dates (start and end/"Present"). Very few dates for many lines suggests gaps.
  const roleLines = text.split('\n').filter((l) => !/^\s*([•\-*–▪●◦‣➢➤►✓✔■]|\d+[.)])\s/.test(l) && /\b(intern|engineer|developer|analyst|manager|associate|lead|consultant|assistant|designer|trainee|executive|specialist|coordinator|scientist|officer|founder|head|member|volunteer)\b/i.test(l) && l.length < 120);
  const present = (text.match(/\b(present|current|now|ongoing|till date)\b/gi) || []).length;
  if (roleLines.length >= 2 && total + present < roleLines.length) {
    flags.push(makeFlag('DATES_MISSING', { evidence: `${roleLines.length} roles but only ${total + present} dates found` }));
  }
  return flags;
}

module.exports = { checkDates, findFormats };
