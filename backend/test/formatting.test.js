'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { checkDocx } = require('../src/services/formatting/docxChecks');
const { checkDates } = require('../src/services/formatting/dateChecks');
const { analyseLayout, toRows } = require('../src/services/formatting/pdfChecks');
const { isStandardFont } = require('../src/services/formatting/flags');
const { readZip } = require('../src/services/formatting/zip');

const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f));

test('reads DOCX files as ZIP archives', () => {
  const zip = readZip(fx('resume_clean.docx'));
  assert.ok(zip.names().includes('word/document.xml'));
  assert.match(zip.readText('word/document.xml'), /Aarav Sharma/);
});

test('a clean single-column DOCX has no layout flags', () => {
  assert.deepEqual(checkDocx(fx('resume_clean.docx')), []);
});

test('flags tables, text boxes, images, columns, fonts and header contact info (REQ-4.1, REQ-4.2)', () => {
  const codes = checkDocx(fx('resume_risky.docx')).map((f) => f.code).sort();
  assert.deepEqual(codes, ['CONTACT_IN_HEADER', 'IMAGES', 'MULTI_COLUMN', 'NON_STANDARD_FONTS', 'TABLES', 'TEXT_BOXES']);
});

test('date checks: missing and mixed formats (REQ-4.3)', () => {
  assert.deepEqual(checkDates('Software Intern | Acme\n• Built things'), [
    checkDates('Software Intern | Acme\n• Built things')[0],
  ]);
  assert.equal(checkDates('Software Intern | Acme\n• Built things')[0].code, 'DATES_MISSING');
  const mixed = checkDates('Developer Intern | Jan 2024 - 03/2024\n• Did X\nAnalyst | 2023');
  assert.ok(mixed.some((f) => f.code === 'DATES_INCONSISTENT'));
  assert.deepEqual(checkDates('Intern | Jan 2024 - Mar 2024\nDeveloper | June 2024 - Present'), []);
});

test('font names: common fonts pass, decorative fonts are flagged', () => {
  assert.ok(isStandardFont('ABCDEF+Calibri-Bold'));
  assert.ok(isStandardFont('TimesNewRomanPSMT'));
  assert.ok(isStandardFont('ArialMT'));
  assert.ok(!isStandardFont('Papyrus'));
  assert.ok(!isStandardFont('XYZABC+ComicSansMS'));
});

function item(str, x, y) {
  return { str, transform: [1, 0, 0, 1, x, y], width: str.length * 5 };
}

test('PDF layout: two-column pages are detected, single-column pages are not', () => {
  const twoCol = [];
  const oneCol = [];
  for (let i = 0; i < 20; i += 1) {
    const y = 800 - i * 14;
    twoCol.push(item('Python, SQL', 40, y), item('Built a dashboard used by the sales team', 250, y));
    oneCol.push(item('Built a dashboard used by the sales team every week', 40, y));
  }
  const page = (items) => ({ rows: toRows(items), width: 595 });
  assert.ok(analyseLayout([page(twoCol)]).splitRatio > 0.9);
  assert.equal(analyseLayout([page(oneCol)]).splitRatio, 0);
});
