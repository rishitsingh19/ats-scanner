'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { extractKeywords } = require('../src/services/jd/extractKeywords');
const { htmlToText, isPrivateIp } = require('../src/services/jd/fetchUrl');

const JD_TEXT = fs.readFileSync(path.join(__dirname, 'fixtures', 'jd_fullstack.txt'), 'utf8');

test('extracts skills and classifies them by tier (REQ-2.2, REQ-2.3)', () => {
  const r = extractKeywords(JD_TEXT);
  const tier = (t) => (r.keywords.find((k) => k.term === t) || {}).tier;
  assert.equal(r.title, 'Full Stack Developer Intern');
  assert.equal(tier('JavaScript'), 'required');
  assert.equal(tier('PostgreSQL'), 'required');
  assert.equal(tier('Git'), 'required');
  assert.equal(tier("Bachelor's Degree"), 'required');
  assert.equal(tier('Docker'), 'preferred');
  assert.equal(tier('GraphQL'), 'preferred');
  assert.equal(tier('React'), 'implied');
  assert.equal(tier('Python'), undefined, 'terms in the Benefits section are ignored');
  assert.equal(tier('CSS'), undefined, '"CSS" only appears inside "Tailwind CSS"');
  assert.ok(!r.keywords.some((k) => k.term === 'CI' || k.term === 'CD'), 'pieces of CI/CD are not separate terms');
  assert.ok(r.requirementLines.length > 5);
});

test('treats every skill as required when the JD has no headings', () => {
  const r = extractKeywords(
    'We need a data analyst who knows SQL, Excel and Tableau to build weekly dashboards for the sales team. Python is a plus.'
  );
  const tier = (t) => (r.keywords.find((k) => k.term === t) || {}).tier;
  assert.equal(tier('SQL'), 'required');
  assert.equal(tier('Tableau'), 'required');
});

test('recognises unknown tech names that look like products', () => {
  const r = extractKeywords('Requirements:\n- Experience with Supabase, PySpark and Snowplow\n- Knowledge of HubSpot CRM and GCP');
  const terms = r.keywords.map((k) => k.term);
  assert.ok(terms.includes('Supabase'));
  assert.ok(terms.includes('Apache Spark')); // PySpark is an alias
  assert.ok(terms.includes('Google Cloud')); // GCP is an alias
});

test('reads job text from HTML, preferring JobPosting structured data', () => {
  const html = `<html><head><title>Job</title><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"JobPosting","title":"Data Engineer","description":"<p>Build pipelines</p><ul><li>Python</li><li>Airflow</li></ul>"}
  </script></head><body><nav>menu</nav><p>Ignore me</p></body></html>`;
  const r = htmlToText(html);
  assert.equal(r.title, 'Data Engineer');
  assert.match(r.text, /Build pipelines/);
  assert.match(r.text, /- Airflow/);
  assert.doesNotMatch(r.text, /Ignore me/);
});

test('blocks internal network addresses when fetching job URLs', () => {
  assert.ok(isPrivateIp('127.0.0.1'));
  assert.ok(isPrivateIp('10.1.2.3'));
  assert.ok(isPrivateIp('192.168.1.1'));
  assert.ok(isPrivateIp('169.254.169.254'));
  assert.ok(isPrivateIp('::1'));
  assert.ok(!isPrivateIp('142.250.183.14'));
});
