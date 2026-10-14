'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth, { Loading } from '@/components/RequireAuth';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useUI } from '@/lib/ui';
import { formatBytes, formatDate } from '@/lib/format';

function Account() {
  const { user, setUser } = useAuth();
  const { showError, clearError } = useUI();
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api('/account/summary'), api('/resumes')])
      .then(([s, r]) => {
        setSummary(s);
        setResumes(r.resumes);
      })
      .catch(showError);
  }, [showError]);

  const removeResume = async (r) => {
    if (!window.confirm(`Delete "${r.fileName}" and every scan that used it?`)) return;
    try {
      await api(`/resumes/${r.id}`, { method: 'DELETE' });
      setResumes((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      showError(err);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    clearError();
    if (!window.confirm('Permanently delete your account and all your data? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api('/account', { method: 'DELETE', body: { password } });
      setUser(null);
      router.push('/');
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  };

  if (!summary) return <Loading />;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>
            {user.name}, {user.email}
          </p>
        </div>
      </div>

      <section className="sheet stack" aria-labelledby="files-title">
        <div className="sheet-title">
          <h2 id="files-title">Your resumes</h2>
          <p>
            {summary.resumes} resumes, {summary.jobs} jobs, {summary.scans} scans
          </p>
        </div>
        {resumes.length === 0 ? (
          <p className="subtle">No resumes uploaded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Size</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((r) => (
                  <tr key={r.id}>
                    <td style={{ overflowWrap: 'anywhere' }}>{r.fileName}</td>
                    <td>{formatBytes(r.fileSize)}</td>
                    <td>{formatDate(r.uploadedAt)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <a href={`/api/resumes/${r.id}/file`}>Download</a>
                      <span aria-hidden="true">&nbsp;&nbsp;</span>
                      <button type="button" className="btn-link danger" onClick={() => removeResume(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sheet stack" aria-labelledby="danger-title">
        <h2 id="danger-title">Delete account</h2>
        <p className="subtle">
          This permanently deletes your account and every resume, job description, scan and rewrite saved with it. Enter your password to confirm.
        </p>
        <form className="row" onSubmit={deleteAccount} style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: '1 1 240px' }}>
            Password
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn-danger" disabled={busy || !password}>
            Delete my account and data
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <main className="page container">
        <Account />
      </main>
    </RequireAuth>
  );
}
