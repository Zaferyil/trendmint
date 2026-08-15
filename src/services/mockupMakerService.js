const MOCKUP_MAKER_API_URL = import.meta.env.VITE_MOCKUP_MAKER_API_URL || 'http://localhost:3000/api';

export const mockupMakerService = {
  async sendDesignToMockupMaker(design) {
    try {
      // TrendMint'ten MockupMaker'a localStorage ile transfer
      const transfer = {
        design: {
          id: `design_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          name: design.designName,
          imageUrl: design.designImage,
          imagePrompt: design.designName,
          trendName: 'Custom Design',
          category: design.category || 'apparel',
          colors: design.colors || [],
          source: 'trendmint',
          createdAt: Date.now()
        }
      };

      // localStorage'a tasarımı kaydet
      localStorage.setItem('trendmint_pending_transfer', JSON.stringify(transfer));

      // MockupMaker'ı yeni sekmede aç
      // Not: URL'yi kendi MockupMaker URL'iniz ile değiştirin
      const mockupMakerUrl = 'http://localhost:3000'; // Geliştirme ortamı
      window.open(mockupMakerUrl, '_blank');

      return {
        success: true,
        mockup: null,
      };
    } catch (error) {
      console.error('Error sending design to MockupMaker:', error);
      return {
        success: false,
        error: error.message,
        mockup: null,
      };
    }
  },

  async getAvailableTemplates() {
    try {
      const response = await fetch(`${MOCKUP_MAKER_API_URL}/templates`);

      if (!response.ok) {
        throw new Error(`MockupMaker API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        templates: data,
      };
    } catch (error) {
      console.error('Error fetching templates:', error);
      return {
        success: false,
        error: error.message,
        templates: [],
      };
    }
  },

  async generateMockupWithTemplate(designImage, templateId, productColor = 'black') {
    try {
      const response = await fetch(`${MOCKUP_MAKER_API_URL}/generate-mockup-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          designImage,
          templateId,
          productColor,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`MockupMaker API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        mockup: data,
      };
    } catch (error) {
      console.error('Error generating mockup with template:', error);
      return {
        success: false,
        error: error.message,
        mockup: null,
      };
    }
  },

  async exportMockup(mockupId, format = 'png') {
    try {
      const response = await fetch(
        `${MOCKUP_MAKER_API_URL}/export/${mockupId}?format=${format}`
      );

      if (!response.ok) {
        throw new Error(`Export error: ${response.statusText}`);
      }

      const blob = await response.blob();
      return {
        success: true,
        blob,
      };
    } catch (error) {
      console.error('Error exporting mockup:', error);
      return {
        success: false,
        error: error.message,
        blob: null,
      };
    }
  },
};
