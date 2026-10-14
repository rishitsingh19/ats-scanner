'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useUI } from '@/lib/ui';

export default function Header() {
  const { user, logout } = useAuth();
  const { setHelpOpen } = useUI();
  const pathname = usePathname();
  const router = useRouter();

  const current = (href) => (pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'page' : undefined);

  const onLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="site-header">
      <div className="container">
        <Link href={user ? '/scan/new' : '/'} className="brand">
          <span className="brand-mark" aria-hidden="true" />
          ATS Scanner
        </Link>
        <nav className="nav" aria-label="Main">
          {user ? (
            <>
              <Link href="/scan/new" aria-current={current('/scan')}>
                New scan
              </Link>
              <Link href="/history" aria-current={current('/history')}>
                History
              </Link>
              <Link href="/account" aria-current={current('/account')} className="hide-sm">
                Account
              </Link>
              <button type="button" className="btn-link hide-sm" style={{ padding: '8px 10px', fontWeight: 500 }} onClick={onLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" aria-current={current('/login')}>
                Sign in
              </Link>
              <Link href="/register" aria-current={current('/register')}>
                Create account
              </Link>
            </>
          )}
          <button type="button" className="icon-btn" aria-label="Help: what the scores mean" onClick={() => setHelpOpen(true)}>
            ?
          </button>
        </nav>
      </div>
    </header>
  );
}
