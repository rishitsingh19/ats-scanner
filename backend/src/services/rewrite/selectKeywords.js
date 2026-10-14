'use strict';

/** Picks which missing keywords fit a given bullet, so rewrites stay natural (no keyword-stuffing). */

const { tfidfVectors, sparseCosine } = require('../scoring/tfidf');
const { termMatches } = require('../matching');

const TIER_BONUS = { required: 0.15, preferred: 0.07, implied: 0 };
const SKIP_CATEGORIES = new Set(['qualification', 'soft']);

function selectKeywords(bulletText, missing, max = 3) {
  const candidates = (missing || []).filter((k) => !SKIP_CATEGORIES.has(k.category) && !termMatches(bulletText, k.term));
  if (!candidates.length) return [];
  const vecs = tfidfVectors([bulletText, ...candidates.map((k) => `${k.term} ${k.context || ''}`)]);
  const ranked = candidates
    .map((k, i) => ({ k, rel: sparseCosine(vecs[0], vecs[i + 1]) + (TIER_BONUS[k.tier] || 0) }))
    .sort((a, b) => b.rel - a.rel);
  // Only keywords that actually relate to what the bullet describes; otherwise add none (no stuffing).
  const relevant = ranked.filter((r) => r.rel > (TIER_BONUS[r.k.tier] || 0) + 0.02);
  // One term per category, so alternatives like "PostgreSQL or MySQL" aren't both forced in.
  const seen = new Set();
  const picked = [];
  for (const r of relevant) {
    const cat = r.k.category || 'custom';
    if (cat !== 'custom' && seen.has(cat)) continue;
    seen.add(cat);
    picked.push(r.k.term);
    if (picked.length >= max) break;
  }
  return picked;
}

module.exports = { selectKeywords };
