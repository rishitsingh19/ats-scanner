'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUI } from '@/lib/ui';

/** Shared error area under the header on every screen (SRS 3.1). */
export default function ErrorBanner() {
  const { error, clearError } = useUI();
  const pathname = usePathname();

  // An error belongs to the screen it happened on.
  useEffect(() => {
    clearError();
  }, [pathname, clearError]);

  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <div className="container">
        <p>{error}</p>
        <button type="button" onClick={clearError}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
