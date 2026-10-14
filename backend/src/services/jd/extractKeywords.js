'use strict';

/**
 * Job description parsing (SRS 4.2).
 *  - REQ-2.2: extracts skills, tools and qualifications using a gazetteer (dictionary-based named-entity
 *    recognition) plus pattern-based detection of unknown tech names (CamelCase, dotted names, acronyms).
 *  - REQ-2.3: classifies every term as required, preferred or implied, using section headings and
 *    in-sentence cues ("must", "nice to have", "a plus" ...).
 */

const { DICTIONARY, QUALIFICATIONS } = require('./skillsDictionary');
const { prepare, variantMatches, variantRegex, countTerm } = require('../matching');
const { escapeRegex } = require('../textUtils');

const TIER_RANK = { required: 3, preferred: 2, implied: 1 };

const HEADINGS = [
  ['skip', /\b(benefits|perks|what we offer|compensation|salary|stipend|equal opportunity|eeo|about (the )?company|about us|why (join|work)|our culture|how to apply|location|work mode|ctc)\b/i],
  ['preferred', /\b(preferred|nice[- ]to[- ]haves?|bonus|good[- ]to[- ]haves?|plus points?|desirable|desired|additional (skills|qualifications)|extra credit)\b/i],
  ['required', /\b(requirements?|qualifications?|must[- ]haves?|what you('ll)? (need|bring)|who you are|minimum|basic qualifications|required|skills (required|needed)|eligibility|you (have|bring|should have)|what we('re| are) looking for|key skills|skills|technical skills|competencies|experience)\b/i],
  ['implied', /\b(responsibilit\w*|what you('ll| will) do|the role|about (the role|you)|job description|overview|day[- ]to[- ]day|your impact|duties|key result|kras?|role summary|summary)\b/i],
];

const PREFERRED_CUE = /\b(preferred|nice[- ]to[- ]have|good[- ]to[- ]have|is a plus|a plus|an advantage|advantageous|bonus|ideally|desirable|would be great)\b/i;
// Softer cues only downgrade a line when it is not already inside a "Requirements" section.
const SOFT_PREFERRED_CUE = /\b(familiarity with|exposure to|basic understanding of|awareness of)\b/i;
const REQUIRED_CUE = /\b(must|required|mandatory|essential|minimum|need to have|proficien\w*|strong|solid|expertise|hands[- ]on|in[- ]depth|deep (knowledge|understanding)|experience (with|in|using|building))\b/i;

const ACRONYM_STOPLIST = new Set(
  (
    'USA UK US EU CEO CTO CFO COO VP HR PTO EEO EOE LLC INC LTD PVT WFH WFO CTC LPA PPO FTE JD YOE IST PST EST ' +
    'GMT UTC NA TBD ASAP FAQ B2B B2C MNC PAN ID II III IV OK APAC EMEA ESOP KPI KPIS OKR OKRS ROI SLA SLAS ' +
    'AND OR THE FOR YOU WE OUR NOT ALL NEW KEY TOP BTECH MTECH BE ME MBA MCA BCA BSC MSC PHD CGPA GPA CV ' +
    'DOB NOC IT CS CSE ECE EEE MUJ IIT NIT'
  ).split(/\s+/)
);

function isHeading(line) {
  const t = line.trim();
  if (!t || t.length > 70) return false;
  if (/[.!?]$/.test(t) && !/:$/.test(t)) return false;
  const words = t.replace(/[:\-–—#*]+/g, ' ').trim().split(/\s+/);
  if (words.length > 9) return false;
  return /:$/.test(t) || /^#+\s/.test(t) || /^[A-Z][A-Za-z'&/ ,()-]+$/.test(t) || t === t.toUpperCase();
}

function headingContext(line) {
  for (const [ctx, re] of HEADINGS) if (re.test(line)) return ctx;
  return null;
}

function cleanLine(line) {
  return line.replace(/^\s*([•\-*–—▪●◦‣➢✓✔>]|\d+[.)])\s*/, '').trim();
}

/** Split pasted JD text into logical lines; long paragraphs are split into sentences. */
function toLines(text) {
  const out = [];
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Split paragraphs into sentences so a cue like "is a plus" only affects its own sentence.
    for (const s of line.split(/(?<=[.!?;])\s+(?=[A-Z])/)) if (s.trim()) out.push(s.trim());
  }
  return out;
}

/** Pattern-based entity recognition for tech names that are not in the dictionary. */
function unknownEntities(line) {
  const found = new Set();
  const tokens = line.match(/[A-Za-z][A-Za-z0-9+#.]*[A-Za-z0-9+#]/g) || [];
  for (let tok of tokens) {
    tok = tok.replace(/\.$/, '');
    const camel = /^[A-Z]?[a-z]+[A-Z][A-Za-z0-9]*$/.test(tok) && tok.length >= 4; // GitLab, PySpark, OpenAI
    const dotted = /^[A-Za-z]+\.(js|ts|io|net|py)$/i.test(tok); // Nuxt.js, Socket.io
    const acronym = /^[A-Z][A-Z0-9]{1,5}$/.test(tok) && !ACRONYM_STOPLIST.has(tok); // SQL, GCP, SAP
    if (!(camel || dotted || acronym)) continue;
    const p = prepare(tok);
    if (DICTIONARY.some((e) => e.variants.some((v) => variantMatches(p, v)))) continue; // already known
    found.add(tok);
  }
  return [...found];
}

/**
 * Drops a term that only appears as part of a longer matched term in the same line,
 * e.g. "CSS" inside "Tailwind CSS" or "React" inside "React Native".
 */
function removeNested(entries, prepared) {
  return entries.filter((x) => {
    const xName = x.canonical.toLowerCase();
    return !entries.some((y) => {
      if (y === x) return false;
      const yName = y.canonical.toLowerCase();
      if (yName.length <= xName.length || !new RegExp(`(^|\\s)${escapeRegex(xName)}(\\s|$)`).test(yName)) return false;
      return countTerm(prepared, x.canonical) <= countTerm(prepared, y.canonical);
    });
  });
}

/** Blank out already-recognised terms so pieces of them ("CI", "CD" from "CI/CD") aren't re-detected. */
function maskMatches(text, entries) {
  let out = text;
  for (const e of entries) {
    for (const v of e.variants) {
      const re = variantRegex(v);
      out = out.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), ' ');
    }
  }
  return out;
}

function guessTitle(lines) {
  for (const l of lines.slice(0, 8)) {
    const m = l.match(/^(job title|title|position|role|designation)\s*[:\-–]\s*(.{3,80})$/i);
    if (m) return m[2].trim();
  }
  const first = lines.find((l) => l.length >= 3 && l.length <= 80 && !/[.:]$/.test(l));
  return first ? first.replace(/^#+\s*/, '') : 'Untitled job';
}

/**
 * @param {string} text  plain-text job description
 * @returns {{title, keywords, requirementLines, experienceYears, hasStructure}}
 */
function extractKeywords(text) {
  const lines = toLines(text);
  const hasRequiredHeading = lines.some((l) => isHeading(l) && headingContext(l) === 'required');
  const defaultTier = hasRequiredHeading ? 'implied' : 'required';

  const terms = new Map(); // canonical -> keyword
  const requirementLines = [];
  let experienceYears = null;
  let context = null; // null | 'skip' | tier

  const add = (term, category, tier, line) => {
    const key = term.toLowerCase();
    const prev = terms.get(key);
    if (!prev) {
      terms.set(key, { term, category, tier, count: 1, context: line.slice(0, 220) });
    } else {
      prev.count += 1;
      if (TIER_RANK[tier] > TIER_RANK[prev.tier]) {
        prev.tier = tier;
        prev.context = line.slice(0, 220);
      }
    }
  };

  for (const rawLine of lines) {
    if (isHeading(rawLine)) {
      const ctx = headingContext(rawLine);
      if (ctx) {
        context = ctx;
        continue;
      }
    }
    if (context === 'skip') continue;

    const line = cleanLine(rawLine);
    if (!line) continue;

    let tier = context || defaultTier;
    if (PREFERRED_CUE.test(line)) tier = 'preferred';
    else if (SOFT_PREFERRED_CUE.test(line) && tier !== 'required') tier = 'preferred';
    else if (tier === 'implied' && REQUIRED_CUE.test(line) && !hasRequiredHeading) tier = 'required';

    const yrs = line.match(/(\d{1,2})\s*\+?\s*(?:-|to)?\s*(?:\d{1,2})?\s*\+?\s*years?/i);
    if (yrs && /experience|exp\b/i.test(line)) {
      const n = Number(yrs[1]);
      if (experienceYears === null || n > experienceYears) experienceYears = n;
    }

    if (line.length >= 25) requirementLines.push({ text: line, tier });

    const prepared = prepare(line);
    const matched = DICTIONARY.filter((entry) => entry.variants.some((v) => variantMatches(prepared, v)));
    for (const entry of removeNested(matched, prepared)) add(entry.canonical, entry.category, tier, line);
    for (const q of QUALIFICATIONS) {
      if (q.jd.test(line)) add(q.term, 'qualification', tier, line);
    }
    if (tier !== 'implied') {
      for (const ent of unknownEntities(maskMatches(prepared.orig, matched))) add(ent, 'tool', tier, line);
    }
  }

  const result = [...terms.values()]
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 60);

  return {
    title: guessTitle(lines),
    keywords: result,
    requirementLines: requirementLines.slice(0, 40),
    experienceYears,
    hasStructure: hasRequiredHeading,
  };
}

module.exports = { extractKeywords, TIER_RANK };
