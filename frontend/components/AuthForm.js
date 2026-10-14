'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useUI } from '@/lib/ui';

export default function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const { showError, clearError } = useUI();
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setBusy(true);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      const next = params.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/scan/new');
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  };

  return (
    <main className="page container" style={{ maxWidth: 480 }}>
      <div className="sheet stack">
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>{isRegister ? 'Create your account' : 'Sign in'}</h1>
          <p className="subtle" style={{ marginTop: 6 }}>
            {isRegister ? 'Your scans and score history are saved to your account.' : 'Welcome back. Pick up where you left off.'}
          </p>
        </div>
        <form className="stack" onSubmit={onSubmit} noValidate>
          {isRegister && (
            <label className="field">
              Name
              <input className="input" autoComplete="name" value={form.name} onChange={set('name')} required maxLength={120} />
            </label>
          )}
          <label className="field">
            Email
            <input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
          </label>
          <label className="field">
            Password
            {isRegister && <span className="hint">At least 8 characters, with a letter and a number.</span>}
            <input
              className="input"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={set('password')}
              required
              minLength={isRegister ? 8 : undefined}
            />
          </label>
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="subtle">
          {isRegister ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/register">Create an account</Link>
            </>
          )}
        </p>
        {isRegister && (
          <p className="privacy-note">
            Uploaded resumes are stored encrypted and used only to score them. <Link href="/privacy">How your data is used</Link>
          </p>
        )}
      </div>
    </main>
  );
}
