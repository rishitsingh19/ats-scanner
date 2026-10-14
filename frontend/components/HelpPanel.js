'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUI } from '@/lib/ui';
import { useAuth } from '@/lib/auth';

/** In-app help explaining each score component in plain language (SRS 2.6). */
export default function HelpPanel() {
  const { helpOpen, setHelpOpen, setTourRequested } = useUI();
  const { user } = useAuth();
  const closeRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!helpOpen) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setHelpOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, setHelpOpen]);

  if (!helpOpen) return null;
  return (
    <>
      <div className="scrim" onClick={() => setHelpOpen(false)} aria-hidden="true" />
      <aside className="panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="help-title">How scoring works</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close help" onClick={() => setHelpOpen(false)}>
            ×
          </button>
        </div>
        <p>
          Your overall score (0 to 100) combines three checks. Companies use Applicant Tracking Systems (ATS) to filter resumes before a person reads
          them, so each check looks at something those systems care about.
        </p>

        <h3>Keyword match</h3>
        <p>How many of the skills and tools named in the job post appear in your resume. Must-have skills count three times as much as mentioned ones.</p>

        <h3>Relevance match</h3>
        <p>
          How closely the meaning of your experience lines up with what the job asks for, even when you use different words. For example, &quot;built
          checkout pages&quot; is relevant to &quot;e-commerce frontend work&quot;.
        </p>

        <h3>Resume completeness</h3>
        <p>Whether your resume has the parts recruiters expect: contact details, skills, experience, education, projects, and results with numbers.</p>

        <h3>Keyword colours</h3>
        <ul>
          <li>
            <strong style={{ color: '#8e231b' }}>Must-have</strong>: listed as a requirement.
          </li>
          <li>
            <strong style={{ color: '#7a4c05' }}>Nice-to-have</strong>: listed as preferred or a plus.
          </li>
          <li>
            <strong style={{ color: '#3b4a5a' }}>Mentioned</strong>: appears in the role description.
          </li>
        </ul>

        <h3>Formatting issues</h3>
        <p>Tables, text boxes, columns, images and headers can make an ATS misread your resume. Each issue comes with a fix.</p>

        <h3>Rewrite ideas</h3>
        <p>
          Bullet points without a number are flagged. Rewrite ideas use words in [square brackets] where you should add your own real figures. Never
          add a number you can&apos;t back up in an interview.
        </p>

        {user && (
          <p style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setHelpOpen(false);
                setTourRequested(true);
                router.push('/scan/new');
              }}
            >
              Replay the first-scan tour
            </button>
          </p>
        )}
        <p style={{ marginTop: 16 }}>
          <Link href="/privacy" onClick={() => setHelpOpen(false)}>
            How your data is used
          </Link>
        </p>
      </aside>
    </>
  );
}
