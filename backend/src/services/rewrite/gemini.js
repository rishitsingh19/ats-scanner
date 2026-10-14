'use strict';

/** Rewrite suggestions with Google Gemini 2.5 Flash (SRS 3.3). Returns null on any failure. */

function buildPrompt({ bullet, keywords, jobTitle }) {
  return [
    'You are an expert resume writer helping a job seeker tailor one resume bullet point to a job.',
    `Target job: ${jobTitle || 'not specified'}`,
    `Original bullet: "${bullet}"`,
    `Missing keywords from the job description that may fit: ${keywords.length ? keywords.join(', ') : '(none)'}`,
    '',
    'Write exactly 3 different rewritten versions of the bullet. Rules:',
    '- Start each with a strong past-tense action verb.',
    '- Keep every claim truthful to the original. Do NOT invent tools, numbers, employers or results.',
    '- Where a measurable result would help, insert a placeholder in square brackets, e.g. [X%] or [N users].',
    '- Use only the keywords that genuinely fit what the person did, at most 2 per version, written naturally. No keyword-stuffing.',
    '- Each version must be one sentence, at most 30 words, with no ending period.',
    '',
    'Respond with JSON only, in this shape: {"suggestions": ["...", "...", "..."], "keywords_used": ["..."]}',
  ].join('\n');
}

async function geminiRewrite({ bullet, keywords, jobTitle }, { apiKey, model, timeoutMs = 20000 }) {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt({ bullet, keywords, jobTitle }) }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json', maxOutputTokens: 800 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[gemini] API returned ${res.status}; using local rewrites.`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const json = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
    const suggestions = (json.suggestions || []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 3);
    if (suggestions.length < 2) return null;
    const used = Array.isArray(json.keywords_used) ? json.keywords_used.filter((k) => keywords.includes(k)) : keywords;
    return { suggestions, keywordsUsed: used };
  } catch (err) {
    console.warn('[gemini] request failed; using local rewrites:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { geminiRewrite, buildPrompt };
