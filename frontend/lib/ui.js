'use client';

import { createContext, useCallback, useContext, useState } from 'react';

/** App-wide UI state: the error banner (SRS 3.1) and the help panel. */
const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [error, setError] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourRequested, setTourRequested] = useState(false);

  const showError = useCallback((err) => {
    const message = typeof err === 'string' ? err : err?.message || 'Something went wrong.';
    setError(message);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <UIContext.Provider value={{ error, showError, clearError, helpOpen, setHelpOpen, tourRequested, setTourRequested }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
