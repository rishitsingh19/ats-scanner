'use strict';

/**
 * Raw text extraction (SRS 3.3): pdf-parse for PDF, mammoth for DOCX.
 */

// Require the inner module directly: pdf-parse's index.js runs a debug self-test when loaded in some setups.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');
const { badRequest } = require('../../utils/errors');

function detectKind(buffer, fileName) {
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  const head = buffer.subarray(0, 5).toString('latin1');
  if (head.startsWith('%PDF')) return 'pdf';
  if (head.startsWith('PK') && ext === 'docx') return 'docx';
  if (ext === 'pdf' || ext === 'docx') {
    throw badRequest('CORRUPT_FILE', `"${fileName}" does not look like a real ${ext.toUpperCase()} file. Try exporting it again from Word or Google Docs.`);
  }
  throw badRequest('UNSUPPORTED_FILE_TYPE', 'Please upload your resume as a PDF or Word (.docx) file.');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

/** Convert mammoth's HTML to lines, keeping list items as "• " bullets (raw text would lose them). */
function htmlToLines(html) {
  const text = html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((l) => l.replace(/\s*\|\s*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Custom page renderer: pdf-parse's default joins pieces on the same line with no space,
 * which glues words together ("SkillsPython"). We insert a space when there is a visible gap.
 */
function renderPage(pageData) {
  return pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false }).then((content) => {
    let text = '';
    let lastY = null;
    let lastXEnd = null;
    for (const item of content.items) {
      const x = item.transform[4];
      const y = item.transform[5];
      if (lastY === null) {
        text += item.str;
      } else if (Math.abs(y - lastY) < 2) {
        const gap = x - lastXEnd;
        const needsSpace = gap > 1.5 && !/\s$/.test(text) && !/^\s/.test(item.str);
        text += (needsSpace ? ' ' : '') + item.str;
      } else {
        text += `\n${item.str}`;
      }
      lastY = y;
      lastXEnd = x + (item.width || 0);
    }
    return text;
  });
}

async function extractPdf(buffer) {
  try {
    const data = await pdfParse(buffer, { pagerender: renderPage });
    return { text: data.text || '', pages: data.numpages || 1 };
  } catch (err) {
    if (/password|encrypt/i.test(err.message || '')) {
      throw badRequest('PDF_ENCRYPTED', 'This PDF is password-protected. Please upload a version without a password.');
    }
    throw badRequest('PDF_UNREADABLE', 'We could not read this PDF. Try saving it again as a PDF from Word or Google Docs.');
  }
}

async function extractDocx(buffer) {
  try {
    const { value } = await mammoth.convertToHtml({ buffer });
    const text = htmlToLines(value || '');
    const words = text.split(/\s+/).length;
    return { text, pages: Math.max(1, Math.round(words / 500)) };
  } catch {
    throw badRequest('DOCX_UNREADABLE', 'We could not read this Word file. Try opening it in Word and saving it again as .docx.');
  }
}

async function extractText(buffer, fileName) {
  const kind = detectKind(buffer, fileName);
  const result = kind === 'pdf' ? await extractPdf(buffer) : await extractDocx(buffer);
  const letters = (result.text.match(/[A-Za-z]/g) || []).length;
  if (letters < 150) {
    // SRS 2.7: OCR is out of scope, so image-only resumes are rejected with a clear message.
    throw badRequest(
      'NO_TEXT_FOUND',
      'We could not find readable text in this file. It may be a scanned image. Please upload a text-based PDF or DOCX (export it from Word or Google Docs).'
    );
  }
  return { kind, ...result };
}

module.exports = { extractText, htmlToLines, detectKind };
