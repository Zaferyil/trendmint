import React, { useState } from 'react'
import { Calendar, Clock, Image, Send } from 'lucide-react'

export default function CampaignPlanner({ onSchedule }) {
  const [postCount, setPostCount] = useState(4)
  const [selectedTimes, setSelectedTimes] = useState(['09:00'])
  const [postTypes, setPostTypes] = useState(['Beitrag'])
  const [scheduleMode, setScheduleMode] = useState('later') // 'now' or 'later'

  const availableTimes = ['09:00', '12:00', '14:00', '17:00', '20:00', '21:00', '23:00']
  const postTypeOptions = ['Story', 'Beitrag', 'Reels']

  const toggleTime = (time) => {
    setSelectedTimes(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    )
  }

  const togglePostType = (type) => {
    setPostTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleSchedule = () => {
    if (selectedTimes.length === 0 || postTypes.length === 0) {
      alert('Bitte wählen Sie mindestens eine Uhrzeit und einen Post-Typ')
      return
    }

    const campaignData = {
      postCount,
      selectedTimes,
      postTypes,
      scheduleMode,
      createdAt: new Date().toISOString()
    }

    onSchedule(campaignData)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Kampagne Planen</h2>

      {/* Post Count Slider */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <label className="text-lg font-semibold text-gray-700">
            Anzahl der Posts
          </label>
          <span className="text-2xl font-bold text-primary">{postCount}</span>
        </div>
        <input
          type="range"
          min="1"
          max="8"
          value={postCount}
          onChange={(e) => setPostCount(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-sm text-gray-500 mt-1">
          <span>1</span>
          <span>8</span>
        </div>
      </div>

      {/* Post Types */}
      <div className="mb-8">
        <label className="text-lg font-semibold text-gray-700 block mb-4">
          <Image className="inline mr-2" size={20} />
          Post-Typ wählen
        </label>
        <div className="grid grid-cols-3 gap-3">
          {postTypeOptions.map(type => (
            <button
              key={type}
              onClick={() => togglePostType(type)}
              className={`p-3 rounded-lg font-medium transition-all ${
                postTypes.includes(type)
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Time Selection */}
      <div className="mb-8">
        <label className="text-lg font-semibold text-gray-700 block mb-4">
          <Clock className="inline mr-2" size={20} />
          Uhrzeiten wählen
        </label>
        <div className="grid grid-cols-4 gap-2">
          {availableTimes.map(time => (
            <button
              key={time}
              onClick={() => toggleTime(time)}
              className={`p-3 rounded-lg font-medium transition-all text-sm ${
                selectedTimes.includes(time)
                  ? 'bg-secondary text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-3">
          {selectedTimes.length} Uhrzeit(en) ausgewählt: {selectedTimes.join(', ')}
        </p>
      </div>

      {/* Schedule Mode */}
      <div className="mb-8">
        <label className="text-lg font-semibold text-gray-700 block mb-4">
          <Calendar className="inline mr-2" size={20} />
          Posting-Modus
        </label>
        <div className="flex gap-4">
          <button
            onClick={() => setScheduleMode('now')}
            className={`flex-1 p-3 rounded-lg font-medium transition-all ${
              scheduleMode === 'now'
                ? 'bg-accent text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Jetzt Posten
          </button>
          <button
            onClick={() => setScheduleMode('later')}
            className={`flex-1 p-3 rounded-lg font-medium transition-all ${
              scheduleMode === 'later'
                ? 'bg-accent text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Zeitgeplant
          </button>
        </div>
      </div>

      {/* Preview Summary */}
      <div className="bg-blue-50 border-l-4 border-primary p-4 mb-6 rounded">
        <h4 className="font-semibold text-gray-800 mb-2">Zusammenfassung</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>📝 Posts: <strong>{postCount}</strong></li>
          <li>🎬 Typen: <strong>{postTypes.join(', ')}</strong></li>
          <li>⏰ Zeiten: <strong>{selectedTimes.join(', ')}</strong></li>
          <li>⚡ Modus: <strong>{scheduleMode === 'now' ? 'Sofort' : 'Zeitgeplant'}</strong></li>
        </ul>
      </div>

      {/* Action Button */}
      <button
        onClick={handleSchedule}
        className="w-full bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
      >
        <Send size={20} />
        {scheduleMode === 'now' ? 'Jetzt Posten' : 'Zeitplanen'}
      </button>
    </div>
  )
}
