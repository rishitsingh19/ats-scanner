'use strict';

/**
 * Local, dependency-free text vectors (TF-IDF over stemmed words and word pairs).
 * Used for the relevance score when no Hugging Face token is configured, or if the API is unavailable.
 */

const { tokenize, stem } = require('../textUtils');

function features(text) {
  const words = tokenize(text).map(stem);
  const feats = [...words];
  for (let i = 0; i < words.length - 1; i += 1) feats.push(`${words[i]}_${words[i + 1]}`);
  return feats;
}

/** Returns one sparse vector (Map term->weight, L2-normalised) per input text. */
function tfidfVectors(texts) {
  const docs = texts.map(features);
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const n = docs.length;
  return docs.map((d) => {
    const tf = new Map();
    for (const t of d) tf.set(t, (tf.get(t) || 0) + 1);
    const vec = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const idf = Math.log((1 + n) / (1 + df.get(t))) + 1;
      const w = (1 + Math.log(c)) * idf * (t.includes('_') ? 1.5 : 1);
      vec.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of vec) vec.set(t, w / norm);
    return vec;
  });
}

function sparseCosine(a, b) {
  let dot = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, w] of small) {
    const v = big.get(t);
    if (v) dot += w * v;
  }
  return dot;
}

module.exports = { tfidfVectors, sparseCosine };
