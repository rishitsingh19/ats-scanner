'use strict';

/** Scoring engine (SRS 4.3): orchestrates the three independently testable sub-scores. */

const { keywordScore } = require('./keywordScore');
const { semanticScore } = require('./semanticScore');
const { completenessScore } = require('./completenessScore');
const { compositeScore, scoreBand } = require('./composite');

function resumeUnitsFor(parsed) {
  const units = (parsed.bullets || []).map((b) => b.text);
  const s = parsed.sections || {};
  for (const key of ['summary', 'skills', 'certifications']) {
    if (s[key]) units.push(...s[key].split('\n').filter((l) => l.trim().length > 10));
  }
  if (parsed.lowConfidence || units.length < 3) {
    // REQ-1.4 fallback: whole-document chunks
    units.push(...(parsed.rawText || '').split('\n').filter((l) => l.trim().length > 25));
  }
  return units;
}

/**
 * @param {object} p
 * @param {object} p.parsed       resume parse result (sections, bullets, contact, rawText, lowConfidence)
 * @param {object} p.jd           { raw_text, extracted_keywords: { keywords, requirementLines } }
 * @param {object} p.weights      { keyword, semantic, completeness }
 * @param {object} [p.hf]         Hugging Face settings
 */
async function runScoring({ parsed, jd, weights, hf }) {
  const started = Date.now();
  const extracted = jd.extracted_keywords || {};
  const resumeText = parsed.rawText || '';

  const kw = keywordScore(resumeText, extracted.keywords || []);
  const sem = await semanticScore({
    resumeUnits: resumeUnitsFor(parsed),
    requirementLines: extracted.requirementLines || [],
    resumeText,
    jdText: jd.raw_text || '',
    hf,
  });
  const comp = completenessScore(parsed);

  const composite = compositeScore({ keyword: kw.score, semantic: sem.score, completeness: comp.score }, weights);

  const weakBullets = (parsed.bullets || []).filter((b) => !b.hasMetric).map((b) => ({ id: b.id, section: b.section, text: b.text }));

  return {
    composite: composite.score,
    band: scoreBand(composite.score),
    weightsUsed: composite.weightsUsed,
    keyword: { score: kw.score, byTier: kw.byTier, matched: kw.matched, missing: kw.missing },
    semantic: { score: sem.score, method: sem.method, weakAreas: sem.weakAreas },
    completeness: comp,
    weakBullets,
    totalBullets: (parsed.bullets || []).length,
    lowConfidence: Boolean(parsed.lowConfidence),
    experienceYearsAsked: extracted.experienceYears ?? null,
    durationMs: Date.now() - started,
  };
}

module.exports = { runScoring, resumeUnitsFor };
