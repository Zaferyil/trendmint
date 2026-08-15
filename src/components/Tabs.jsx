import React from 'react';

export default function Tabs({ activeTab, onTabChange, tabs }) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex gap-1 sm:gap-4 max-w-7xl mx-auto px-2 sm:px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            /* nowrap: at 375px "Etsy Trends" broke across two lines and pushed
               the underline out of alignment with the label. */
            className={`py-3 sm:py-4 px-3 sm:px-6 text-sm sm:text-base font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="mr-1.5 sm:mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
