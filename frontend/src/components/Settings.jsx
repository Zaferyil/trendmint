import React, { useState } from 'react'
import { Save, Settings as SettingsIcon, Key } from 'lucide-react'

export default function Settings() {
  const [settings, setSettings] = useState({
    instagramToken: localStorage.getItem('instagramToken') || '',
    instagramBusinessAccountId: localStorage.getItem('instagramBusinessAccountId') || '',
    contentFocus: localStorage.getItem('contentFocus') || '80',
    language: localStorage.getItem('language') || 'de',
    autoPublish: localStorage.getItem('autoPublish') === 'true',
    emailNotifications: localStorage.getItem('emailNotifications') === 'true',
  })

  const [saved, setSaved] = useState(false)

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    Object.keys(settings).forEach(key => {
      if (typeof settings[key] === 'boolean') {
        localStorage.setItem(key, settings[key])
      } else {
        localStorage.setItem(key, settings[key])
      }
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const settingGroup = (title, children) => (
    <div className="border-b border-gray-200 pb-6 mb-6 last:border-b-0">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      {children}
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="text-gray-600" size={28} />
        <h2 className="text-2xl font-bold text-gray-800">Einstellungen</h2>
      </div>

      {saved && (
        <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded mb-6 flex items-center gap-2">
          <span>✅</span>
          <span>Einstellungen gespeichert!</span>
        </div>
      )}

      {/* Instagram API Keys */}
      {settingGroup('🔐 Instagram API Konfiguration', (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instagram Access Token
            </label>
            <input
              type="password"
              value={settings.instagramToken}
              onChange={(e) => handleChange('instagramToken', e.target.value)}
              placeholder="Geben Sie Ihren Instagram Access Token ein"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              Finden Sie dies in Ihrem Instagram Developer Dashboard
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instagram Business Account ID
            </label>
            <input
              type="text"
              value={settings.instagramBusinessAccountId}
              onChange={(e) => handleChange('instagramBusinessAccountId', e.target.value)}
              placeholder="z.B. 123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      ))}

      {/* Content Strategy */}
      {settingGroup('📝 Content-Strategie', (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Content-Fokus
            </label>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700">Mental Aritmetik</span>
                  <span className="font-bold text-primary">{settings.contentFocus}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.contentFocus}
                  onChange={(e) => handleChange('contentFocus', e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="text-sm text-gray-600">
                Brain Fit Kids Bundle: <strong>{100 - parseInt(settings.contentFocus)}%</strong>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sprache
            </label>
            <select
              value={settings.language}
              onChange={(e) => handleChange('language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="de">🇩🇪 Deutsch (Österreich)</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
        </div>
      ))}

      {/* Automation Settings */}
      {settingGroup('⚙️ Automatisierung', (
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoPublish}
              onChange={(e) => handleChange('autoPublish', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-gray-700 font-medium">
              Automatisches Posten aktivieren
            </span>
          </label>
          <p className="text-xs text-gray-500 pl-7">
            Postet automatisch zu den geplanten Uhrzeiten
          </p>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => handleChange('emailNotifications', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-gray-700 font-medium">
              E-Mail Benachrichtigungen
            </span>
          </label>
          <p className="text-xs text-gray-500 pl-7">
            Benachrichtigung nach jedem geposteten Inhalt
          </p>
        </div>
      ))}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 bg-primary text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <Save size={20} />
          Speichern
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 transition-all"
        >
          Zurücksetzen
        </button>
      </div>

      {/* Security Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
        <div className="flex gap-2">
          <Key size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>Sicherheit:</strong> Ihre Tokens werden lokal im Browser gespeichert.
            Geben Sie diese niemals an Dritte weiter.
          </div>
        </div>
      </div>
    </div>
  )
}
