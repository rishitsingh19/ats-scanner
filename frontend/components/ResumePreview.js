'use client';

import { formatBytes, formatDate } from '@/lib/format';

/** Structured preview of the parsed resume, for the user to confirm (SRS 4.1.2). */
export default function ResumePreview({ resume }) {
  const c = resume.contact || {};
  const contactBits = [c.email, c.phone, c.linkedin, c.github].filter(Boolean);
  return (
    <div className="stack">
      <div>
        <h3>{resume.fileName}</h3>
        <p className="subtle">
          {formatBytes(resume.fileSize)}, uploaded {formatDate(resume.uploadedAt)}
        </p>
      </div>

      {resume.lowConfidence && (
        <div className="notice notice-warn">
          We couldn&apos;t find clear section headings in this resume, so it will be scored as one block of text. The score may be less accurate.
          Using headings like &quot;Skills&quot;, &quot;Experience&quot; and &quot;Education&quot; fixes this.
        </div>
      )}

      <div>
        <strong>Sections we found</strong>
        <div className="chips" style={{ marginTop: 8 }}>
          {resume.sections.filter((s) => s.key !== 'other').map((s) => (
            <span key={s.key} className="chip chip-matched">
              {s.label}
            </span>
          ))}
          {resume.missingSections.map((s) => (
            <span key={s} className="chip chip-implied" title="Not found">
              No {s.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div>
          <strong>Contact details</strong>
          <p className="subtle" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>
            {contactBits.length ? contactBits.join(', ') : 'No email or phone number found.'}
          </p>
        </div>
        <div>
          <strong>Bullet points</strong>
          <p className="subtle" style={{ marginTop: 4 }}>
            {resume.bullets.length} found in experience and projects, {resume.bullets.filter((b) => b.hasMetric).length} with a number or result.
          </p>
        </div>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Show the text we read from each section</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          {resume.sections.map((s) => (
            <div key={s.key}>
              <strong>{s.label}</strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>
                {s.preview}
                {s.preview.length >= 600 ? '…' : ''}
              </pre>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
