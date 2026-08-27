import { apiClient } from './api';

/**
 * The session itself is an HttpOnly cookie, so nothing here stores or reads a
 * token — the browser attaches it and script cannot touch it. These calls only
 * move user records around.
 */
export const authService = {
  me: () => apiClient.get('/auth/me'),
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  logout: () => apiClient.post('/auth/logout'),
  changePassword: (currentPassword, newPassword) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),

  listUsers: () => apiClient.get('/users'),
  createUser: (user) => apiClient.post('/users', user),
  updateUser: (update) => apiClient.post('/users/update', update),
  resetPassword: (email, password) => apiClient.post('/users/reset-password', { email, password }),
  deleteUser: (email) => apiClient.post('/users/delete', { email }),
};
