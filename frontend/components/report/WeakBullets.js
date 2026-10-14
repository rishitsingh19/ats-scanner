'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useUI } from '@/lib/ui';

function WithPlaceholders({ text }) {
  return text.split(/(\[[^\]]+\])/g).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i} className="placeholder" title="Replace with your own real figure">
        {part}
      </span>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>{part}</span>
    )
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked; user can still select the text */
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function BulletRow({ scanId, bullet, initial }) {
  const { showError } = useUI();
  const [data, setData] = useState(initial || null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const res = await api(`/scans/${scanId}/rewrites`, { method: 'POST', body: { bulletId: bullet.id } });
      setData(res);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="bullet-card">
      <p className="bullet-text">{bullet.text}</p>
      {!data && (
        <p style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? 'Writing ideas' : 'Show rewrite ideas'}
          </button>
        </p>
      )}
      {data && (
        <>
          <ul className="suggestions" aria-label="Rewrite ideas">
            {data.suggestions.map((s) => (
              <li key={s}>
                <p>
                  <WithPlaceholders text={s} />
                </p>
                <CopyButton text={s} />
              </li>
            ))}
          </ul>
          {data.keywordsAddressed && data.keywordsAddressed.length > 0 && (
            <p className="subtle" style={{ marginTop: 8 }}>
              Adds: {data.keywordsAddressed.join(', ')}. Only keep a keyword if you really used it.
            </p>
          )}
        </>
      )}
    </li>
  );
}

/** REQ-5.2 / REQ-5.3: bullets without a measurable result, each with on-demand rewrites. */
export default function WeakBullets({ scanId, bullets, total, rewrites }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? bullets : bullets.slice(0, 5);
  return (
    <section className="sheet stack" aria-labelledby="bullets-title">
      <div className="sheet-title">
        <h2 id="bullets-title">Bullet points without a result</h2>
        <p>
          {bullets.length} of {total} bullet points have no number
        </p>
      </div>
      {bullets.length === 0 ? (
        <div className="notice notice-ok">Every bullet point includes a number or measurable result.</div>
      ) : (
        <>
          <p className="subtle">
            Recruiters and ATS rankings favour results you can measure. Words in <span className="placeholder">[brackets]</span> are where your own
            real numbers go.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visible.map((b) => (
              <BulletRow key={b.id} scanId={scanId} bullet={b} initial={rewrites[b.id]} />
            ))}
          </ul>
          {bullets.length > 5 && (
            <p>
              <button type="button" className="btn-link" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer' : `Show all ${bullets.length}`}
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
