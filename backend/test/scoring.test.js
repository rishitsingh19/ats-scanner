'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { sectionize } = require('../src/services/parsing/sectionizer');
const { extractKeywords } = require('../src/services/jd/extractKeywords');
const { keywordScore } = require('../src/services/scoring/keywordScore');
const { semanticScore } = require('../src/services/scoring/semanticScore');
const { completenessScore } = require('../src/services/scoring/completenessScore');
const { compositeScore } = require('../src/services/scoring/composite');
const { runScoring } = require('../src/services/scoring');

const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const JD_TEXT = fx('jd_fullstack.txt');
const JD = { raw_text: JD_TEXT, extracted_keywords: extractKeywords(JD_TEXT) };
const WEIGHTS = { keyword: 0.5, semantic: 0.3, completeness: 0.2 };

test('keyword score weights required terms more than implied ones', () => {
  const kws = [
    { term: 'Python', tier: 'required' },
    { term: 'Docker', tier: 'implied' },
  ];
  assert.equal(keywordScore('Skilled in Python', kws).score, 75); // 3 / (3 + 1)
  assert.equal(keywordScore('Used Docker daily', kws).score, 25); // 1 / 4
});

test('keyword score understands aliases and avoids false matches', () => {
  const kws = [
    { term: 'JavaScript', tier: 'required' },
    { term: 'PostgreSQL', tier: 'required' },
    { term: 'Java', tier: 'required' },
  ];
  const r = keywordScore('Built APIs in JS with a Postgres database', kws);
  assert.deepEqual(r.matched.map((m) => m.term).sort(), ['JavaScript', 'PostgreSQL']);
  assert.deepEqual(r.missing.map((m) => m.term), ['Java']); // "JS" must not count as Java
});

test('keyword score returns null when there are no keywords', () => {
  assert.equal(keywordScore('anything', []).score, null);
});

test('local relevance score ranks a matching resume above an unrelated one', async () => {
  const strong = sectionize(fx('resume_strong.txt'));
  const weak = sectionize(fx('resume_weak.txt'));
  const args = (p) => ({
    resumeUnits: p.bullets.map((b) => b.text).concat(p.sections.skills.split('\n')),
    requirementLines: JD.extracted_keywords.requirementLines,
    resumeText: p.rawText,
    jdText: JD_TEXT,
  });
  const s = await semanticScore(args(strong));
  const w = await semanticScore(args(weak));
  assert.equal(s.method, 'local');
  assert.ok(s.score > 55, `strong resume relevance ${s.score}`);
  assert.ok(w.score < 20, `weak resume relevance ${w.score}`);
});

test('completeness rewards sections and penalises missing metrics', () => {
  const strong = completenessScore(sectionize(fx('resume_strong.txt')));
  const weak = completenessScore(sectionize(fx('resume_weak.txt')));
  assert.ok(strong.score >= 90, `strong completeness ${strong.score}`);
  assert.ok(weak.score < 60, `weak completeness ${weak.score}`);
  assert.ok(weak.items.find((i) => i.key === 'skills' && !i.complete));
});

test('composite score is on 0-100 and re-shares weight of a missing sub-score', () => {
  assert.equal(compositeScore({ keyword: 100, semantic: 100, completeness: 100 }, WEIGHTS).score, 100);
  assert.equal(compositeScore({ keyword: 80, semantic: 60, completeness: 40 }, WEIGHTS).score, 66);
  const r = compositeScore({ keyword: null, semantic: 60, completeness: 40 }, WEIGHTS);
  assert.equal(r.score, 52); // 60*0.6 + 40*0.4
  assert.equal(r.weightsUsed.keyword, undefined);
});

test('full scoring: strong resume beats weak resume and finishes fast (REQ-3.5)', async () => {
  const strong = await runScoring({ parsed: sectionize(fx('resume_strong.txt')), jd: JD, weights: WEIGHTS });
  const weak = await runScoring({ parsed: sectionize(fx('resume_weak.txt')), jd: JD, weights: WEIGHTS });
  assert.ok(strong.composite >= 65, `strong composite ${strong.composite}`);
  assert.ok(weak.composite < 30, `weak composite ${weak.composite}`);
  assert.ok(strong.composite <= 100 && weak.composite >= 0);
  assert.ok(strong.durationMs < 8000);
  assert.ok(strong.keyword.missing.every((m) => ['required', 'preferred', 'implied'].includes(m.tier)));
  // REQ-5.2: bullets without numbers are flagged
  assert.ok(strong.weakBullets.length >= 1);
  assert.equal(weak.weakBullets.length, 3);
});
