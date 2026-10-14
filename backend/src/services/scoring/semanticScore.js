'use strict';

/**
 * REQ-3.2: semantic ("relevance") match score.
 * For each job requirement, find the most similar piece of the resume (cosine similarity of embeddings),
 * then average across requirements (required ones count double) and blend with whole-document similarity.
 */

const { hfEmbed, cosine } = require('./embeddings');
const { tfidfVectors, sparseCosine } = require('./tfidf');
const { clamp } = require('../textUtils');

// Raw cosine values differ between methods, so each is mapped onto 0-100 with its own calibration range.
const CALIBRATION = {
  huggingface: { low: 0.2, high: 0.65 },
  local: { low: 0.03, high: 0.23 },
};
const TIER_WEIGHT = { required: 2, preferred: 1, implied: 1 };

function computeFromSim(sim, reqLines, unitCount, method) {
  // sim(i, j): similarity between requirement i and resume unit j; sim(i, 'doc') for documents
  const perReq = reqLines.map((r, i) => {
    let best = 0;
    for (let j = 0; j < unitCount; j += 1) best = Math.max(best, sim(i, j));
    return { text: r.text, tier: r.tier, best };
  });
  let num = 0;
  let den = 0;
  for (const r of perReq) {
    const w = TIER_WEIGHT[r.tier] || 1;
    num += r.best * w;
    den += w;
  }
  const avgBest = den ? num / den : 0;
  const docSim = sim('jd', 'resume');
  const raw = 0.75 * avgBest + 0.25 * docSim;
  const { low, high } = CALIBRATION[method];
  const score = Math.round(clamp(((raw - low) / (high - low)) * 100));

  const normalised = (v) => clamp(((v - low) / (high - low)) * 100);
  const weakAreas = perReq
    .filter((r) => r.tier !== 'implied' || perReq.length < 6)
    .map((r) => ({ text: r.text, tier: r.tier, match: Math.round(normalised(r.best)) }))
    .filter((r) => r.match < 50)
    .sort((a, b) => a.match - b.match)
    .slice(0, 4);

  return { score, method, raw: Number(raw.toFixed(4)), weakAreas };
}

/**
 * @param {object} p
 * @param {string[]} p.resumeUnits   bullets, summary and skills lines
 * @param {{text, tier}[]} p.requirementLines  from the JD
 * @param {string} p.resumeText
 * @param {string} p.jdText
 * @param {{token, model, timeoutMs}} [p.hf]
 */
async function semanticScore({ resumeUnits, requirementLines, resumeText, jdText, hf }) {
  const units = resumeUnits.filter((u) => u && u.trim().length > 10).slice(0, 60);
  const reqs = requirementLines.length ? requirementLines.slice(0, 40) : [{ text: jdText.slice(0, 1500), tier: 'required' }];
  if (!units.length) units.push(resumeText.slice(0, 3000));

  const texts = [...reqs.map((r) => r.text), ...units, jdText.slice(0, 4000), resumeText.slice(0, 4000)];
  const R = reqs.length;
  const U = units.length;
  const idx = (k) => (k === 'jd' ? R + U : k === 'resume' ? R + U + 1 : null);

  const vectors = hf && hf.token ? await hfEmbed(texts, hf) : null;
  if (vectors) {
    const sim = (i, j) => (typeof i === 'string' ? cosine(vectors[idx(i)], vectors[idx(j)]) : cosine(vectors[i], vectors[R + j]));
    return computeFromSim(sim, reqs, U, 'huggingface');
  }

  const sparse = tfidfVectors(texts);
  const sim = (i, j) => (typeof i === 'string' ? sparseCosine(sparse[idx(i)], sparse[idx(j)]) : sparseCosine(sparse[i], sparse[R + j]));
  return computeFromSim(sim, reqs, U, 'local');
}

module.exports = { semanticScore, CALIBRATION };
