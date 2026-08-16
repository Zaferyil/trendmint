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
      viewsPerDay: 69.4,
      trendTier: '🔴 Hot Trend',
      trendAge: 18,
      classification: '🔥 RISING',
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
      viewsPerDay: 18.2,
      trendTier: '🟡 Strong Trend',
      trendAge: 45,
      classification: '⭐ ESTABLISHED',
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
      viewsPerDay: 127.5,
      trendTier: '🔴 Hot Trend',
      trendAge: 12,
      classification: '🔥 RISING',
    },
    tags: ['plants', 'botanical'],
  },
];

const MOCK_AMAZON_TRENDS = [
  {
    id: 'amazon-1',
    name: 'Boho Plant Decor',
    description: 'Bohemian style plant decor',
    metrics: { views: '24.1K' },
    tags: ['boho', 'plants'],
  },
  {
    id: 'amazon-2',
    name: 'Vintage Map Prints',
    description: 'Vintage travel themed products',
    metrics: { views: '18.7K' },
    tags: ['vintage', 'maps'],
  },
  {
    id: 'amazon-3',
    name: 'Aesthetic Room Decor',
    description: 'Modern minimalist room decoration',
    metrics: { views: '22.5K' },
    tags: ['aesthetic', 'minimalist'],
  },
];

// How far back the analysis looks. A listing older than the window is not a
// trend to design for, however steady its traffic — that market is settled.
// The wider options exist because a 7-day window can legitimately come back
// empty, and a quiet week should be answerable without editing code.
const TIME_WINDOWS = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 3 months' },
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
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [maxAgeDays, setMaxAgeDays] = useState(7);
  const [analysisNote, setAnalysisNote] = useState(null);
  const [imageWaitSeconds, setImageWaitSeconds] = useState(0);
  const [etsyTrends, setEtsyTrends] = useState(MOCK_ETSY_TRENDS);
  const [amazonTrends, setAmazonTrends] = useState(MOCK_AMAZON_TRENDS);

  const currentTrends = activeTab === 'etsy' ? etsyTrends : amazonTrends;

  const loadTrends = useCallback(async (tabType) => {
    setIsLoadingTrends(true);
    setError(null);
    setAnalysisNote(null);

    try {
      if (tabType === 'etsy') {
        // One pass over every wearable textile: a design idea travels across
        // tee, sweatshirt and hoodie, so splitting the search split the trend.
        const result = await etsyService.getTrendingListings('apparel', 12, maxAgeDays);
        if (result.success && result.listings.length > 0) {
          const formattedTrends = result.listings.map((listing) => ({
            id: listing.id,
            name: listing.name,
            description: listing.description,
            url: listing.url,
            garment: listing.garment,
            // Forwarded as-is. Nothing here is invented: every field is what
            // the trend classifier derived from the Etsy response.
            metrics: listing.metrics,
            tags: listing.tags,
          }));
          setEtsyTrends(formattedTrends);
          setIsLiveData(true);
          setLastAnalyzedAt(new Date());
        } else if (result.success) {
          // The API answered, the window was simply empty. Showing demo data
          // here would dress up a real answer as fake trends.
          setEtsyTrends([]);
          setIsLiveData(true);
          setLastAnalyzedAt(new Date());
          setAnalysisNote(
            result.note || 'No listing cleared the threshold in this time window.'
          );
        } else {
          setIsLiveData(false);
          setEtsyTrends(MOCK_ETSY_TRENDS);
          setError(`Etsy: ${result.error} — showing demo data.`);
        }
      } else if (tabType === 'amazon') {
        const result = await amazonService.getBestSellersByCategory('apparel', 12);
        if (result.success && result.products.length > 0) {
          const formattedTrends = result.products.map((product) => ({
            id: product.id,
            name: product.name,
            description: `Rating: ${product.rating}`,
            metrics: {
              views: `${product.reviews || 0} reviews`,
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
  }, [maxAgeDays]);

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
        // Read off the listing itself, so a hoodie trend produces hoodie
        // artwork without the user having to pick a category first.
        selectedTrend.garment || 't-shirt',
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
    setImageWaitSeconds(0);
    setError(null);

    try {
      // Generation runs on a background worker and is polled for, so it can
      // take a minute. Without a visible counter the wait reads as a hang.
      const result = await imageService.generateImage(design, {
        onProgress: setImageWaitSeconds,
      });

      if (result.success) {
        setDesign((current) => ({ ...current, imageUrl: result.imageUrl }));
      } else {
        setError('Failed to generate image: ' + result.error);
      }
    } catch (err) {
      setError('Error generating image: ' + err.message);
    } finally {
      setIsGeneratingImage(false);
      setImageWaitSeconds(0);
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

  const handleSendToMockupMaker = async (designToSend) => {
    if (!designToSend) return;

    try {
      const mockupResult = await mockupMakerService.sendDesignToMockupMaker({
        designName: designToSend.name,
        designImage: designToSend.imageUrl,
        category: 'tshirt',
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

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  {activeTab === 'etsy' ? '🟡 Etsy Trends' : '🟠 Amazon Trends'}
                </h2>
                {isLoadingTrends && <span className="animate-spin text-2xl">⏳</span>}
              </div>

              {/* Analysis runs on load and on demand — nothing refreshes on a
                  timer, so the timestamp says exactly how old the list is. */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <button
                  onClick={() => loadTrends(activeTab)}
                  disabled={isLoadingTrends}
                  className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  {isLoadingTrends ? '⏳ Analyzing...' : '🔄 Run Trend Analysis'}
                </button>

                {activeTab === 'etsy' && (
                  <div className="flex items-center gap-1">
                    {TIME_WINDOWS.map((window) => (
                      <button
                        key={window.days}
                        onClick={() => setMaxAgeDays(window.days)}
                        disabled={isLoadingTrends}
                        className={`px-3 py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-50 ${
                          maxAgeDays === window.days
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {window.label}
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'etsy' && lastAnalyzedAt && (
                  <span className="text-xs text-gray-500">
                    Last analysis: {lastAnalyzedAt.toLocaleTimeString('en-GB')}
                    {isLiveData ? ' • live Etsy data' : ' • demo data'}
                  </span>
                )}
              </div>

              {currentTrends.length === 0 ? (
                <div className="text-center py-12">
                  {/* An empty window is a finding, not an error — it says the
                      market is quiet, which is worth knowing before designing. */}
                  <p className="text-gray-600 text-lg mb-2">
                    {analysisNote || 'No trends found'}
                  </p>
                  {analysisNote && (
                    <p className="text-gray-400 text-sm">
                      Try a wider time window above.
                    </p>
                  )}
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
              imageWaitSeconds={imageWaitSeconds}
            />

            <ActionButtons
              selectedTrend={selectedTrend}
              onGenerateDesign={handleGenerateDesign}
              onGenerateImage={handleGenerateImage}
              onSendToMockupMaker={() => handleSendToMockupMaker(design)}
              isGeneratingDesign={isGeneratingDesign}
              isGeneratingImage={isGeneratingImage}
              isDesignReady={!!design}
              isImageReady={!!design?.imageUrl}
            />

            {design && (
              <DesignExport
                design={design}
                isExporting={isExportingDesign}
                onExport={handleExportDesign}
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
