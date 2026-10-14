'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RequireAuth, { Loading } from '@/components/RequireAuth';
import { api } from '@/lib/api';
import { useUI } from '@/lib/ui';
import { formatDate, scoreTone } from '@/lib/format';

function History() {
  const { showError } = useUI();
  const [jobs, setJobs] = useState(null);

  const load = () =>
    api('/jobs')
      .then((d) => setJobs(d.jobs))
      .catch((err) => {
        setJobs([]);
        showError(err);
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeJob = async (job) => {
    if (!window.confirm(`Delete "${job.title}" and all ${job.scanCount} of its scans? This cannot be undone.`)) return;
    try {
      await api(`/jobs/${job.id}`, { method: 'DELETE' });
      setJobs((list) => list.filter((j) => j.id !== job.id));
    } catch (err) {
      showError(err);
    }
  };

  if (!jobs) return <Loading label="Loading your history" />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p>Every job you&apos;ve scanned, with your latest score. Open a job to see how your score changed with each edit.</p>
        </div>
        <Link className="btn" href="/scan/new">
          New scan
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="sheet empty">
          <h2>No scans yet</h2>
          <p>Run your first scan to see your score here. Each job you scan gets its own score history.</p>
          <Link className="btn" href="/scan/new">
            Start a scan
          </Link>
        </div>
      ) : (
        <div className="sheet table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Scans</th>
                <th scope="col">Latest score</th>
                <th scope="col">Change</th>
                <th scope="col">Last scanned</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const change = j.latestScore !== null && j.firstScore !== null && j.scanCount > 1 ? j.latestScore - j.firstScore : null;
                return (
                  <tr key={j.id}>
                    <td>
                      <Link href={`/history/${j.id}`} style={{ fontWeight: 600 }}>
                        {j.title}
                      </Link>
                    </td>
                    <td>{j.scanCount}</td>
                    <td className="num">
                      {j.latestScore === null ? <span className="subtle">Not scanned</span> : <span className={`score-cell tone-${scoreTone(j.latestScore)}`}>{j.latestScore}</span>}
                    </td>
                    <td>
                      {change === null ? (
                        <span className="subtle">-</span>
                      ) : (
                        <span className={`delta ${change >= 0 ? 'up' : 'down'}`}>{change > 0 ? `+${change}` : change}</span>
                      )}
                    </td>
                    <td>{formatDate(j.lastScanAt || j.createdAt)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/scan/new?job=${j.id}`}>Rescan</Link>
                      <span aria-hidden="true">&nbsp;&nbsp;</span>
                      <button type="button" className="btn-link danger" onClick={() => removeJob(j)} aria-label={`Delete ${j.title}`}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function HistoryPage() {
  return (
    <RequireAuth>
      <main className="page container">
        <History />
      </main>
    </RequireAuth>
  );
}
