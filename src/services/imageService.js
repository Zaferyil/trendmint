import { apiClient } from './api';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180000; // 3 minutes; generation runs 10-60s in practice

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const imageService = {
  /**
   * Turns a design's imagePrompt into real artwork via the backend proxy.
   *
   * The request only starts the job: drawing takes longer than a serverless
   * function may run, so the server hands back an id and the result is polled
   * for. Resolves to a data URL that can be shown and downloaded directly.
   *
   * onProgress receives elapsed seconds so the UI can show something moving
   * during a wait this long.
   */
  async generateImage(design, { onProgress } = {}) {
    const prompt = design?.imagePrompt;

    if (!prompt) {
      return { success: false, error: 'Design has no image prompt' };
    }

    try {
      const start = await apiClient.post('/generate-image', { prompt });

      // A server without the job pipeline answers with the image directly.
      if (start.imageUrl) {
        return { success: true, imageUrl: start.imageUrl };
      }
      if (!start.jobId) {
        return { success: false, error: start.error || 'Image generation did not start' };
      }

      const startedAt = Date.now();

      while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        await sleep(POLL_INTERVAL_MS);
        onProgress?.(Math.round((Date.now() - startedAt) / 1000));

        const job = await apiClient.get(`/image-job?id=${encodeURIComponent(start.jobId)}`);

        if (job.status === 'done') {
          return { success: true, imageUrl: job.imageUrl };
        }
        if (job.status === 'error') {
          return { success: false, error: job.error || 'Image generation failed' };
        }
        // 'pending' — keep waiting.
      }

      return { success: false, error: 'Image generation timed out. Please try again.' };
    } catch (error) {
      console.error('Error generating image:', error);
      return { success: false, error: error.message };
    }
  },
};
