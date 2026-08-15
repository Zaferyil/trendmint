import { apiClient } from './api';

export const claudeService = {
  async generateDesignFromTrend(trendName, category = 'tshirt', style = 'modern') {
    try {
      const data = await apiClient.post('/generate-design', { trendName, category, style });
      return { success: true, design: data.design };
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
    try {
      const data = await apiClient.post('/generate-variations', { trendName, count });
      return { success: true, variations: data.variations || [] };
    } catch (error) {
      console.error('Error generating variations:', error);
      return {
        success: false,
        error: error.message,
        variations: generateDemoVariations(trendName, count),
      };
    }
  },

  async exportDesignAsPNG(design) {
    return {
      success: true,
      imageUrl: '/placeholder-design.png',
      prompt: design.imagePrompt,
      message: 'Use the imagePrompt to generate image via DALL-E or Midjourney',
    };
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
    colors: [{ name: 'Primary', hex: ['#10b981', '#3b82f6', '#ec4899'][idx % 3] }],
    elements: ['Element 1', 'Element 2'],
  }));
}
