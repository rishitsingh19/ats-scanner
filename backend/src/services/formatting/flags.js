'use strict';

/** Plain-language descriptions for every formatting flag (SRS 3.1: no ML/parser jargon). */
const FLAG_INFO = {
  TABLES: {
    severity: 'high',
    title: 'Tables detected',
    detail: 'Many ATS tools read tables cell by cell or skip them, which can scramble your skills or job history.',
    fix: 'Replace tables with simple lines of text and bullet points.',
  },
  TEXT_BOXES: {
    severity: 'high',
    title: 'Text boxes detected',
    detail: 'Text inside text boxes or shapes is often ignored completely by ATS tools.',
    fix: 'Move the text out of the text box into the normal body of the document.',
  },
  IMAGES: {
    severity: 'medium',
    title: 'Images or icons detected',
    detail: 'ATS tools cannot read images. Any text inside a photo, logo, icon or chart is lost.',
    fix: 'Remove photos and icons, and write any information in them (like skill names) as text.',
  },
  MULTI_COLUMN: {
    severity: 'high',
    title: 'Multi-column layout',
    detail: 'Two-column layouts are often read straight across the page, mixing lines from both columns together.',
    fix: 'Use a single-column layout. Put skills in their own section instead of a sidebar.',
  },
  NON_STANDARD_FONTS: {
    severity: 'low',
    title: 'Uncommon fonts',
    detail: 'Some fonts may not be available to the ATS, so characters can be replaced or lost.',
    fix: 'Use a common font such as Arial, Calibri, Garamond, Georgia, Helvetica or Times New Roman.',
  },
  CONTACT_IN_HEADER: {
    severity: 'high',
    title: 'Contact details in the header or footer',
    detail: 'Many ATS tools skip page headers and footers, so recruiters may not get your email or phone number.',
    fix: 'Move your name, email and phone number into the main body at the top of the page.',
  },
  DATES_MISSING: {
    severity: 'medium',
    title: 'Dates missing in experience',
    detail: 'ATS tools use dates to calculate your experience. Entries without dates may be ignored or ranked lower.',
    fix: 'Add a start and end month for every role, e.g. "Jun 2024 - Aug 2024".',
  },
  DATES_INCONSISTENT: {
    severity: 'low',
    title: 'Mixed date formats',
    detail: 'Using different date styles (like "Jan 2024" and "01/2024") can confuse ATS date parsing.',
    fix: 'Pick one format, such as "Jan 2024 - Mar 2025", and use it everywhere.',
  },
  LOW_CONFIDENCE: {
    severity: 'medium',
    title: 'Sections were hard to detect',
    detail: 'We could not clearly find standard section headings, so the whole document was scored as one block.',
    fix: 'Use standard headings such as "Summary", "Skills", "Experience", "Projects" and "Education".',
  },
};

function makeFlag(code, extra = {}) {
  return { code, ...FLAG_INFO[code], ...extra };
}

const STANDARD_FONTS = [
  'arial', 'calibri', 'cambria', 'garamond', 'georgia', 'helvetica', 'times new roman', 'times', 'verdana', 'tahoma',
  'trebuchet ms', 'book antiqua', 'palatino', 'palatino linotype', 'aptos', 'segoe ui', 'roboto', 'open sans', 'lato',
  'source sans pro', 'source sans', 'noto sans', 'noto serif', 'liberation sans', 'liberation serif', 'carlito',
  'century gothic', 'gill sans', 'helvetica neue', 'computer modern', 'cmr', 'cmbx', 'cmti', 'cmsy', 'lmroman',
  'latin modern', 'symbol', 'wingdings', 'courier', 'courier new', 'consolas', 'dejavu sans', 'dejavu serif',
  'arial narrow', 'franklin gothic', 'corbel', 'candara', 'constantia', 'inter', 'montserrat', 'raleway', 'poppins',
  'nunito', 'merriweather', 'pt sans', 'pt serif', 'ebgaramond', 'eb garamond', 'charter', 'sf pro', 'arimo', 'tinos',
];

function isStandardFont(name) {
  const n = String(name || '')
    .replace(/^[A-Z]{6}\+/, '') // PDF subset prefix "ABCDEF+"
    .replace(/[-,](bold|italic|regular|light|medium|semibold|oblique|bolditalic|black|thin|roman|book).*$/i, '')
    .replace(/(MT|PS|PSMT|Std|Pro)$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  if (!n) return true;
  return STANDARD_FONTS.some((f) => n === f || n.startsWith(f) || n.replace(/\s/g, '').startsWith(f.replace(/\s/g, '')));
}

module.exports = { FLAG_INFO, makeFlag, isStandardFont };
