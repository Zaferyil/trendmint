import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../contexts/authContext';
import { authService } from '../services/authService';
import { setUnauthorizedHandler } from '../services/api';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authConfigured, setAuthConfigured] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await authService.me();
      setUser(result.user);
      setAuthConfigured(result.authConfigured !== false);
    } catch {
      // A failure here means the session is absent or the API is unreachable;
      // either way the correct screen is the login form.
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      // Cleared regardless: if the call failed the cookie may still be live,
      // but leaving the UI signed in would be the more confusing outcome.
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const result = await authService.changePassword(currentPassword, newPassword);
    setUser(result.user);
    return result.user;
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, authConfigured, login, logout, changePassword, refresh }),
    [user, isLoading, authConfigured, login, logout, changePassword, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
