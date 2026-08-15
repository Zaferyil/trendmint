import React, { useState, useEffect, useCallback } from 'react';
import './styles/globals.css';
import Header from './components/Header';
import Tabs from './components/Tabs';
import TrendCard from './components/TrendCard';
import DesignPreview from './components/DesignPreview';
import DesignVariations from './components/DesignVariations';
import DesignExport from './components/DesignExport';
import ActionButtons from './components/ActionButtons';
import { claudeService } from './services/claudeService';
import { mockupMakerService } from './services/mockupMakerService';
import { etsyService } from './services/etsyService';
import { imageService } from './services/imageService';
import { amazonService } from './services/amazonService';

const MOCK_ETSY_TRENDS = [
  {
    id: 'etsy-1',
    name: 'Minimalist Cat Designs',
    description: 'Simple, elegant cat illustrations',
    metrics: {
      views: 1250,
      favorites: 85,
      reviews: 24,
      rating: 4.8,
      favoriteRate: '6.80%',
      trendTier: '🔴 Hot Trend',
      trendAge: 18,
      classification: '🔥 RISING',
      growth: 45,
    },
    tags: ['cats', 'minimalist', 'cute'],
  },
  {
    id: 'etsy-2',
    name: 'Retro 90s Graphics',
    description: 'Nostalgic 90s aesthetic designs',
    metrics: {
      views: 820,
      favorites: 32,
      reviews: 12,
      rating: 4.6,
      favoriteRate: '3.90%',
      trendTier: '🟡 Strong Trend',
      trendAge: 45,
      classification: '⭐ ESTABLISHED',
      growth: 38,
    },
    tags: ['retro', '90s'],
  },
  {
    id: 'etsy-3',
    name: 'Botanical & Plants',
    description: 'Nature-inspired botanical prints',
    metrics: {
      views: 1530,
      favorites: 120,
      reviews: 38,
      rating: 4.9,
      favoriteRate: '7.84%',
      trendTier: '🔴 Hot Trend',
      trendAge: 12,
      classification: '🔥 RISING',
      growth: 52,
    },
    tags: ['plants', 'botanical'],
  },
];

const MOCK_AMAZON_TRENDS = [
  {
    id: 'amazon-1',
    name: 'Boho Plant Decor',
    description: 'Bohemian style plant decor',
    metrics: { views: '24.1K', growth: 61 },
    tags: ['boho', 'plants'],
  },
  {
    id: 'amazon-2',
    name: 'Vintage Map Prints',
    description: 'Vintage travel themed products',
    metrics: { views: '18.7K', growth: 48 },
    tags: ['vintage', 'maps'],
  },
  {
    id: 'amazon-3',
    name: 'Aesthetic Room Decor',
    description: 'Modern minimalist room decoration',
    metrics: { views: '22.5K', growth: 55 },
    tags: ['aesthetic', 'minimalist'],
  },
];

// Physical garments only — the label drives the Etsy search, the garment name
// goes into the design prompt so the artwork suits the product.
const APPAREL_CATEGORIES = [
  { id: 'tshirts', label: '👕 T-Shirts', garment: 't-shirt' },
  { id: 'sweatshirts', label: '🧥 Sweatshirts', garment: 'sweatshirt' },
  { id: 'hoodies', label: '🎽 Hoodies', garment: 'hoodie' },
];

