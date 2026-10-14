'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RequireAuth, { Loading } from '@/components/RequireAuth';
import TrendChart from '@/components/TrendChart';
import { api } from '@/lib/api';
import { useUI } from '@/lib/ui';
import { formatDateTime, scoreTone } from '@/lib/format';

function JobTrend() {
  const { jobId } = useParams();
  const { showError } = useUI();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api(`/jobs/${jobId}/trend`)
      .then(setData)
      .catch((err) => {
        setFailed(true);
        showError(err);
      });
  }, [jobId, showError]);

  // REQ-6.3: delete a stored scan
  const removeScan = async (scanId) => {
    if (!window.confirm('Delete this scan? This cannot be undone.')) return;
    try {
      await api(`/scans/${scanId}`, { method: 'DELETE' });
      setData((d) => ({ ...d, points: d.points.filter((p) => p.scanId !== scanId) }));
    } catch (err) {
      showError(err);
    }
  };

  if (failed) {
    return (
      <div className="sheet empty">
        <h2>This job isn&apos;t available</h2>
        <p>It may have been deleted.</p>
        <Link className="btn" href="/history">
          Back to history
        </Link>
      </div>
    );
  }
  if (!data) return <Loading label="Loading score history" />;

  const pts = data.points;
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <p className="subtle">
            <Link href="/history">History</Link>
          </p>
          <h1>{data.job.title}</h1>
          {pts.length > 1 && (
            <p>
              Your score went from {first.composite} to {last.composite} over {pts.length} scans.
            </p>
          )}
        </div>
        <Link className="btn" href={`/scan/new?job=${data.job.id}`}>
          Rescan with an updated resume
        </Link>
      </div>

      {pts.length === 0 ? (
        <div className="sheet empty">
          <h2>No scans for this job</h2>
          <p>Scan a resume against this job to start tracking your score.</p>
          <Link className="btn" href={`/scan/new?job=${data.job.id}`}>
            Scan this job
          </Link>
        </div>
      ) : (
        <>
          <section className="sheet" aria-labelledby="trend-title">
            <h2 id="trend-title" style={{ marginBottom: 12 }}>
              Score over time
            </h2>
            {pts.length === 1 ? (
              <p className="subtle">Scan this job again after editing your resume to see a trend.</p>
            ) : (
              <TrendChart points={pts} />
            )}
          </section>
          <section className="sheet table-wrap" aria-labelledby="scans-title">
            <h2 id="scans-title" style={{ marginBottom: 12 }}>
              All scans
            </h2>
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Resume</th>
                  <th scope="col">Score</th>
                  <th scope="col">Keywords</th>
                  <th scope="col">Relevance</th>
                  <th scope="col">Completeness</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...pts].reverse().map((p) => (
                  <tr key={p.scanId}>
                    <td>
                      <Link href={`/scans/${p.scanId}`}>{formatDateTime(p.createdAt)}</Link>
                    </td>
                    <td style={{ overflowWrap: 'anywhere' }}>{p.resumeName}</td>
                    <td className="num">
                      <span className={`score-cell tone-${scoreTone(p.composite)}`}>{p.composite}</span>
                    </td>
                    <td>{p.keyword ?? '-'}</td>
                    <td>{p.semantic ?? '-'}</td>
                    <td>{p.completeness ?? '-'}</td>
                    <td>
                      <button type="button" className="btn-link danger" onClick={() => removeScan(p.scanId)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

export default function JobTrendPage() {
  return (
    <RequireAuth>
      <main className="page container">
        <JobTrend />
      </main>
    </RequireAuth>
  );
}
