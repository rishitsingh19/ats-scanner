'use strict';

/** REQ-3.1: keyword match score, weighted by importance tier. */

const { prepare, termMatches } = require('../matching');
const { QUALIFICATIONS } = require('../jd/skillsDictionary');

const TIER_WEIGHTS = { required: 3, preferred: 1.5, implied: 1 };

function matchesKeyword(prepared, kw) {
  if (kw.category === 'qualification') {
    const q = QUALIFICATIONS.find((x) => x.term === kw.term);
    if (q) return q.resume.test(prepared.orig);
  }
  return termMatches(prepared, kw.term);
}

/**
 * @param {string} resumeText  full resume text
 * @param {Array<{term, tier, category}>} keywords
 */
function keywordScore(resumeText, keywords) {
  const active = (keywords || []).filter((k) => !k.excluded);
  if (!active.length) {
    return { score: null, matched: [], missing: [], byTier: {} };
  }
  const prepared = prepare(resumeText);
  const matched = [];
  const missing = [];
  const byTier = {
    required: { matched: 0, total: 0 },
    preferred: { matched: 0, total: 0 },
    implied: { matched: 0, total: 0 },
  };
  let earned = 0;
  let possible = 0;

  for (const kw of active) {
    const tier = TIER_WEIGHTS[kw.tier] ? kw.tier : 'implied';
    const w = TIER_WEIGHTS[tier];
    possible += w;
    byTier[tier].total += 1;
    const item = { term: kw.term, tier, category: kw.category || 'custom', context: kw.context || '' };
    if (matchesKeyword(prepared, kw)) {
      earned += w;
      byTier[tier].matched += 1;
      matched.push(item);
    } else {
      missing.push(item);
    }
  }

  const order = { required: 0, preferred: 1, implied: 2 };
  missing.sort((a, b) => order[a.tier] - order[b.tier] || a.term.localeCompare(b.term));
  matched.sort((a, b) => order[a.tier] - order[b.tier] || a.term.localeCompare(b.term));

  return { score: Math.round((earned / possible) * 100), matched, missing, byTier };
}

module.exports = { keywordScore, TIER_WEIGHTS };
