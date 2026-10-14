'use strict';

const { selectKeywords } = require('./selectKeywords');
const { localRewrite } = require('./localRewriter');
const { geminiRewrite } = require('./gemini');
const { sha256 } = require('../../utils/crypto');

/** REQ-5.4: the cache key is the bullet text + the exact keyword set (+ which writer produced it). */
function cacheKey(bullet, keywords, provider) {
  const norm = bullet.toLowerCase().replace(/\s+/g, ' ').trim();
  const kw = [...keywords].map((k) => k.toLowerCase()).sort().join(',');
  return sha256(`${provider}|${norm}|${kw}`);
}

function planRewrite(bullet, missing, gemini) {
  const keywords = selectKeywords(bullet, missing);
  const provider = gemini && gemini.apiKey ? 'gemini' : 'local';
  return { keywords, provider, key: cacheKey(bullet, keywords, provider) };
}

/** REQ-5.3: 2-3 rewritten versions for one bullet. */
async function generateRewrites({ bullet, keywords, jobTitle, gemini }) {
  if (gemini && gemini.apiKey) {
    const ai = await geminiRewrite({ bullet, keywords, jobTitle }, gemini);
    if (ai) return { suggestions: ai.suggestions, keywordsAddressed: ai.keywordsUsed, provider: 'gemini' };
  }
  return { suggestions: localRewrite(bullet, keywords), keywordsAddressed: keywords, provider: 'local' };
}

module.exports = { planRewrite, generateRewrites, cacheKey };
