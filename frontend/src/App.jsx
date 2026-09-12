import React, { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import CampaignPlanner from './components/CampaignPlanner'
import ContentLibrary from './components/ContentLibrary'
import Analytics from './components/Analytics'
import Settings from './components/Settings'

export default function App() {
  const [activeTab, setActiveTab] = useState('planner')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [posts, setPosts] = useState([])

  // Load posts from localStorage
  useEffect(() => {
    const savedPosts = localStorage.getItem('sirkwtime_posts')
    if (savedPosts) {
      setPosts(JSON.parse(savedPosts))
    }
  }, [])

  const handleScheduleCampaign = (campaignData) => {
    // Generate posts based on campaign data
    const newPosts = []
    for (let i = 0; i < campaignData.postCount; i++) {
      const timeIndex = i % campaignData.selectedTimes.length
      const typeIndex = i % campaignData.postTypes.length

      const newPost = {
        id: Date.now() + i,
        type: campaignData.postTypes[typeIndex],
        time: campaignData.selectedTimes[timeIndex],
        content: `Beispiel-Inhalt für Mental Arithmetik Post ${i + 1}\n\n🧠 Trainiere dein Gehirn mit SirkWTime!\n\n#MentalArithmetik #BrainTraining #Österreich #SirkWTime`,
        status: campaignData.scheduleMode === 'now' ? 'posted' : 'scheduled',
        createdAt: new Date().toISOString(),
        metrics: {
          views: Math.floor(Math.random() * 5000) + 500,
          likes: Math.floor(Math.random() * 500) + 50,
          engagement: (Math.random() * 15).toFixed(2)
        }
      }
      newPosts.push(newPost)
    }

    const allPosts = [...newPosts, ...posts]
    setPosts(allPosts)
    localStorage.setItem('sirkwtime_posts', JSON.stringify(allPosts))

    alert(`✅ ${campaignData.postCount} Posts ${campaignData.scheduleMode === 'now' ? 'gepostet' : 'geplant'}!`)
  }

  const tabs = [
    { id: 'planner', label: '📅 Kampagne', icon: '🎯' },
    { id: 'library', label: '📚 Verlauf', icon: '📖' },
    { id: 'analytics', label: '📊 Analytics', icon: '📊' },
    { id: 'settings', label: '⚙️ Einstellungen', icon: '⚙️' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📱</div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  SirkWTime Manager
                </h1>
                <p className="text-xs text-gray-500">Instagram Automation für Österreich</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`p-3 rounded-lg font-medium transition-all text-center ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <div>{tab.icon}</div>
                  <div className="text-xs mt-1">{tab.label}</div>
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="min-h-[calc(100vh-200px)]">
          {/* Campaign Planner Tab */}
          {activeTab === 'planner' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  🎯 Kampagne erstellen
                </h2>
                <p className="text-gray-600">
                  Planen Sie automatisierte Instagram-Posts für Mental Aritmetik
                </p>
              </div>
              <CampaignPlanner onSchedule={handleScheduleCampaign} />
            </div>
          )}

          {/* Content Library Tab */}
          {activeTab === 'library' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  📚 Content Verwaltung
                </h2>
                <p className="text-gray-600">
                  Verwalten Sie alle Ihre geposteten und geplanten Inhalte
                </p>
              </div>
              <ContentLibrary posts={posts} />
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  📊 Performance Analyse
                </h2>
                <p className="text-gray-600">
                  Verfolgen Sie die Leistung Ihrer Instagram-Kampagnen
                </p>
              </div>
              <Analytics />
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  ⚙️ Konfiguration
                </h2>
                <p className="text-gray-600">
                  Instagram API und Content-Strategie einrichten
                </p>
              </div>
              <Settings />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-3">SirkWTime</h3>
              <p className="text-gray-400 text-sm">
                Mental Aritmetik & Brain Fit Kids Lernprogramm für Österreich
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-3">Features</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>🤖 Automatisierte Posts</li>
                <li>📊 Analytics & Tracking</li>
                <li>🎯 Content Planung</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-3">Kontakt</h3>
              <p className="text-gray-400 text-sm">
                📧 info@sirkwtime.at<br />
                📍 Linz, Österreich
              </p>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-4 text-center text-gray-400 text-sm">
            <p>© 2024 SirkWTime. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
