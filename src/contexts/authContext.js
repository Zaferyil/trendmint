import { createContext, useContext } from 'react';

/**
 * Kept in a plain module rather than beside the provider component: mixing a
 * hook export into a component file trips the fast-refresh lint rule.
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}
