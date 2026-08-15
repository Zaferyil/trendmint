import React, { useState } from 'react';

export default function TrendCard({ trend, source }) {
  const [isSelected, setIsSelected] = useState(false);

  const badgeClass = source === 'etsy' 
    ? 'trend-badge trend-badge-etsy' 
    : 'trend-badge trend-badge-amazon';

  const sourceColor = source === 'etsy' 
    ? 'border-yellow-200 hover:bg-yellow-50' 
    : 'border-orange-200 hover:bg-orange-50';

  return (
    <div
      onClick={() => setIsSelected(!isSelected)}
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-green-500 border-green-500' : `border-gray-200 ${sourceColor}`
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 flex-1">{trend.name}</h3>
        <span className={badgeClass}>
          {source.toUpperCase()}
        </span>
      </div>

      {trend.description && (
        <p className="text-gray-600 text-sm mb-3">{trend.description}</p>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-2">
          {trend.metrics && (
            <>
              {trend.metrics.views && (
                <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">
                  👁️ {trend.metrics.views}
                </span>
              )}
              {trend.metrics.favorites && (
                <span className="px-2 py-1 bg-red-50 rounded text-red-600 font-semibold">
                  ❤️ {trend.metrics.favorites}
                </span>
              )}
              {trend.metrics.growth && (
                <span className="px-2 py-1 bg-green-100 rounded text-green-700 font-semibold">
                  📈 {trend.metrics.growth}%
                </span>
              )}
            </>
          )}
        </div>
        {isSelected && (
          <span className="text-green-600 font-semibold">✓ Selected</span>
        )}
      </div>

      {/* Etsy's API terms require linking back to the original listing. */}
      {trend.url && (
        <a
          href={trend.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
        >
          View on {source === 'etsy' ? 'Etsy' : 'Amazon'} ↗
        </a>
      )}

      {trend.tags && (
        <div className="mt-3 flex flex-wrap gap-1">
          {trend.tags.map((tag, idx) => (
            <span key={idx} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
