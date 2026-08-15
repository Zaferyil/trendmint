import React from 'react';

export default function Tabs({ activeTab, onTabChange, tabs }) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex gap-4 max-w-7xl mx-auto px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-4 px-6 font-semibold border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
