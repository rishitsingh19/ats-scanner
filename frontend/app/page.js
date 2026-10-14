'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/scan/new');
  }, [loading, user, router]);

  return (
    <main className="page container">
      <section className="landing-hero">
        <div>
          <h1>See your resume the way the hiring software does.</h1>
          <p className="lede">
            Paste a job description, upload your resume, and get a match score with the exact skills you&apos;re missing, the formatting that trips up
            applicant tracking systems, and rewrites for your weakest bullet points.
          </p>
          <div className="row" style={{ marginTop: 28 }}>
            <Link className="btn" href="/register">
              Create a free account
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Sign in
            </Link>
          </div>
        </div>

        <figure className="specimen" aria-label="Example of a marked-up resume">
          <div className="who">Aarav Sharma</div>
          <div className="subtle">Full stack developer, Jaipur</div>
          <div className="sec">Skills</div>
          <p>
            <span className="hl">JavaScript</span>, <span className="hl">React</span>, <span className="hl">Node.js</span>, Python, MongoDB
          </p>
          <p className="margin-note">Missing must-have: PostgreSQL, TypeScript</p>
          <div className="sec">Experience</div>
          <ul>
            <li>
              Built 6 <span className="hl">REST APIs</span> serving 1,200 customers
            </li>
            <li>
              <span className="redpen">Responsible for working on the frontend</span>
              <div className="margin-note">No result here. Try: &quot;Rebuilt the checkout page in React, cutting load time by [X%]&quot;</div>
            </li>
          </ul>
        </figure>
      </section>

      <section className="how" aria-label="What you get">
        <div>
          <h3>A score for this job, not resumes in general</h3>
          <p>Every scan compares your resume to one specific job post, so the advice is about what that employer asked for.</p>
        </div>
        <div>
          <h3>Fixes you can make in ten minutes</h3>
          <p>Missing keywords are ranked by importance, and every formatting problem comes with a plain fix.</p>
        </div>
        <div>
          <h3>Proof your edits worked</h3>
          <p>Rescan the same job after editing and watch your score change over time.</p>
        </div>
      </section>
    </main>
  );
}
