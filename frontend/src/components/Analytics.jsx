import React, { useState } from 'react'
import { TrendingUp, Users, Heart, MessageCircle } from 'lucide-react'

export default function Analytics() {
  const [timeRange, setTimeRange] = useState('week') // 'week', 'month', 'year'

  // Mock data - später von Backend
  const stats = {
    totalViews: 12450,
    totalLikes: 1230,
    totalComments: 156,
    followers: 3450,
    engagementRate: 9.87,
    reachGrowth: 23
  }

  const topContent = [
    { type: 'Reels', views: 5430, likes: 523, engagement: 9.6 },
    { type: 'Beitrag', views: 4210, likes: 398, engagement: 9.4 },
    { type: 'Story', views: 2810, likes: 309, engagement: 11.0 }
  ]

  const statCard = (icon, label, value, unit = '') => (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {value}{unit}
          </p>
        </div>
        <div className="text-blue-500 bg-white rounded-full p-3">
          {icon}
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">📊 Analytics</h2>
        <div className="flex gap-2">
          {['week', 'month', 'year'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeRange === range
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === 'week' ? 'Woche' : range === 'month' ? 'Monat' : 'Jahr'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCard(<TrendingUp size={24} />, 'Gesamte Views', stats.totalViews.toLocaleString('de-AT'))}
        {statCard(<Heart size={24} />, 'Gesamte Likes', stats.totalLikes.toLocaleString('de-AT'))}
        {statCard(<MessageCircle size={24} />, 'Kommentare', stats.totalComments.toLocaleString('de-AT'))}
        {statCard(<Users size={24} />, 'Follower', stats.followers.toLocaleString('de-AT'))}
        {statCard(null, 'Engagement Rate', stats.engagementRate, '%')}
        {statCard(null, 'Follower Wachstum', stats.reachGrowth, '%')}
      </div>

      {/* Top Performing Content */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🏆 Top Content nach Typ</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topContent.map((content, index) => (
            <div key={index} className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <h4 className="font-bold text-gray-800 mb-3">{content.type}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Views:</span>
                  <span className="font-bold text-gray-800">{content.views.toLocaleString('de-AT')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Likes:</span>
                  <span className="font-bold text-gray-800">{content.likes.toLocaleString('de-AT')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Engagement:</span>
                  <span className="font-bold text-gray-800">{content.engagement}%</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-purple-300">
                <div className="w-full bg-purple-300 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${content.engagement}0%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Chart Placeholder */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">📈 Aktivität im Verlauf</h3>
        <div className="flex items-end gap-1 h-48">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t opacity-80 hover:opacity-100 transition-all"
              style={{
                height: `${Math.random() * 100}%`,
                minHeight: '10px'
              }}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Letzte 30 Tage
        </p>
      </div>
    </div>
  )
}
