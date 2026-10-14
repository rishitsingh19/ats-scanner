'use strict';

/**
 * REQ-4.1 / REQ-4.2 checks for PDF resumes.
 * Uses text positions from pdf.js (bundled with pdf-parse) for layout analysis,
 * and the raw PDF structure for images and font names.
 */

const { makeFlag, isStandardFont } = require('./flags');

const CONTACT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(\+?\d[\d\s-]{8,}\d)|linkedin\.com/i;

function loadPdfJs() {
  // pdf-parse ships pdf.js v1.10.100; reuse it instead of adding another copy.
  // eslint-disable-next-line global-require
  const PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  PDFJS.disableWorker = true;
  PDFJS.disableFontFace = true;
  return PDFJS;
}

/** Group text items into rows by their baseline. */
function toRows(items) {
  const rows = [];
  const sorted = items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width || it.str.length * 4, str: it.str }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) < 2.5);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Split a row into segments wherever there is a big horizontal gap. */
function segments(row, minGap) {
  const segs = [];
  let cur = null;
  for (const it of row.items) {
    if (cur && it.x - (cur.xEnd) < minGap) {
      cur.text += ` ${it.str}`;
      cur.xEnd = Math.max(cur.xEnd, it.x + it.w);
    } else {
      cur = { x: it.x, xEnd: it.x + it.w, text: it.str };
      segs.push(cur);
    }
  }
  return segs.map((s) => ({ ...s, text: s.text.trim() }));
}

function analyseLayout(pages) {
  let splitRows = 0;
  let totalRows = 0;
  let tableRun = 0;
  let maxTableRun = 0;
  const headerFooterLines = [];

  for (const { rows, width } of pages) {
    for (const row of rows) {
      totalRows += 1;
      const segs = segments(row, width * 0.06);
      // Column split: a long block of text starting in the middle of the page next to text on the left.
      const right = segs.slice(1).find((s) => s.x > width * 0.3 && s.x < width * 0.7 && s.text.length >= 15);
      if (right && segs[0].text.length >= 3) splitRows += 1;

      const cells = segments(row, width * 0.03);
      if (cells.length >= 3 && cells.every((c) => c.text.length <= 40)) {
        tableRun += 1;
        maxTableRun = Math.max(maxTableRun, tableRun);
      } else {
        tableRun = 0;
      }
    }
    tableRun = 0;
    if (rows.length) {
      headerFooterLines.push({ top: rows[0].items.map((i) => i.str).join(' '), bottom: rows[rows.length - 1].items.map((i) => i.str).join(' ') });
    }
  }
  return { splitRatio: totalRows ? splitRows / totalRows : 0, totalRows, maxTableRun, headerFooterLines };
}

function rawFontNames(buffer) {
  const raw = buffer.toString('latin1');
  const names = new Set();
  for (const m of raw.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+#\-,_]+)/g)) names.add(m[1].replace(/#20/g, ' '));
  return [...names];
}

async function checkPdf(buffer) {
  const flags = [];

  // Images: image XObjects are stream objects, whose dictionaries are always readable in the raw file.
  const raw = buffer.toString('latin1');
  const imageCount = (raw.match(/\/Subtype\s*\/Image\b/g) || []).length;
  if (imageCount > 0) flags.push(makeFlag('IMAGES', { evidence: `${imageCount} image(s) or icon(s) found` }));

  let fonts = rawFontNames(buffer);

  try {
    const PDFJS = loadPdfJs();
    const doc = await PDFJS.getDocument({ data: new Uint8Array(buffer), disableFontFace: true, nativeImageDecoderSupport: 'none' });
    const pages = [];
    const maxPages = Math.min(doc.numPages, 4);
    for (let p = 1; p <= maxPages; p += 1) {
      // eslint-disable-next-line no-await-in-loop
      const page = await doc.getPage(p);
      const viewport = page.getViewport(1);
      // eslint-disable-next-line no-await-in-loop
      const content = await page.getTextContent();
      pages.push({ rows: toRows(content.items), width: viewport.width, height: viewport.height });
      if (!fonts.length && content.styles) {
        // Fallback: style names sometimes include the real font family.
        fonts = Object.values(content.styles).map((s) => s.fontFamily).filter((f) => f && !/^(sans-serif|serif|monospace)$/.test(f));
      }
    }
    if (typeof doc.destroy === 'function') doc.destroy();

    const layout = analyseLayout(pages);
    if (layout.totalRows >= 12 && layout.splitRatio >= 0.3) {
      flags.push(makeFlag('MULTI_COLUMN', { evidence: `About ${Math.round(layout.splitRatio * 100)}% of lines sit side by side` }));
    }
    if (layout.maxTableRun >= 4) {
      flags.push(makeFlag('TABLES', { evidence: `${layout.maxTableRun} rows of grid-like content found` }));
    }
    // Repeated top/bottom lines with contact details on multi-page PDFs are headers/footers.
    if (layout.headerFooterLines.length >= 2) {
      const [a, b] = layout.headerFooterLines;
      const repeated = [a.top === b.top ? a.top : null, a.bottom === b.bottom ? a.bottom : null].filter(Boolean);
      if (repeated.some((l) => CONTACT_RE.test(l))) {
        flags.push(makeFlag('CONTACT_IN_HEADER', { evidence: 'Contact details repeat at the top or bottom of every page' }));
      }
    }
  } catch (err) {
    // Layout analysis is best-effort; text was already extracted successfully.
    console.warn('[pdfChecks] layout analysis skipped:', err.message);
  }

  const odd = [...new Set(fonts.filter((f) => !isStandardFont(f)).map((f) => f.replace(/^[A-Z]{6}\+/, '')))];
  if (odd.length) flags.push(makeFlag('NON_STANDARD_FONTS', { evidence: odd.slice(0, 5).join(', ') }));

  return flags;
}

module.exports = { checkPdf, analyseLayout, toRows, segments, rawFontNames };
