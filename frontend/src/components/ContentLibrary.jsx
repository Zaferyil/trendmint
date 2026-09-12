import React, { useState } from 'react'
import { Trash2, Eye, Heart } from 'lucide-react'

export default function ContentLibrary({ posts }) {
  const [selectedPost, setSelectedPost] = useState(null)

  const getPostTypeIcon = (type) => {
    switch(type) {
      case 'Story':
        return '📖'
      case 'Beitrag':
        return '📝'
      case 'Reels':
        return '🎬'
      default:
        return '📱'
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'posted':
        return 'bg-green-100 text-green-800'
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status) => {
    switch(status) {
      case 'posted':
        return '✅ Gepostet'
      case 'scheduled':
        return '⏰ Geplant'
      case 'failed':
        return '❌ Fehler'
      default:
        return 'Unbekannt'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Content Verlauf</h2>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-2">📚 Noch keine Posts</p>
          <p className="text-gray-400">Erstellen Sie Ihre erste Kampagne</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getPostTypeIcon(post.type)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {post.type} • {post.time}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {new Date(post.createdAt).toLocaleDateString('de-AT')}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(post.status)}`}>
                  {getStatusLabel(post.status)}
                </span>
              </div>

              {/* Content Preview */}
              <div className="bg-gray-50 rounded p-3 mb-3 max-h-20 overflow-hidden">
                <p className="text-sm text-gray-700 line-clamp-3">{post.content}</p>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                {post.metrics && (
                  <>
                    <div className="flex items-center gap-1">
                      <Eye size={16} className="text-blue-500" />
                      <span>{post.metrics.views} Views</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart size={16} className="text-red-500" />
                      <span>{post.metrics.likes} Likes</span>
                    </div>
                    <div className="text-right flex-1">
                      <span className="text-gray-700 font-medium">
                        {post.metrics.engagement}% Engagement
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPost(selectedPost === index ? null : index)}
                  className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded hover:bg-blue-200 transition-all text-sm font-medium"
                >
                  {selectedPost === index ? 'Verbergen' : 'Details'}
                </button>
                <button
                  className="flex-1 bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200 transition-all text-sm font-medium flex items-center justify-center gap-1"
                >
                  <Trash2 size={16} />
                  Löschen
                </button>
              </div>

              {/* Expanded Details */}
              {selectedPost === index && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Vollständiger Inhalt</h4>
                  <p className="text-gray-700 text-sm mb-3">{post.content}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-gray-600">Post-Typ</p>
                      <p className="font-semibold text-gray-800">{post.type}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-gray-600">Uhrzeit</p>
                      <p className="font-semibold text-gray-800">{post.time}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
