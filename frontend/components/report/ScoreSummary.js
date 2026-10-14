'use client';

import { scoreTone } from '@/lib/format';
import { useUI } from '@/lib/ui';

function Meter({ label, value, note }) {
  const tone = scoreTone(value);
  return (
    <div>
      <div className="meter-head">
        <strong>{label}</strong>
        <span className="val">{value === null || value === undefined ? 'n/a' : value}</span>
      </div>
      <div
        className={`meter tone-${tone}`}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
      >
        <span style={{ width: `${value ?? 0}%` }} />
      </div>
      <p className="meter-note">{note}</p>
    </div>
  );
}

/** Composite score with its sub-score breakdown (REQ-3.4). Plain-language labels only (SRS 3.1). */
export default function ScoreSummary({ breakdown, previous }) {
  const { setHelpOpen } = useUI();
  const tone = scoreTone(breakdown.composite);
  const kw = breakdown.keyword;
  const req = kw.byTier?.required;
  const delta = previous ? breakdown.composite - previous.composite : null;

  return (
    <section className="sheet score-hero" aria-label="Overall score">
      <div>
        <p className="subtle">Match score for this job</p>
        <div style={{ marginTop: 8 }}>
          <span className={`score-number tone-${tone}`}>{breakdown.composite}</span>
          <span className="score-of">/ 100</span>
        </div>
        <p className={`band tone-${tone}`}>{breakdown.band.label}</p>
        {delta !== null && (
          <p className={`delta ${delta >= 0 ? 'up' : 'down'}`} style={{ marginTop: 4 }}>
            {delta > 0 ? `Up ${delta}` : delta < 0 ? `Down ${Math.abs(delta)}` : 'No change'} since your last scan of this job
          </p>
        )}
      </div>
      <div className="meter-list">
        <Meter
          label="Keyword match"
          value={kw.score}
          note={req && req.total ? `You have ${req.matched} of ${req.total} must-have skills.` : 'Skills and tools from the job post found in your resume.'}
        />
        <Meter
          label="Relevance match"
          value={breakdown.semantic.score}
          note="How closely your experience matches what the job asks for, even in different words."
        />
        <Meter
          label="Resume completeness"
          value={breakdown.completeness.score}
          note="Contact details, standard sections, and results with numbers."
        />
        <p className="subtle">
          <button type="button" className="btn-link" onClick={() => setHelpOpen(true)}>
            How is this calculated?
          </button>
        </p>
      </div>
    </section>
  );
}
