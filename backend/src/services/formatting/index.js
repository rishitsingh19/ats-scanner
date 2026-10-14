'use strict';

const { checkDocx } = require('./docxChecks');
const { checkPdf } = require('./pdfChecks');
const { checkDates } = require('./dateChecks');
const { makeFlag } = require('./flags');

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/** Runs all ATS-compatibility checks (SRS 4.4) and returns a de-duplicated, sorted list of flags. */
async function runFormattingChecks({ buffer, kind, parsed }) {
  const layout = kind === 'pdf' ? await checkPdf(buffer) : checkDocx(buffer);
  const flags = [...layout, ...checkDates(parsed.sections.experience)];
  if (parsed.lowConfidence) flags.push(makeFlag('LOW_CONFIDENCE'));

  const seen = new Set();
  return flags
    .filter((f) => (seen.has(f.code) ? false : seen.add(f.code)))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

module.exports = { runFormattingChecks };
