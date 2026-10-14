'use client';

import { useState } from 'react';
import { TIER_HINT, TIER_LABEL } from '@/lib/format';

const NEXT_TIER = { required: 'preferred', preferred: 'implied', implied: 'required' };
const TIERS = ['required', 'preferred', 'implied'];

/** Lets the user confirm the extracted requirement list before scoring (SRS 4.2.2). */
export default function KeywordEditor({ keywords, onChange }) {
  const [term, setTerm] = useState('');
  const [tier, setTier] = useState('required');

  const update = (i, patch) => onChange(keywords.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const remove = (i) => onChange(keywords.filter((_, j) => j !== i));
  const add = (e) => {
    e.preventDefault();
    const t = term.trim();
    if (!t || keywords.some((k) => k.term.toLowerCase() === t.toLowerCase())) return;
    onChange([...keywords, { term: t, tier, category: 'custom' }]);
    setTerm('');
  };

  return (
    <div className="stack">
      <p className="subtle">
        Check that these match the job. Click a keyword to change how important it is, or remove anything that isn&apos;t a real requirement.
      </p>
      {TIERS.map((t) => {
        const items = keywords.map((k, i) => ({ ...k, i })).filter((k) => k.tier === t);
        return (
          <div key={t}>
            <h3 style={{ marginBottom: 4 }}>
              {TIER_LABEL[t]} <span className="subtle">({items.length})</span>
            </h3>
            <p className="subtle" style={{ marginBottom: 8 }}>
              {TIER_HINT[t]}
            </p>
            {items.length ? (
              <div className="chips">
                {items.map((k) => (
                  <span key={k.term} className={`chip chip-${t}`}>
                    <button
                      type="button"
                      onClick={() => update(k.i, { tier: NEXT_TIER[t] })}
                      aria-label={`${k.term}: ${TIER_LABEL[t]}. Click to change to ${TIER_LABEL[NEXT_TIER[t]]}.`}
                      title={`Change to ${TIER_LABEL[NEXT_TIER[t]]}`}
                      style={{ fontSize: '0.9rem', fontWeight: 500 }}
                    >
                      {k.term}
                    </button>
                    <button type="button" onClick={() => remove(k.i)} aria-label={`Remove ${k.term}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="subtle">None.</p>
            )}
          </div>
        );
      })}
      <form className="row" onSubmit={add} style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 200px' }}>
          Add a keyword we missed
          <input className="input" value={term} onChange={(e) => setTerm(e.target.value)} maxLength={60} placeholder="e.g. Kafka" />
        </label>
        <label className="field" style={{ flex: '0 1 170px' }}>
          Importance
          <select className="select" value={tier} onChange={(e) => setTier(e.target.value)}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Add keyword
        </button>
      </form>
    </div>
  );
}