function App() {
  const [activeTab, setActiveTab] = useState('etsy');
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [design, setDesign] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariationId, setSelectedVariationId] = useState(null);
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isExportingDesign, setIsExportingDesign] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [apparelCategory, setApparelCategory] = useState('tshirts');
  const [etsyTrends, setEtsyTrends] = useState(MOCK_ETSY_TRENDS);
  const [amazonTrends, setAmazonTrends] = useState(MOCK_AMAZON_TRENDS);

  const currentTrends = activeTab === 'etsy' ? etsyTrends : amazonTrends;

  const loadTrends = useCallback(async (tabType) => {
    setIsLoadingTrends(true);
    setError(null);

    try {
      if (tabType === 'etsy') {
        const result = await etsyService.getTrendingListings(apparelCategory, 12);
        if (result.success && result.listings.length > 0) {
          const formattedTrends = result.listings.map((listing) => ({
            id: listing.id,
            name: listing.name,
            description: listing.description,
            url: listing.url,
            metrics: {
              views: listing.metrics.views || 'N/A',
              favorites: listing.metrics.favorites || 0,
              reviews: listing.metrics.reviews || 0,
              rating: listing.metrics.rating || 0,
              growth: Math.floor(Math.random() * 60) + 20,
            },
            tags: listing.tags,
          }));
          setEtsyTrends(formattedTrends);
        } else {
          setEtsyTrends(MOCK_ETSY_TRENDS);
          setError(`Etsy: ${result.error || 'no live trends returned'} — showing demo data.`);
        }
      } else if (tabType === 'amazon') {
        const result = await amazonService.getBestSellersByCategory(apparelCategory, 12);
        if (result.success && result.products.length > 0) {
          const formattedTrends = result.products.map((product) => ({
            id: product.id,
            name: product.name,
            description: `Rating: ${product.rating}`,
            metrics: {
              views: `${product.reviews || 0} reviews`,
              growth: Math.floor(Math.random() * 60) + 20,
            },
            tags: product.tags || [],
          }));
          setAmazonTrends(formattedTrends);
        } else {
          setAmazonTrends(MOCK_AMAZON_TRENDS);
        }
      }
    } catch (err) {
      console.error('Error loading trends:', err);
      setError('Failed to load trends. Using demo data.');
    } finally {
      setIsLoadingTrends(false);
    }
  }, [apparelCategory]);

  useEffect(() => {
    loadTrends(activeTab);
  }, [activeTab, loadTrends]);

  const handleTrendSelect = (trend) => {
    setSelectedTrend(trend);
    setDesign(null);
    setVariations([]);
    setSelectedVariationId(null);
    setError(null);
  };

  const handleGenerateDesign = async () => {
    if (!selectedTrend) return;

    setIsGeneratingDesign(true);
    setError(null);

    try {
      const result = await claudeService.generateDesignFromTrend(
        selectedTrend.name,
        APPAREL_CATEGORIES.find((c) => c.id === apparelCategory)?.garment || 't-shirt',
        'modern'
      );

      if (!result.success) {
        setError(result.error);
      }

      setDesign(result.design);

      await generateVariations();
    } catch (err) {
      setError('Failed to generate design: ' + err.message);
    } finally {
      setIsGeneratingDesign(false);
    }
  };

  const generateVariations = async () => {
    if (!selectedTrend) return;

    setIsGeneratingVariations(true);

    try {
      const result = await claudeService.generateDesignVariations(selectedTrend.name, 3);

      if (result.success) {
        setVariations(result.variations);
        if (result.variations.length > 0) {
          setSelectedVariationId(result.variations[0].id);
        }
      } else {
        setVariations(result.variations || []);
      }
    } catch (err) {
      console.error('Error generating variations:', err);
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!design) return;

    setIsGeneratingImage(true);
    setError(null);

    try {
      const result = await imageService.generateImage(design);

      if (result.success) {
        setDesign((current) => ({ ...current, imageUrl: result.imageUrl }));
      } else {
        setError('Failed to generate image: ' + result.error);
      }
    } catch (err) {
      setError('Error generating image: ' + err.message);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSelectVariation = (variation) => {
    setSelectedVariationId(variation.id);
    setDesign({
      ...design,
      // The artwork belongs to the previous variation's prompt.
      imageUrl: undefined,
      name: variation.name,
      description: variation.description,
      colors: variation.colors,
      elements: variation.elements,
      imagePrompt: variation.imagePrompt,
    });
  };

  const handleExportDesign = async (designToExport, format = 'png') => {
    if (!designToExport) return;

    if (!designToExport.imageUrl) {
      setError('Generate the image first, then download it.');
      return;
    }

    setIsExportingDesign(true);

    try {
      const response = await fetch(designToExport.imageUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${designToExport.name || 'trendmint-design'}.${format}`.replace(/\s+/g, '-').toLowerCase();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError('Error exporting design: ' + err.message);
    } finally {
      setIsExportingDesign(false);
    }
  };

  const handleSendToMockupMaker = async (designToSend, productColor = 'black') => {
    if (!designToSend) return;

    try {
      const mockupResult = await mockupMakerService.sendDesignToMockupMaker({
        designName: designToSend.name,
        designImage: designToSend.imageUrl || '/placeholder-design.png',
        category: 'tshirt',
        productColor: productColor,
        colors: designToSend.colors,
      });

      if (mockupResult.success) {
        alert('✅ Design sent to MockupMaker!');
      } else {
        setError('Failed to send to MockupMaker: ' + mockupResult.error);
      }
    } catch (err) {
      setError('Error sending to MockupMaker: ' + err.message);
    }
  };

  const tabs = [
    { id: 'etsy', label: 'Etsy Trends', icon: '🟡' },
    { id: 'amazon', label: 'Amazon Trends', icon: '🟠' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-yellow-800">
            <p className="font-semibold">⚠️ Note:</p>
            <p>{error}</p>
          </div>
        )}

        {isLoadingTrends && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-blue-800">
            <p className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              <span>Loading {activeTab === 'etsy' ? 'Etsy' : 'Amazon'} trends...</span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {activeTab === 'etsy' ? '🟡 Etsy Trends' : '🟠 Amazon Trends'}
                </h2>
                {isLoadingTrends && <span className="animate-spin text-2xl">⏳</span>}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {APPAREL_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setApparelCategory(category.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      apparelCategory === category.id
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              {currentTrends.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No trends available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentTrends.map((trend) => (
                    <div
                      key={trend.id}
                      onClick={() => handleTrendSelect(trend)}
                      className={`cursor-pointer ${
                        selectedTrend?.id === trend.id ? 'ring-2 ring-green-500' : ''
                      }`}
                    >
                      <TrendCard
                        trend={trend}
                        source={activeTab}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {design && variations.length > 0 && (
              <DesignVariations
                variations={variations}
                selectedVariationId={selectedVariationId}
                onSelectVariation={handleSelectVariation}
                isLoading={isGeneratingVariations}
              />
            )}
          </div>

          <div className="space-y-6">
            <DesignPreview
              design={design}
              isLoading={isGeneratingDesign}
              isGeneratingImage={isGeneratingImage}
            />

            <ActionButtons
              selectedTrend={selectedTrend}
              onGenerateDesign={handleGenerateDesign}
              onGenerateImage={handleGenerateImage}
              onSendToMockupMaker={handleSendToMockupMaker}
              isGeneratingDesign={isGeneratingDesign}
              isGeneratingImage={isGeneratingImage}
              isDesignReady={!!design}
            />

            {design && (
              <DesignExport
                design={design}
                isExporting={isExportingDesign}
                onExport={handleExportDesign}
                onSendToMockupMaker={handleSendToMockupMaker}
              />
            )}
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-gray-300 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p>TrendMint © 2024 • Transform trends into designs</p>
          {/* Attribution and backlink required by the Etsy API terms of use. */}
          <p className="text-sm text-gray-400">
            Trend data from{' '}
            <a
              href="https://www.etsy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Etsy.com
            </a>
            . This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
