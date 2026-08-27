import React, { useState } from 'react';
import { useAuth } from '../contexts/authContext';

const MIN_LENGTH = 10;

/**
 * Shown full-screen when the account still carries an admin-issued password,
 * and as a dismissible panel when the user opens it themselves.
 */
export default function ChangePassword({ forced = false, onClose }) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match');
      return;
    }
    if (newPassword.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Change password</h2>
        {forced && (
          <p className="text-sm text-gray-600 mt-1">
            This account is still using the password an administrator set. Choose your own to continue.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="current-password" className="text-sm font-semibold text-gray-700 block mb-1">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label htmlFor="new-password" className="text-sm font-semibold text-gray-700 block mb-1">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={MIN_LENGTH}
          autoComplete="new-password"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <p className="text-xs text-gray-500 mt-1">At least {MIN_LENGTH} characters.</p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="text-sm font-semibold text-gray-700 block mb-1">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          autoComplete="new-password"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-3 px-4 rounded-lg font-semibold text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 transition-all"
        >
          {isSubmitting ? '⏳ Saving...' : 'Save password'}
        </button>
        {!forced && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  if (forced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{form}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="w-full max-w-md mt-12">{form}</div>
    </div>
  );
}
