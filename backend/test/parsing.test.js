'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { sectionize, detectHeading } = require('../src/services/parsing/sectionizer');
const { hasMetric } = require('../src/services/textUtils');
const { termMatches } = require('../src/services/matching');

const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

test('detects common section headings, including spaced-out ones', () => {
  assert.equal(detectHeading('WORK EXPERIENCE'), 'experience');
  assert.equal(detectHeading('Technical Skills:'), 'skills');
  assert.equal(detectHeading('E D U C A T I O N'), 'education');
  assert.equal(detectHeading('Academic Projects'), 'projects');
  assert.equal(detectHeading('Built a web app in React'), null);
});

test('segments a resume into sections, contact info and bullets (REQ-1.2, REQ-1.3)', () => {
  const p = sectionize(fx('resume_strong.txt'));
  for (const s of ['summary', 'skills', 'experience', 'education', 'projects', 'certifications']) {
    assert.ok(p.detectedSections.includes(s), `missing ${s}`);
  }
  assert.equal(p.lowConfidence, false);
  assert.equal(p.contact.email, 'aarav.sharma@gmail.com');
  assert.ok(p.contact.phone);
  assert.ok(p.contact.linkedin);
  assert.equal(p.bullets.length, 8);
  assert.equal(new Set(p.bullets.map((b) => b.id)).size, 8, 'bullet ids are unique');
  assert.ok(p.bullets.every((b) => !b.text.startsWith('•')));
});

test('merges bullet lines that wrapped onto a second line', () => {
  const p = sectionize('EXPERIENCE\n• Built a dashboard for the sales team that\nshows weekly revenue by region\n• Fixed 12 bugs\nEDUCATION\nB.Tech CSE');
  assert.equal(p.bullets[0].text, 'Built a dashboard for the sales team that shows weekly revenue by region');
});

test('falls back to whole-document scoring when sections are not found (REQ-1.4)', () => {
  const p = sectionize(
    'Jane Doe\njane@example.com\nI am a developer who has built several web applications using React and Node for small businesses.\nI also worked on data pipelines in Python for an analytics startup in Bangalore.'
  );
  assert.equal(p.lowConfidence, true);
  assert.ok(p.bullets.length >= 1);
  assert.ok(p.bullets.every((b) => b.section === 'document'));
});

test('hasMetric recognises quantified impact (REQ-5.2)', () => {
  assert.ok(hasMetric('Cut load time by 40%'));
  assert.ok(hasMetric('Served 1,200 customers'));
  assert.ok(hasMetric('Saved ₹2 lakh per year'));
  assert.ok(hasMetric('Managed a team of 5 people'));
  assert.ok(!hasMetric('Responsible for handling social media posts'));
  assert.ok(!hasMetric('Worked with React and Node.js'));
});

test('term matching handles symbols and case-sensitive short names', () => {
  assert.ok(termMatches('Languages: C++, Python', 'C++'));
  assert.ok(!termMatches('Languages: C++, Python', 'C'));
  assert.ok(termMatches('Languages: C, C++', 'C'));
  assert.ok(termMatches('Backend in Go and Rust', 'Go'));
  assert.ok(!termMatches('Ready to go live next week', 'Go'));
  assert.ok(!termMatches('Spring internship at Acme', 'Spring'));
  assert.ok(termMatches('REST APIs with Node', 'REST API'));
  assert.ok(!termMatches('the rest of the team', 'REST API'));
  assert.ok(termMatches('Deployed on k8s', 'Kubernetes'));
  assert.ok(!termMatches('Node.js', 'JavaScript'), '"js" inside Node.js is not JavaScript');
});
