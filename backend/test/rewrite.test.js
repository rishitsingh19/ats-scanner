'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { localRewrite, splitBullet } = require('../src/services/rewrite/localRewriter');
const { selectKeywords } = require('../src/services/rewrite/selectKeywords');
const { cacheKey, generateRewrites } = require('../src/services/rewrite');
const { encrypt, decrypt } = require('../src/utils/crypto');

const MISSING = [
  { term: 'PostgreSQL', tier: 'required', category: 'database', context: 'Experience with PostgreSQL or MySQL and database design' },
  { term: 'MySQL', tier: 'required', category: 'database', context: 'Experience with PostgreSQL or MySQL and database design' },
  { term: 'Docker', tier: 'preferred', category: 'tool', context: 'Experience with Docker, AWS and CI/CD pipelines' },
  { term: 'Figma', tier: 'implied', category: 'tool', context: 'Collaborate with designers in Figma to ship responsive UI' },
];

test('replaces weak openers with a strong action verb', () => {
  assert.deepEqual(splitBullet('Responsible for handling social media posts for clients'), { verb: 'Managed', body: 'social media posts for clients' });
  assert.equal(splitBullet('Worked on the backend of a library system').verb, 'Built');
  assert.equal(splitBullet('Developed a React dashboard').verb, 'Developed');
});

test('produces 3 versions with placeholders instead of invented numbers (REQ-5.3)', () => {
  const out = localRewrite('Worked on the backend of a library management system', ['PostgreSQL']);
  assert.equal(out.length, 3);
  assert.ok(out.every((s) => /\[[^\]]+\]/.test(s)), 'each version has a [placeholder]');
  assert.ok(out.some((s) => s.includes('PostgreSQL')));
  assert.ok(!out.some((s) => /^Worked on/.test(s)));
});

test('only adds keywords that relate to the bullet (no keyword-stuffing)', () => {
  assert.deepEqual(selectKeywords('Responsible for handling social media posts for clients', MISSING), []);
  const db = selectKeywords('Designed the database for a library system using SQL', MISSING);
  assert.equal(db.length, 1, 'only one of the two database alternatives');
  assert.ok(['PostgreSQL', 'MySQL'].includes(db[0]));
});

test('cache key depends on bullet text and keyword set, not order (REQ-5.4)', () => {
  const a = cacheKey('Built an app', ['React', 'Node.js'], 'local');
  assert.equal(a, cacheKey('built  an app', ['Node.js', 'React'], 'local'));
  assert.notEqual(a, cacheKey('Built an app', ['React'], 'local'));
  assert.notEqual(a, cacheKey('Built an app', ['React', 'Node.js'], 'gemini'));
});

test('without a Gemini key, rewrites come from the local writer', async () => {
  const r = await generateRewrites({ bullet: 'Helped with testing the mobile app', keywords: [], jobTitle: 'QA Intern', gemini: { apiKey: '' } });
  assert.equal(r.provider, 'local');
  assert.equal(r.suggestions.length, 3);
});

test('resume files are encrypted at rest and decrypt back exactly (SRS 5.3)', () => {
  const key = 'a'.repeat(64);
  const data = Buffer.from('%PDF-1.4 my resume');
  const enc = encrypt(data, key);
  assert.ok(!enc.includes(data));
  assert.deepEqual(decrypt(enc, key), data);
  assert.throws(() => decrypt(enc, 'b'.repeat(64)));
});
