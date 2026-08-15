import React, { useState } from 'react';

export default function DesignExport({ design, isExporting = false, onExport, onSendToMockupMaker }) {
  const [exportFormat, setExportFormat] = useState('png');
  const [productColor, setProductColor] = useState('black');

  const handleDownload = async () => {
    if (onExport) {
      await onExport(design, exportFormat);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Export & Mockup</h3>

      {design && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Design:</span> {design.name}
            </p>
            {design.printTips && (
              <p className="text-xs text-gray-600 mt-2">
                <span className="font-semibold">Print Tips:</span> {design.printTips}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Export Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('png')}
                className={`px-4 py-2 rounded text-sm font-semibold transition-all ${
                  exportFormat === 'png'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                PNG (Transparent)
              </button>
              <button
                onClick={() => setExportFormat('jpg')}
                className={`px-4 py-2 rounded text-sm font-semibold transition-all ${
                  exportFormat === 'jpg'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                JPG (Solid BG)
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">T-Shirt Color</label>
            <div className="flex gap-2 flex-wrap">
              {['black', 'white', 'navy', 'red', 'gray', 'navy-blue'].map((color) => (
                <button
                  key={color}
                  onClick={() => setProductColor(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    productColor === color ? 'ring-2 ring-green-500 border-green-500' : 'border-gray-300'
                  }`}
                  style={{
                    backgroundColor: {
                      black: '#000000',
                      white: '#FFFFFF',
                      navy: '#001a4d',
                      red: '#DC2626',
                      gray: '#808080',
                      'navy-blue': '#0f3460',
                    }[color],
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={isExporting}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
              isExporting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
            }`}
          >
            {isExporting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Exporting...
              </span>
            ) : (
              <span>📥 Download {exportFormat.toUpperCase()}</span>
            )}
          </button>

          <button
            onClick={() => onSendToMockupMaker && onSendToMockupMaker(design, productColor)}
            disabled={isExporting}
            className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-purple-500 hover:bg-purple-600 transition-all disabled:bg-gray-400"
          >
            <span>🖼️ Send to MockupMaker (Preview on T-Shirt)</span>
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-semibold mb-1">💡 Tip:</p>
            <p>PNG with transparent background is recommended for t-shirt printing.</p>
          </div>
        </div>
      )}
    </div>
  );
}
