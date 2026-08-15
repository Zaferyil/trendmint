const CLAUDE_API_BASE = 'https://api.anthropic.com/v1';
const DEFAULT_MODEL = 'claude-sonnet-5';

async function callClaude({ apiKey, model, maxTokens, prompt }) {
  const response = await fetch(`${CLAUDE_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Claude API error (${response.status})`);
    error.status = response.status;
    error.detail = detail.slice(0, 500);
    throw error;
  }

  const data = await response.json();
  return data.content?.map((block) => block.text || '').join('') || '';
}

export async function generateDesign({ trendName, category = 'tshirt', style = 'modern', apiKey, model = DEFAULT_MODEL }) {
  if (!apiKey) {
    return { status: 501, body: { success: false, error: 'ANTHROPIC_API_KEY not configured on the server' } };
  }
  if (!trendName) {
    return { status: 400, body: { success: false, error: 'trendName is required' } };
  }

  const prompt = `You are a professional t-shirt designer specializing in trending designs for POD (print-on-demand).

Generate a unique t-shirt design based on this trend:
Trend: "${trendName}"
Category: ${category}
Style: ${style}

IMPORTANT: The design must have a TRANSPARENT BACKGROUND for t-shirt printing.

Return ONLY valid JSON (no markdown, no extra text):
{
  "name": "Design name",
  "description": "2-3 sentence design description",
  "imagePrompt": "Detailed prompt for an image generation tool to create the design. Must specify transparent background.",
  "elements": ["element 1", "element 2", "element 3"],
  "colors": [
    {"name": "Color name", "hex": "#RRGGBB"},
    {"name": "Color name", "hex": "#RRGGBB"}
  ],
  "complexity": "simple|moderate|complex",
  "targetAudience": "Description of target audience",
  "printTips": "Tips for printing this design on t-shirts"
}`;

  try {
    const text = await callClaude({ apiKey, model, maxTokens: 1024, prompt });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const design = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!design) {
      return { status: 502, body: { success: false, error: 'Failed to parse design response' } };
    }

    return { status: 200, body: { success: true, design } };
  } catch (error) {
    return {
      status: error.status || 502,
      body: { success: false, error: error.message, detail: error.detail },
    };
  }
}

export async function generateVariations({ trendName, count = 3, apiKey, model = DEFAULT_MODEL }) {
  if (!apiKey) {
    return { status: 501, body: { success: false, error: 'ANTHROPIC_API_KEY not configured on the server' } };
  }
  if (!trendName) {
    return { status: 400, body: { success: false, error: 'trendName is required' } };
  }

  const safeCount = Math.min(Math.max(Number(count) || 3, 1), 6);

  const prompt = `You are a professional t-shirt designer. Generate ${safeCount} unique design variations for this trend.

Trend: "${trendName}"

Each design must have TRANSPARENT BACKGROUND for t-shirt printing.

Return ONLY a valid JSON array (no markdown, no extra text):
[
  {
    "id": 1,
    "name": "Design name",
    "description": "1-2 sentence description",
    "imagePrompt": "Detailed image generation prompt",
    "style": "modern|vintage|minimalist|artistic|playful",
    "colors": [{"name": "Color", "hex": "#RRGGBB"}],
    "elements": ["element 1", "element 2"]
  }
]`;

  try {
    const text = await callClaude({ apiKey, model, maxTokens: 2048, prompt });
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const variations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return { status: 200, body: { success: true, variations } };
  } catch (error) {
    return {
      status: error.status || 502,
      body: { success: false, error: error.message, detail: error.detail },
    };
  }
}
