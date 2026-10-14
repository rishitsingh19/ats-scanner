'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import RequireAuth, { Loading } from '@/components/RequireAuth';
import Dropzone from '@/components/Dropzone';
import ResumePreview from '@/components/ResumePreview';
import KeywordEditor from '@/components/KeywordEditor';
import Onboarding from '@/components/Onboarding';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useUI } from '@/lib/ui';
import { formatDate } from '@/lib/format';

const STEP_NAMES = ['Resume', 'Job description', 'Report'];

function Steps({ step }) {
  return (
    <ol className="steps" aria-label="Scan progress">
      {STEP_NAMES.map((name, i) => (
        <li key={name} className={i === step ? 'active' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="num">{i + 1}</span>
          {name}
        </li>
      ))}
    </ol>
  );
}

function sameKeywords(a, b) {
  if (a.length !== b.length) return false;
  return a.every((k, i) => k.term === b[i].term && k.tier === b[i].tier);
}

function NewScan() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, markOnboarded } = useAuth();
  const { showError, clearError, tourRequested, setTourRequested } = useUI();

  const [step, setStep] = useState(0);
  const [resumes, setResumes] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [resume, setResume] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [jdMode, setJdMode] = useState('text');
  const [jdText, setJdText] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [jdTitle, setJdTitle] = useState('');
  const [job, setJob] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [reading, setReading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const showTour = (user && !user.onboarded) || tourRequested;
  const closeTour = useCallback(() => {
    setTourRequested(false);
    if (user && !user.onboarded) markOnboarded();
  }, [user, markOnboarded, setTourRequested]);

  // Load saved resumes/jobs, and honour ?resume= and ?job= (used by "Rescan" buttons).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, j] = await Promise.all([api('/resumes'), api('/jobs')]);
        if (cancelled) return;
        setResumes(r.resumes);
        setJobs(j.jobs);
        const jobId = params.get('job');
        const resumeId = params.get('resume');
        if (jobId) {
          const { job: jb } = await api(`/jobs/${jobId}`);
          if (!cancelled) {
            setJob(jb);
            setKeywords(jb.keywords);
            setJdMode('saved');
          }
        }
        if (resumeId) {
          const { resume: rs } = await api(`/resumes/${resumeId}`);
          if (!cancelled) setResume(rs);
        }
      } catch (err) {
        if (!cancelled) showError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, showError]);

  const upload = async (file) => {
    clearError();
    setUploading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      const { resume: rs } = await api('/resumes', { method: 'POST', form });
      setResume(rs);
      setResumes((list) => [{ id: rs.id, fileName: rs.fileName, uploadedAt: rs.uploadedAt }, ...(list || [])]);
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  const pickSavedResume = async (id) => {
    if (!id) return;
    clearError();
    try {
      const { resume: rs } = await api(`/resumes/${id}`);
      setResume(rs);
    } catch (err) {
      showError(err);
    }
  };

  const pickSavedJob = async (id) => {
    if (!id) {
      setJob(null);
      return;
    }
    clearError();
    try {
      const { job: jb } = await api(`/jobs/${id}`);
      setJob(jb);
      setKeywords(jb.keywords);
    } catch (err) {
      showError(err);
    }
  };

  const readJob = async () => {
    clearError();
    setReading(true);
    try {
      const body = jdMode === 'url' ? { url: jdUrl.trim(), title: jdTitle.trim() } : { text: jdText, title: jdTitle.trim() };
      const { job: jb } = await api('/jobs', { method: 'POST', body });
      setJob(jb);
      setKeywords(jb.keywords);
    } catch (err) {
      // REQ-2.4: if the link can't be read, switch to the paste box so the user can continue.
      if (err.code === 'URL_FETCH_FAILED') setJdMode('text');
      showError(err);
    } finally {
      setReading(false);
    }
  };

  const runScan = async () => {
    clearError();
    if (!keywords.length) {
      showError('Add at least one keyword from the job description before scanning.');
      return;
    }
    setScanning(true);
    setStep(2);
    try {
      let jb = job;
      if (!sameKeywords(keywords, job.keywords)) {
        const res = await api(`/jobs/${job.id}/keywords`, { method: 'PUT', body: { keywords } });
        jb = res.job;
        setJob(jb);
      }
      const { scan } = await api('/scans', { method: 'POST', body: { resumeId: resume.id, jobDescriptionId: jb.id } });
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      showError(err);
      setScanning(false);
      setStep(1);
    }
  };

  if (resumes === null) return <Loading label="Loading your resumes" />;

  return (
    <>
      {showTour && <Onboarding onDone={closeTour} />}
      <div className="page-head">
        <div>
          <h1>New scan</h1>
          <p>Compare one resume with one job description. You&apos;ll get a score, the skills you&apos;re missing and specific fixes.</p>
        </div>
      </div>
      <Steps step={step} />

      {step === 0 && (
        <section className="sheet stack" aria-labelledby="resume-step">
          <h2 id="resume-step">Choose your resume</h2>
          {!resume && (
            <>
              <Dropzone onFile={upload} disabled={uploading} onReject={showError} />
              {uploading && <Loading label="Reading your resume" />}
              {resumes.length > 0 && (
                <label className="field">
                  Or use a resume you uploaded before
                  <select className="select" defaultValue="" onChange={(e) => pickSavedResume(e.target.value)}>
                    <option value="">Choose a saved resume</option>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fileName} ({formatDate(r.uploadedAt)})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="privacy-note">
                Your file is stored encrypted and is only used to score it against jobs you choose. <Link href="/privacy">Details</Link>
              </p>
            </>
          )}
          {resume && (
            <>
              <ResumePreview resume={resume} />
              <div className="row">
                <button type="button" className="btn" onClick={() => setStep(1)}>
                  Use this resume
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setResume(null)}>
                  Choose a different file
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="sheet stack" aria-labelledby="jd-step">
          <div className="sheet-title">
            <h2 id="jd-step">Add the job description</h2>
            <p>
              Resume: <strong>{resume.fileName}</strong>{' '}
              <button type="button" className="btn-link" onClick={() => setStep(0)}>
                Change
              </button>
            </p>
          </div>

          {!job && (
            <>
              <div className="tabs" role="tablist" aria-label="How to add the job">
                {[
                  ['text', 'Paste text'],
                  ['url', 'Job link'],
                  ...(jobs && jobs.length ? [['saved', 'Saved jobs']] : []),
                ].map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={jdMode === k} onClick={() => setJdMode(k)}>
                    {label}
                  </button>
                ))}
              </div>

              {jdMode !== 'saved' && (
                <label className="field">
                  Job title <span className="hint">Optional. We&apos;ll guess it from the description if you leave it blank.</span>
                  <input className="input" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} maxLength={200} placeholder="e.g. Software Engineer Intern, Acme" />
                </label>
              )}

              {jdMode === 'text' && (
                <label className="field">
                  Job description
                  <span className="hint">Paste the whole posting, including the requirements and &quot;nice to have&quot; sections.</span>
                  <textarea className="textarea" value={jdText} onChange={(e) => setJdText(e.target.value)} />
                </label>
              )}
              {jdMode === 'url' && (
                <label className="field">
                  Link to the job posting
                  <span className="hint">Some sites block automatic reading. If that happens, we&apos;ll ask you to paste the text instead.</span>
                  <input className="input" type="url" inputMode="url" value={jdUrl} onChange={(e) => setJdUrl(e.target.value)} placeholder="https://" />
                </label>
              )}
              {jdMode === 'saved' && (
                <label className="field">
                  Pick a job you scanned before
                  <span className="hint">Use this to rescan the same job after editing your resume and track your progress.</span>
                  <select className="select" defaultValue="" onChange={(e) => pickSavedJob(e.target.value)}>
                    <option value="">Choose a saved job</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} {j.latestScore !== null ? `(last score ${j.latestScore})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {jdMode !== 'saved' && (
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    onClick={readJob}
                    disabled={reading || (jdMode === 'text' ? jdText.trim().length < 50 : !jdUrl.trim())}
                  >
                    {reading && <span className="spinner" aria-hidden="true" />}
                    Find keywords
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>
                    Back
                  </button>
                </div>
              )}
            </>
          )}

          {job && (
            <>
              <div className="notice notice-info">
                <strong>{job.title}</strong>
                {job.reused ? ' is already saved, so this scan will appear in the same score history.' : ''}
                {job.experienceYears ? ` The post asks for about ${job.experienceYears}+ years of experience.` : ''}{' '}
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setJob(null);
                    setKeywords([]);
                  }}
                >
                  Use a different job
                </button>
              </div>
              {keywords.length === 0 && (
                <div className="notice notice-warn">
                  We couldn&apos;t find specific skills in this description. Add the key skills from the posting below so we can score your resume.
                </div>
              )}
              <KeywordEditor keywords={keywords} onChange={setKeywords} />
              <div className="row">
                <button type="button" className="btn" onClick={runScan} disabled={scanning || !keywords.length}>
                  Confirm keywords and scan
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>
                  Back
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="sheet">
          <Loading label="Scoring your resume against the job. This usually takes a few seconds." />
        </section>
      )}
    </>
  );
}

export default function NewScanPage() {
  return (
    <RequireAuth>
      <main className="page container">
        <Suspense fallback={<Loading />}>
          <NewScan />
        </Suspense>
      </main>
    </RequireAuth>
  );
}
