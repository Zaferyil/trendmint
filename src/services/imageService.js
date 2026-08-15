import { apiClient } from './api';

export const imageService = {
  /**
   * Turns a design's imagePrompt into real artwork via the backend proxy.
   * Resolves to a data URL that can be shown and downloaded directly.
   */
  async generateImage(design) {
    const prompt = design?.imagePrompt;

    if (!prompt) {
      return { success: false, error: 'Design has no image prompt' };
    }

    try {
      const data = await apiClient.post('/generate-image', { prompt });
      return { success: true, imageUrl: data.imageUrl };
    } catch (error) {
      console.error('Error generating image:', error);
      return { success: false, error: error.message };
    }
  },
};
