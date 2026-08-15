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
        <div className="flex gap-2">
          {trend.metrics?.classification && (
            <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              {trend.metrics.classification}
            </span>
          )}
          <span className={badgeClass}>
            {source.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Trend Tier + Age Info */}
      {trend.metrics?.trendTier && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">{trend.metrics.trendTier}</span>
          {trend.garment && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {trend.garment}
            </span>
          )}
          {trend.metrics.trendAge !== null && trend.metrics.trendAge !== undefined && (
            <span className="text-xs text-gray-500">
              • {trend.metrics.trendAge}d old
            </span>
          )}
        </div>
      )}

      {trend.description && (
        <p className="text-gray-600 text-sm mb-3">{trend.description}</p>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-2">
          {trend.metrics && (
            <>
              {/* Compared against undefined, not truthiness: a genuine zero is
                  information, and hiding the badge reads as "no data". */}
              {trend.metrics.views !== undefined && (
                <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">
                  👁️ {trend.metrics.views}
                </span>
              )}
              {trend.metrics.favorites !== undefined && (
                <span className="px-2 py-1 bg-red-50 rounded text-red-600 font-semibold">
                  ❤️ {trend.metrics.favorites}
                </span>
              )}
              {/* Per-day rate, not a growth figure: Etsy exposes no historical
                  counts, so any "% growth" here would be invented. Totals are
                  divided by listing age, which is what separates an active
                  listing from one that merely had years to accumulate. */}
              {trend.metrics.viewsPerDay !== undefined && (
                <span className="px-2 py-1 bg-green-100 rounded text-green-700 font-semibold">
                  ⚡ {trend.metrics.viewsPerDay} views/day
                </span>
              )}
              {trend.metrics.favoriteRate && (
                <span className="px-2 py-1 bg-purple-50 rounded text-purple-700 font-semibold">
                  📈 {trend.metrics.favoriteRate} save rate
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
