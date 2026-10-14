'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    title: 'Upload your resume',
    body: 'Use a PDF or Word file. We read it the way an applicant tracking system would and show you which sections we found, so you can check nothing was missed.',
    art: (
      <span>
        <span className="hl">resume.pdf</span> <span className="subtle">Summary, Skills, Experience, Education</span>
      </span>
    ),
  },
  {
    title: 'Add the job you want',
    body: 'Paste the job description or a link to it. We pull out the skills it asks for and sort them into must-have, nice-to-have and mentioned. You can edit the list.',
    art: (
      <span className="chips" style={{ justifyContent: 'center' }}>
        <span className="chip chip-required">React</span>
        <span className="chip chip-preferred">Docker</span>
        <span className="chip chip-implied">Figma</span>
      </span>
    ),
  },
  {
    title: 'Read your report',
    body: 'You get one score out of 100, built from keyword match, relevance match and resume completeness. The help button (?) explains each one at any time.',
    art: (
      <span className="score-number" style={{ fontSize: '3.6rem' }}>
        72
      </span>
    ),
  },
  {
    title: 'Fix, then scan again',
    body: 'Add missing skills you really have, fix formatting issues, and use the rewrite ideas for weak bullet points. Rescan the same job to see your score improve.',
    art: <span className="delta up">58 to 76 after two edits</span>,
  },
];

/** First-scan walkthrough (SRS 2.6, 5.4 Usability). */
export default function Onboarding({ onDone }) {
  const [i, setI] = useState(0);
  const nextRef = useRef(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => {
    nextRef.current?.focus();
  }, [i]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <>
      <div className="scrim" aria-hidden="true" />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div className="tour-art">{step.art}</div>
        <p className="subtle">
          Step {i + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" style={{ margin: '4px 0 8px' }}>
          {step.title}
        </h2>
        <p>{step.body}</p>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 24 }}>
          <div className="dots" aria-hidden="true">
            {STEPS.map((s, j) => (
              <i key={s.title} className={j === i ? 'on' : ''} />
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn-link" onClick={onDone}>
              Skip tour
            </button>
            {i > 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => setI(i - 1)}>
                Back
              </button>
            )}
            <button ref={nextRef} type="button" className="btn" onClick={() => (last ? onDone() : setI(i + 1))}>
              {last ? 'Start my first scan' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
