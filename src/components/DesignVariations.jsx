import React from 'react';

export default function DesignVariations({ variations, selectedVariationId, onSelectVariation, isLoading }) {
  if (!variations || variations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Design Variations</h3>

      {isLoading && (
        <div className="text-center py-8">
          <span className="animate-spin text-3xl">⏳</span>
          <p className="text-gray-600 mt-2">Generating variations...</p>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {variations.map((variation) => (
            <div
              key={variation.id}
              onClick={() => onSelectVariation(variation)}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                selectedVariationId === variation.id
                  ? 'border-green-500 ring-2 ring-green-300 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="transparency-grid rounded-lg h-32 flex items-center justify-center mb-3 border border-gray-300">
                <div className="text-center text-gray-400">
                  <p className="text-2xl mb-1">🎨</p>
                  <p className="text-xs">{variation.style}</p>
                </div>
              </div>

              <h4 className="font-semibold text-gray-800 text-sm mb-2">{variation.name}</h4>
              <p className="text-gray-600 text-xs mb-3">{variation.description}</p>

              <div className="mb-3">
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-semibold">
                  {variation.style}
                </span>
              </div>

              {variation.colors && (
                <div className="flex gap-2 mb-3">
                  {variation.colors.map((color, idx) => (
                    <div
                      key={idx}
                      className="w-6 h-6 rounded-full border border-gray-300 shadow-sm"
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              )}

              {variation.elements && (
                <div className="text-xs text-gray-600 space-y-1">
                  {variation.elements.map((elem, idx) => (
                    <p key={idx} className="flex items-center gap-1">
                      <span className="text-green-600">✓</span> {elem}
                    </p>
                  ))}
                </div>
              )}

              {selectedVariationId === variation.id && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-green-600 font-semibold text-xs">✓ Selected</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
