import React from 'react';

export default function ActionButtons({
  selectedTrend,
  onGenerateDesign,
  onSendToMockupMaker,
  isGeneratingDesign,
  isDesignReady,
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Actions</h3>

      <button
        onClick={onGenerateDesign}
        disabled={!selectedTrend || isGeneratingDesign}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
          selectedTrend && !isGeneratingDesign
            ? 'bg-green-500 hover:bg-green-600 cursor-pointer'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        {isGeneratingDesign ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span>
            Generating Design...
          </span>
        ) : (
          <span>✨ Generate Design</span>
        )}
      </button>

      <button
        onClick={onSendToMockupMaker}
        disabled={!isDesignReady}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
          isDesignReady
            ? 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        <span>📦 Send to MockupMaker</span>
      </button>

      <div className="text-xs text-gray-600 pt-4 border-t border-gray-200">
        <p>1. Select a trend</p>
        <p>2. Generate design</p>
        <p>3. Send to MockupMaker for t-shirt preview</p>
      </div>
    </div>
  );
}
