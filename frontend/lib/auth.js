'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api('/auth/me');
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { user: u } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setUser(u);
    return u;
  };

  const register = async (name, email, password) => {
    const { user: u } = await api('/auth/register', { method: 'POST', body: { name, email, password } });
    setUser(u);
    return u;
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  const markOnboarded = async () => {
    setUser((u) => (u ? { ...u, onboarded: true } : u));
    try {
      await api('/auth/onboarded', { method: 'POST' });
    } catch {
      /* not critical */
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, register, logout, markOnboarded, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
