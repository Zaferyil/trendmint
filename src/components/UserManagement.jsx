import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/authContext';
import { authService } from '../services/authService';

const EMPTY_FORM = { email: '', name: '', role: 'user', password: '' };

export default function UserManagement({ onClose }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await authService.listUsers();
      setUsers(result.users);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Every mutation ends the same way: report it, then re-read the list. */
  const run = async (action, successMessage) => {
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      await action();
      setNotice(successMessage);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const created = await run(
      () => authService.createUser(form),
      `${form.email} created. Share the password with them — they will be asked to change it at first sign-in.`
    );
    if (created) setForm(EMPTY_FORM);
  };

  const handleReset = async (target) => {
    const password = window.prompt(`New password for ${target.email} (at least 10 characters):`);
    if (!password) return;
    await run(
      () => authService.resetPassword(target.email, password),
      `Password reset for ${target.email}. They will be asked to change it at next sign-in.`
    );
  };

  const handleDelete = async (target) => {
    if (!window.confirm(`Delete ${target.email}? This cannot be undone.`)) return;
    await run(() => authService.deleteUser(target.email), `${target.email} deleted.`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="w-full max-w-3xl my-8 space-y-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">👥 Users</h2>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Close
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              {notice}
            </div>
          )}

          {isLoading ? (
            <p className="text-gray-500 py-8 text-center">⏳ Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-semibold">User</th>
                    <th className="py-2 pr-3 font-semibold">Role</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => {
                    const isSelf = entry.email === currentUser?.email;
                    return (
                      <tr key={entry.id} className="border-b border-gray-100 align-middle">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-gray-800">{entry.name}</div>
                          <div className="text-gray-500 text-xs">{entry.email}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <select
                            value={entry.role}
                            disabled={isSelf || isSaving}
                            onChange={(event) =>
                              run(
                                () => authService.updateUser({ email: entry.email, role: event.target.value }),
                                `${entry.email} is now ${event.target.value}.`
                              )
                            }
                            className="border border-gray-300 rounded px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="py-3 pr-3">
                          {entry.disabled ? (
                            <span className="text-red-600 font-semibold text-xs">disabled</span>
                          ) : entry.mustChangePassword ? (
                            <span className="text-amber-600 font-semibold text-xs">must set password</span>
                          ) : (
                            <span className="text-green-600 font-semibold text-xs">active</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => handleReset(entry)}
                              disabled={isSaving}
                              className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            >
                              Reset password
                            </button>
                            <button
                              onClick={() =>
                                run(
                                  () => authService.updateUser({ email: entry.email, disabled: !entry.disabled }),
                                  `${entry.email} ${entry.disabled ? 'enabled' : 'disabled'}.`
                                )
                              }
                              disabled={isSelf || isSaving}
                              className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {entry.disabled ? 'Enable' : 'Disable'}
                            </button>
                            <button
                              onClick={() => handleDelete(entry)}
                              disabled={isSelf || isSaving}
                              className="px-2 py-1 rounded text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Add a user</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-user-email" className="text-sm font-semibold text-gray-700 block mb-1">
                Email
              </label>
              <input
                id="new-user-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label htmlFor="new-user-name" className="text-sm font-semibold text-gray-700 block mb-1">
                Name
              </label>
              <input
                id="new-user-name"
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label htmlFor="new-user-role" className="text-sm font-semibold text-gray-700 block mb-1">
                Role
              </label>
              <select
                id="new-user-role"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-user-password" className="text-sm font-semibold text-gray-700 block mb-1">
                Temporary password
              </label>
              <input
                id="new-user-password"
                type="text"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
                minLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Shown rather than masked: you have to read it out to hand it over,
              and it stops being valid the moment they set their own. */}
          <p className="text-xs text-gray-500">
            At least 10 characters. The new user must change it at first sign-in.
          </p>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto py-2.5 px-6 rounded-lg font-semibold text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 transition-all"
          >
            {isSaving ? '⏳ Saving...' : 'Create user'}
          </button>
        </form>
      </div>
    </div>
  );
}
