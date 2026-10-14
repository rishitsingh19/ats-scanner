'use strict';

/** REQ-4.1 / REQ-4.2 checks for Word (.docx) resumes, by inspecting the document XML. */

const { readZip } = require('./zip');
const { makeFlag, isStandardFont } = require('./flags');

const CONTACT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(\+?\d[\d\s-]{8,}\d)|linkedin\.com/i;

function xmlText(xml) {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(' ');
}

function checkDocx(buffer) {
  const flags = [];
  let zip;
  try {
    zip = readZip(buffer);
  } catch {
    return flags; // text extraction already validated the file; skip layout checks quietly
  }
  const doc = zip.readText('word/document.xml') || '';

  const tableCount = (doc.match(/<w:tbl[\s>]/g) || []).length;
  if (tableCount > 0) flags.push(makeFlag('TABLES', { evidence: `${tableCount} table(s) found` }));

  const textBoxes = (doc.match(/<w:txbxContent[\s>]/g) || []).length;
  if (textBoxes > 0) {
    // Word stores each text box twice (modern + fallback), so halve the count when both exist.
    const n = doc.includes('<mc:Fallback>') ? Math.ceil(textBoxes / 2) : textBoxes;
    flags.push(makeFlag('TEXT_BOXES', { evidence: `${n} text box(es) found` }));
  }

  const images = (doc.match(/<pic:pic\b|<v:imagedata\b/g) || []).length;
  const mediaFiles = zip.names().filter((n) => n.startsWith('word/media/')).length;
  if (images > 0 || mediaFiles > 0) flags.push(makeFlag('IMAGES', { evidence: `${Math.max(images, mediaFiles)} image(s) found` }));

  const colMatches = doc.match(/<w:cols\b[^>]*w:num="(\d+)"/g) || [];
  const multiCol = colMatches.some((m) => Number(m.match(/w:num="(\d+)"/)[1]) > 1);
  // A full-width table with 2+ wide cells used as a layout grid is the other common way to make columns.
  if (multiCol) flags.push(makeFlag('MULTI_COLUMN', { evidence: 'Document uses page columns' }));

  // Fonts: explicit run fonts in the body and in styles.
  const styles = zip.readText('word/styles.xml') || '';
  const fonts = new Set();
  for (const xml of [doc, styles]) {
    for (const m of xml.match(/<w:rFonts\b[^>]*>/g) || []) {
      const ascii = m.match(/w:ascii="([^"]+)"/);
      if (ascii) fonts.add(ascii[1]);
    }
  }
  const odd = [...fonts].filter((f) => !isStandardFont(f));
  if (odd.length) flags.push(makeFlag('NON_STANDARD_FONTS', { evidence: odd.slice(0, 5).join(', ') }));

  // Contact details in headers/footers.
  const hfParts = zip.names().filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n));
  for (const part of hfParts) {
    const txt = xmlText(zip.readText(part) || '');
    if (CONTACT_RE.test(txt)) {
      flags.push(makeFlag('CONTACT_IN_HEADER', { evidence: `Found in ${part.includes('header') ? 'header' : 'footer'}` }));
      break;
    }
  }

  return flags;
}

module.exports = { checkDocx };
