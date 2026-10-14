'use strict';

/**
 * Hugging Face sentence-transformers embeddings (SRS 3.3).
 * Returns null when no token is configured or the API fails, so the caller can fall back to local scoring.
 */

function meanPool(tokens) {
  const dim = tokens[0].length;
  const out = new Array(dim).fill(0);
  for (const t of tokens) for (let i = 0; i < dim; i += 1) out[i] += t[i];
  return out.map((v) => v / tokens.length);
}

function toSentenceVector(v) {
  // Sentence models return [dim]; some return token vectors [tokens][dim] that need pooling.
  if (Array.isArray(v[0])) return Array.isArray(v[0][0]) ? meanPool(v[0]) : meanPool(v);
  return v;
}

async function hfEmbed(texts, { token, model, timeoutMs = 6000 }) {
  if (!token || !texts.length) return null;
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: texts.map((t) => t.slice(0, 1000)), options: { wait_for_model: true } }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[embeddings] Hugging Face returned ${res.status}; using local relevance scoring.`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length !== texts.length) return null;
    return data.map(toSentenceVector);
  } catch (err) {
    console.warn('[embeddings] Hugging Face request failed; using local relevance scoring:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

module.exports = { hfEmbed, cosine, toSentenceVector };
