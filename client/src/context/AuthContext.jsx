import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, settings } from '../lib/api';

const AuthContext = createContext(null);

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth check timed out')), ms)
    ),
  ]);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requireLogin, setRequireLogin] = useState(true);

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  };

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setRequireLogin(true);
        setUser(null);
        return;
      }

      const me = await withTimeout(auth.me());
      setUser({ user: me.data.user });
      localStorage.setItem('username', me.data.user);

      try {
        const res = await withTimeout(settings.get(), 8000);
        const reqLogin = res.data.require_login !== 'false';
        setRequireLogin(reqLogin);
        localStorage.setItem('require_login', reqLogin ? 'true' : 'false');
      } catch {
        setRequireLogin(true);
      }
    } catch {
      clearSession();
      setRequireLogin(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const res = await auth.login(username, password);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('username', res.data.user || username);
    localStorage.setItem('require_login', 'true');
    setRequireLogin(true);
    setUser({ user: res.data.user || username });
    return res.data;
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, requireLogin, login, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
