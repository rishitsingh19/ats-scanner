'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function Loading({ label = 'Loading' }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Only the signed-in owner can see their data (SRS 5.5). Redirects to sign-in otherwise. */
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <main className="page container">
        <Loading />
      </main>
    );
  }
  return children;
}
