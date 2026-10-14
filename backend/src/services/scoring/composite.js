'use strict';

/**
 * REQ-3.4: combine sub-scores into one 0-100 score.
 * Weights come from .env (Appendix C, TBD #1). If a sub-score is unavailable (e.g. the JD had no
 * recognisable keywords), its weight is shared among the others instead of counting as zero.
 */
function compositeScore(sub, weights) {
  const parts = [
    ['keyword', sub.keyword],
    ['semantic', sub.semantic],
    ['completeness', sub.completeness],
  ].filter(([, v]) => typeof v === 'number' && Number.isFinite(v));

  const totalWeight = parts.reduce((a, [k]) => a + weights[k], 0);
  if (!parts.length || totalWeight <= 0) return { score: 0, weightsUsed: {} };

  const weightsUsed = {};
  let score = 0;
  for (const [k, v] of parts) {
    weightsUsed[k] = weights[k] / totalWeight;
    score += v * weightsUsed[k];
  }
  return { score: Math.round(score), weightsUsed };
}

function scoreBand(score) {
  if (score >= 80) return { label: 'Strong match', tone: 'good' };
  if (score >= 65) return { label: 'Good match', tone: 'ok' };
  if (score >= 45) return { label: 'Needs work', tone: 'warn' };
  return { label: 'Weak match', tone: 'bad' };
}

module.exports = { compositeScore, scoreBand };
