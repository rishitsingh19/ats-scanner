import Link from 'next/link';

export const metadata = { title: 'How your data is used | ATS Scanner' };

/** SRS 6 (Legal): clear notice about how uploaded resumes are used. */
export default function PrivacyPage() {
  return (
    <main className="page container" style={{ maxWidth: 760 }}>
      <div className="sheet stack">
        <h1>How your data is used</h1>
        <p>
          Your resume contains personal information, so we keep what we do with it simple and limited.
        </p>
        <h2>What we use it for</h2>
        <p>Uploaded resumes and job descriptions are used only to score your resume against the jobs you choose and to show your score history.</p>
        <h2>Who else sees it</h2>
        <p>
          We do not share or sell your resume. To calculate results, short pieces of text may be sent to two services, and only when they are switched
          on for this site:
        </p>
        <ul>
          <li>Hugging Face, to measure how relevant your experience is to the job.</li>
          <li>Google Gemini, to write rewrite ideas for a bullet point you ask about.</li>
        </ul>
        <p>Nothing else leaves our server.</p>
        <h2>How it is stored</h2>
        <p>
          Resume files are encrypted before they are saved. Passwords are stored as one-way hashes, never as plain text. All traffic uses HTTPS. Only
          you can see your resumes, jobs and scans.
        </p>
        <h2>Deleting your data</h2>
        <p>
          You can delete a single scan, job or resume at any time, or delete your whole account and everything in it from the{' '}
          <Link href="/account">Account</Link> page. Deletion is permanent.
        </p>
      </div>
    </main>
  );
}
