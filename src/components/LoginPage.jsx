import React, { useState } from 'react';
import { useAuth } from '../contexts/authContext';

export default function LoginPage() {
  const { login, authConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
    // No success branch: a signed-in user unmounts this screen entirely, so
    // clearing the spinner here would set state on a gone component.
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="" width={72} height={72} className="w-16 h-16 rounded-2xl shadow-md mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">TrendMint</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
          {!authConfigured && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <p className="font-semibold">Sign-in is not configured</p>
              <p className="mt-1">Set SESSION_SECRET in the site environment, then redeploy.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="text-sm font-semibold text-gray-700 block mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-semibold text-gray-700 block mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !authConfigured}
            className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? '⏳ Signing in...' : 'Sign In'}
          </button>

          <p className="text-xs text-gray-500 text-center pt-2 border-t border-gray-100">
            No account? An administrator creates accounts for you.
          </p>
        </form>
      </div>
    </div>
  );
}
