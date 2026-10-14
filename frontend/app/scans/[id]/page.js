'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import RequireAuth, { Loading } from '@/components/RequireAuth';
import ScoreSummary from '@/components/report/ScoreSummary';
import KeywordGaps from '@/components/report/KeywordGaps';
import FormatFlags from '@/components/report/FormatFlags';
import WeakBullets from '@/components/report/WeakBullets';
import Completeness from '@/components/report/Completeness';
import { api } from '@/lib/api';
import { useUI } from '@/lib/ui';
import { formatDateTime } from '@/lib/format';

function Report() {
  const { id } = useParams();
  const router = useRouter();
  const { showError } = useUI();
  const [scan, setScan] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/scans/${id}`)
      .then((d) => !cancelled && setScan(d.scan))
      .catch((err) => {
        if (cancelled) return;
        setFailed(true);
        showError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [id, showError]);

  const remove = async () => {
    if (!window.confirm('Delete this scan? This cannot be undone.')) return;
    try {
      await api(`/scans/${id}`, { method: 'DELETE' });
      router.push('/history');
    } catch (err) {
      showError(err);
    }
  };

  if (failed) {
    return (
      <div className="sheet empty">
        <h2>This report isn&apos;t available</h2>
        <p>It may have been deleted, or it belongs to a different account.</p>
        <Link className="btn" href="/history">
          Go to history
        </Link>
      </div>
    );
  }
  if (!scan) return <Loading label="Loading your report" />;

  const b = scan.breakdown;
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>{scan.jobTitle}</h1>
          <p>
            {scan.resumeName}, scanned {formatDateTime(scan.createdAt)}
          </p>
        </div>
        <div className="row">
          <Link className="btn" href={`/scan/new?job=${scan.jobDescriptionId}`}>
            Rescan with an updated resume
          </Link>
          <Link className="btn btn-secondary" href={`/history/${scan.jobDescriptionId}`}>
            Score history
          </Link>
        </div>
      </div>

      {b.lowConfidence && (
        <div className="notice notice-warn">
          We couldn&apos;t clearly find your resume&apos;s sections, so it was scored as one block of text. This score may be less accurate. See the
          formatting issues below.
        </div>
      )}

      <ScoreSummary breakdown={b} previous={scan.previous} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <KeywordGaps keyword={b.keyword} experienceYears={b.experienceYearsAsked} />
        <FormatFlags flags={scan.formatFlags} />
      </div>

      <WeakBullets scanId={scan.id} bullets={b.weakBullets} total={b.totalBullets} rewrites={scan.rewrites || {}} />

      <Completeness completeness={b.completeness} weakAreas={b.semantic.weakAreas} />

      <p className="subtle">
        Relevance was measured with {b.semantic.method === 'huggingface' ? 'an AI language model' : 'the built-in text matcher'}. Scan finished in{' '}
        {(b.durationMs / 1000).toFixed(1)} seconds.{' '}
        <button type="button" className="btn-link danger" onClick={remove}>
          Delete this scan
        </button>
      </p>
    </div>
  );
}

export default function ScanReportPage() {
  return (
    <RequireAuth>
      <main className="page container">
        <Report />
      </main>
    </RequireAuth>
  );
}
