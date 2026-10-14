'use strict';

const { extractText } = require('./extractText');
const { sectionize } = require('./sectionizer');
const { runFormattingChecks } = require('../formatting');

/** Full resume pipeline: validate -> extract text -> sections & bullets -> formatting checks. */
async function parseResume(buffer, fileName) {
  const { kind, text, pages } = await extractText(buffer, fileName);
  const parsed = sectionize(text);
  const formatFlags = await runFormattingChecks({ buffer, kind, parsed });
  return { kind, pages, parsed, formatFlags };
}

module.exports = { parseResume };
