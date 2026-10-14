'use client';

import { TIER_LABEL } from '@/lib/format';

/** REQ-5.1: missing keywords, colour-coded by importance tier. */
export default function KeywordGaps({ keyword, experienceYears }) {
  const { missing, matched } = keyword;
  const tiers = ['required', 'preferred', 'implied'];

  return (
    <section className="sheet stack" aria-labelledby="kw-title">
      <div className="sheet-title">
        <h2 id="kw-title">Missing keywords</h2>
        <div className="legend" aria-hidden="true">
          <span>
            <i style={{ background: '#c2362b' }} />
            Must-have
          </span>
          <span>
            <i style={{ background: '#c9800e' }} />
            Nice-to-have
          </span>
          <span>
            <i style={{ background: '#56677a' }} />
            Mentioned
          </span>
        </div>
      </div>
      {missing.length === 0 ? (
        <div className="notice notice-ok">Your resume mentions every keyword we found in this job post.</div>
      ) : (
        <>
          <p className="subtle">
            Add the ones you genuinely have, using the same wording as the job post. Put them in your skills section and, where you can, in a bullet
            point that shows how you used them.
          </p>
          {tiers.map((t) => {
            const items = missing.filter((m) => m.tier === t);
            if (!items.length) return null;
            return (
              <div key={t}>
                <h3 style={{ marginBottom: 8 }}>
                  {TIER_LABEL[t]} <span className="subtle">({items.length})</span>
                </h3>
                <ul className="chips" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map((m) => (
                    <li key={m.term} className={`chip chip-${t}`} title={m.context ? `From the job post: "${m.context}"` : undefined}>
                      {m.term}
                      <span className="sr-only">, {TIER_LABEL[t]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
      {experienceYears ? (
        <p className="subtle">The job post also asks for about {experienceYears}+ years of experience. Make sure your dates show this clearly.</p>
      ) : null}
      {matched.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Keywords you already have ({matched.length})</summary>
          <div className="chips" style={{ marginTop: 10 }}>
            {matched.map((m) => (
              <span key={m.term} className="chip chip-matched">
                {m.term}
              </span>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
