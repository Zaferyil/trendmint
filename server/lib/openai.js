const OPENAI_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-image-1';

/**
 * Generates the actual artwork from a design's imagePrompt. Returns a data URL
 * so the frontend can show and download the PNG without any extra hosting.
 *
 * gpt-image-1 answers with base64; dall-e-3 answers with a temporary URL, so
 * both shapes are handled and either model can be set via OPENAI_IMAGE_MODEL.
 */
// Netlify's synchronous functions time out at ~10s, so the default leans on the
// fastest settings. Raise via OPENAI_IMAGE_QUALITY once a longer timeout is
// available on the plan.
export async function generateImage({ prompt, apiKey, model = DEFAULT_MODEL, size = '1024x1024', quality = 'standard' }) {
  if (!apiKey) {
    return { status: 501, body: { success: false, error: 'OPENAI_API_KEY not configured on the server' } };
  }
  if (!prompt) {
    return { status: 400, body: { success: false, error: 'prompt is required' } };
  }

  const isGptImage = model.startsWith('gpt-image');

  const payload = {
    model,
    prompt,
    n: 1,
    size,
    ...(isGptImage
      ? { quality, background: 'transparent', output_format: 'png' }
      : { quality: quality === 'low' ? 'standard' : 'hd', response_format: 'b64_json' }),
  };

  try {
    const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      let reason = '';
      try {
        reason = JSON.parse(detail)?.error?.message || '';
      } catch {
        reason = '';
      }
      return {
        status: response.status,
        body: {
          success: false,
          error: `OpenAI image error (${response.status})${reason ? `: ${reason}` : ''}`,
          detail: detail.slice(0, 500),
        },
      };
    }

    const data = await response.json();
    const image = data.data?.[0];

    if (image?.b64_json) {
      return { status: 200, body: { success: true, imageUrl: `data:image/png;base64,${image.b64_json}` } };
    }
    if (image?.url) {
      return { status: 200, body: { success: true, imageUrl: image.url } };
    }

    return { status: 502, body: { success: false, error: 'OpenAI returned no image' } };
  } catch (error) {
    return { status: 502, body: { success: false, error: error.message } };
  }
}
