import React from 'react';

export default function DesignPreview({ design, isLoading = false, isGeneratingImage = false }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Design Preview</h3>

      {isLoading ? (
        <div className="design-preview transparency-grid animate-pulse">
          <div className="w-48 h-48 bg-gray-300 rounded-lg"></div>
        </div>
      ) : design ? (
        <div className="space-y-4">
          <div className="design-preview transparency-grid border-2 border-gray-200">
            {design.imageUrl ? (
              <img
                src={design.imageUrl}
                alt={design.name}
                className="max-w-xs max-h-80 object-contain"
              />
            ) : isGeneratingImage ? (
              <div className="text-center text-gray-500">
                <p className="text-4xl mb-2 animate-spin">⏳</p>
                <p>Generating artwork...</p>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-4xl mb-2">🎨</p>
                <p>Press "Generate Image" to create the artwork</p>
              </div>
            )}
          </div>

          {design.imagePrompt && !design.imageUrl && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Image Prompt</h4>
              <p className="text-xs text-gray-600 mb-2">
                Feed this to any image generator, or press "Generate Image" above.
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{design.imagePrompt}</p>
            </div>
          )}

          {design.description && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Description</h4>
              <p className="text-gray-700">{design.description}</p>
            </div>
          )}

          {design.colors && design.colors.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">Color Palette</h4>
              <div className="flex flex-wrap gap-3">
                {design.colors.map((color, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                      style={{ backgroundColor: color.hex || color }}
                      title={color.name || color}
                    ></div>
                    <span className="text-sm text-gray-700">
                      {color.name || color}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {design.elements && design.elements.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Design Elements</h4>
              <ul className="space-y-1">
                {design.elements.map((element, idx) => (
                  <li key={idx} className="text-gray-700 flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    {element}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="design-preview transparency-grid border-2 border-dashed border-gray-300">
          <div className="text-center text-gray-400">
            <p className="text-4xl mb-2">✨</p>
            <p>Select a trend and generate a design</p>
          </div>
        </div>
      )}
    </div>
  );
}
