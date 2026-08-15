const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;
const CLAUDE_API_BASE = 'https://api.anthropic.com/v1';

export const claudeService = {
  async generateDesignFromTrend(trendName, category = 'tshirt', style = 'modern') {
    if (!CLAUDE_API_KEY) {
      console.warn('Claude API key not configured - using demo design');
      return {
        success: false,
        error: 'Claude API key not configured',
        design: generateDemoDesign(trendName),
      };
    }

    try {
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
  "imagePrompt": "Detailed prompt for DALL-E/image generation tool to create the design. Must specify transparent background.",
  "elements": ["element 1", "element 2", "element 3"],
  "colors": [
    {"name": "Color name", "hex": "#RRGGBB"},
    {"name": "Color name", "hex": "#RRGGBB"}
  ],
  "complexity": "simple|moderate|complex",
  "targetAudience": "Description of target audience",
  "printTips": "Tips for printing this design on t-shirts"
}`;

      const response = await fetch(`${CLAUDE_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      const textContent = data.content[0].text;

      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      const designData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (!designData) {
        throw new Error('Failed to parse design response');
      }

      return {
        success: true,
        design: designData,
      };
    } catch (error) {
      console.error('Error generating design:', error);
      return {
        success: false,
        error: error.message,
        design: generateDemoDesign(trendName),
      };
    }
  },

  async generateDesignVariations(trendName, count = 3) {
    if (!CLAUDE_API_KEY) {
      console.warn('Claude API key not configured');
      return {
        success: false,
        error: 'Claude API key not configured',
        variations: generateDemoVariations(trendName, count),
      };
    }

    try {
      const prompt = `You are a professional t-shirt designer. Generate ${count} unique design variations for this trend.

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

      const response = await fetch(`${CLAUDE_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      const textContent = data.content[0].text;

      const jsonMatch = textContent.match(/\[[\s\S]*\]/);
      const variations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      return {
        success: true,
        variations,
      };
    } catch (error) {
      console.error('Error generating variations:', error);
      return {
        success: false,
        error: error.message,
        variations: generateDemoVariations(trendName, count),
      };
    }
  },

  async exportDesignAsPNG(design, width = 512, height = 512) {
    try {
      return {
        success: true,
        imageUrl: '/placeholder-design.png',
        prompt: design.imagePrompt,
        message: 'Use the imagePrompt to generate image via DALL-E or Midjourney',
      };
    } catch (error) {
      console.error('Error exporting design:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

function generateDemoDesign(trendName) {
  return {
    name: `${trendName} Design`,
    description: `Professional t-shirt design inspired by the trend: ${trendName}. Perfect for print-on-demand production with transparent background.`,
    imagePrompt: `Create a trendy t-shirt design for "${trendName}" with transparent PNG background. Modern, clean aesthetic.`,
    elements: ['Main design element', 'Secondary accent', 'Text/typography'],
    colors: [
      { name: 'Primary', hex: '#10b981' },
      { name: 'Secondary', hex: '#f59e0b' },
      { name: 'Accent', hex: '#ef4444' },
    ],
    complexity: 'moderate',
    targetAudience: 'Trend enthusiasts, fashion-forward buyers',
    printTips: 'Design has transparent background. Print on colored t-shirts.',
  };
}

function generateDemoVariations(trendName, count = 3) {
  const styles = ['modern', 'vintage', 'minimalist'];
  
  return Array.from({ length: count }).map((_, idx) => ({
    id: idx + 1,
    name: `${trendName} - ${styles[idx % styles.length]} Style`,
    description: `${styles[idx % styles.length]} interpretation`,
    imagePrompt: `${styles[idx % styles.length]} t-shirt design for "${trendName}"`,
    style: styles[idx % styles.length],
    colors: [
      { name: 'Primary', hex: ['#10b981', '#3b82f6', '#ec4899'][idx] },
    ],
    elements: ['Element 1', 'Element 2'],
  }));
}
