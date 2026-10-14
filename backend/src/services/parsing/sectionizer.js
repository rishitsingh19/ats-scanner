'use strict';

/**
 * Resume segmentation (REQ-1.2, REQ-1.3, REQ-1.4).
 * Turns extracted plain text into sections and individually addressable bullet points.
 */

const { hasMetric } = require('../textUtils');

const SECTION_HEADINGS = {
  summary: ['summary', 'professional summary', 'profile', 'professional profile', 'career summary', 'objective', 'career objective', 'about me', 'about', 'personal statement'],
  skills: ['skills', 'technical skills', 'key skills', 'core skills', 'core competencies', 'competencies', 'technologies', 'tech stack', 'technical proficiency', 'skills & tools', 'skills and tools', 'tools & technologies', 'tools and technologies', 'skills & interests', 'technical expertise', 'areas of expertise', 'skill set', 'skillset'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'internships', 'internship', 'internship experience', 'relevant experience', 'industry experience', 'experience & internships'],
  education: ['education', 'academic background', 'academics', 'academic details', 'educational qualifications', 'educational qualification', 'education & qualifications', 'qualifications', 'academic qualifications'],
  projects: ['projects', 'academic projects', 'personal projects', 'key projects', 'technical projects', 'major projects', 'project experience', 'selected projects', 'projects & research'],
  certifications: ['certifications', 'certification', 'certificates', 'licenses & certifications', 'licenses and certifications', 'courses', 'courses & certifications', 'certifications & courses', 'trainings', 'training & certifications', 'online courses'],
  other: ['achievements', 'awards', 'honors', 'honours', 'awards & achievements', 'achievements & awards', 'extracurricular', 'extra-curricular activities', 'extracurricular activities', 'activities', 'positions of responsibility', 'leadership', 'volunteering', 'volunteer experience', 'languages', 'interests', 'hobbies', 'publications', 'research', 'references', 'declaration', 'co-curricular activities', 'responsibilities'],
};

const HEADING_LOOKUP = new Map();
for (const [section, names] of Object.entries(SECTION_HEADINGS)) {
  for (const n of names) HEADING_LOOKUP.set(n, section);
}

const BULLET_RE = /^\s*([•\-*–—▪●◦‣➢➤►✓✔■□○·⚫]|\d{1,2}[.)])\s+/;
const BULLET_CHARS_ONLY = /^\s*[•▪●◦‣➢➤►✓✔■□○·⚫]\s*$/;

/** Returns the section key if the line is a section heading, else null. */
function detectHeading(line) {
  const t = line.trim();
  if (!t || t.length > 45) return null;
  const key = t
    .toLowerCase()
    .replace(/[:|_#*=~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (HEADING_LOOKUP.has(key)) return HEADING_LOOKUP.get(key);
  // Letter-spaced headings like "E D U C A T I O N"
  const squashed = key.replace(/\s/g, '');
  for (const [name, section] of HEADING_LOOKUP) {
    if (name.replace(/\s/g, '') === squashed && squashed.length > 4) return section;
  }
  return null;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(\+?\d{1,3}[\s-]?)?(\(?\d{3,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}/;
const LINKEDIN_RE = /linkedin\.com\/[A-Za-z0-9/_-]+/i;
const GITHUB_RE = /github\.com\/[A-Za-z0-9_-]+/i;

function extractContact(text, headerLines) {
  const email = (text.match(EMAIL_RE) || [])[0] || null;
  const phoneMatch = text.match(PHONE_RE);
  const phone = phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10 ? phoneMatch[0].trim() : null;
  const linkedin = (text.match(LINKEDIN_RE) || [])[0] || null;
  const github = (text.match(GITHUB_RE) || [])[0] || null;
  const nameLine = headerLines.find(
    (l) => l.length >= 3 && l.length <= 40 && !EMAIL_RE.test(l) && !/\d{4}/.test(l) && /^[A-Za-z][A-Za-z .'-]+$/.test(l)
  );
  return { name: nameLine || null, email, phone, linkedin, github };
}

/** Join wrapped lines that belong to the previous bullet (common in PDF text extraction). */
function mergeWrappedBullets(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    if (BULLET_CHARS_ONLY.test(line) && i + 1 < lines.length) {
      // bullet glyph on its own line, text on the next one
      line = `• ${lines[i + 1].trim()}`;
      i += 1;
    }
    const prev = out[out.length - 1];
    const isContinuation =
      prev &&
      BULLET_RE.test(prev) &&
      !BULLET_RE.test(line) &&
      !detectHeading(line) &&
      /^[a-z(&,/]/.test(line.trim()) &&
      !/[.!?]$/.test(prev.trim());
    if (isContinuation) out[out.length - 1] = `${prev.trim()} ${line.trim()}`;
    else out.push(line);
  }
  return out;
}

function looksLikeEntryHeader(line) {
  // "Software Intern | Acme Corp | Jun 2024 - Aug 2024" style lines are not bullets
  return (
    line.length < 40 ||
    /\b(19|20)\d{2}\b/.test(line) && line.length < 110 && !/[.]$/.test(line) && line.split(/\s+/).length < 16
  );
}

/**
 * @param {string} rawText
 * @returns {{sections, bullets, contact, detectedSections, lowConfidence, rawText}}
 */
function sectionize(rawText) {
  const text = String(rawText || '').replace(/\r/g, '').replace(/\t/g, ' ').replace(/[  ]{2,}/g, ' ');
  let lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  lines = mergeWrappedBullets(lines);

  const sections = { contact: [], summary: [], skills: [], experience: [], education: [], projects: [], certifications: [], other: [] };
  let current = 'contact';
  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      continue;
    }
    sections[current].push(line);
  }

  const detected = Object.keys(sections).filter((k) => k !== 'contact' && k !== 'other' && sections[k].length > 0);
  const core = ['skills', 'experience', 'education', 'projects'].filter((k) => sections[k].length > 0);
  // REQ-1.4: if we can't find at least two core sections, score the whole document instead.
  const lowConfidence = core.length < 2;

  const bullets = [];
  let n = 0;
  const pushBullet = (section, textLine) => {
    const clean = textLine.replace(BULLET_RE, '').trim();
    if (clean.length < 15) return;
    n += 1;
    bullets.push({ id: `b${n}`, section, text: clean, hasMetric: hasMetric(clean) });
  };

  const bulletSections = lowConfidence ? null : ['experience', 'projects'];
  if (bulletSections) {
    for (const s of bulletSections) {
      const sLines = sections[s];
      const marked = sLines.filter((l) => BULLET_RE.test(l));
      if (marked.length >= 2) marked.forEach((l) => pushBullet(s, l));
      else sLines.filter((l) => !looksLikeEntryHeader(l)).forEach((l) => pushBullet(s, l));
    }
  } else {
    // whole-document fallback: treat any sentence-like line as a bullet
    lines.filter((l) => !detectHeading(l) && !looksLikeEntryHeader(l) && l.length >= 40).forEach((l) => pushBullet('document', l));
  }

  const contact = extractContact(text, sections.contact.slice(0, 6).concat(lines.slice(0, 3)));

  const asText = {};
  for (const [k, v] of Object.entries(sections)) asText[k] = v.join('\n');

  return {
    sections: asText,
    bullets,
    contact,
    detectedSections: detected,
    lowConfidence,
    rawText: text.trim(),
  };
}

module.exports = { sectionize, detectHeading, SECTION_HEADINGS };
