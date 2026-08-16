import { apiClient } from './api';

export const automationService = {
  getSettings: () => apiClient.get('/automation/settings'),
  saveSettings: (settings) => apiClient.post('/automation/settings', settings),
  runNow: () => apiClient.post('/automation/run-now'),
  getRuns: () => apiClient.get('/automation/runs'),

  listDesigns: () => apiClient.get('/designs'),
  // Artwork is fetched per design rather than with the list, which would
  // otherwise pull every stored image down to render a set of cards.
  getDesignImage: (id) => apiClient.get(`/design-image?id=${encodeURIComponent(id)}`),
  deleteDesign: (id) => apiClient.post('/designs/delete', { id }),
};
