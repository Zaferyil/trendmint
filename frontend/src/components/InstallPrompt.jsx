import React, { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if running on iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
                        !window.MSStream

    if (isIOSDevice) {
      setIsIOS(true)
      setShowPrompt(true)
      return
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('✅ App installed successfully')
      }

      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  const handleClose = () => {
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white rounded-lg shadow-xl border-l-4 border-primary p-4 z-40 max-w-sm mx-auto md:bottom-6 md:left-6 md:max-w-md">
      <div className="flex items-start gap-3">
        <Download className="text-primary flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 mb-1">
            {isIOS ? 'App auf Home-Bildschirm hinzufügen' : 'SirkWTime installieren'}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {isIOS
              ? 'Tippen Sie auf "Freigeben" und wählen Sie "Zum Home-Bildschirm"'
              : 'Installieren Sie SirkWTime auf Ihrem Gerät für schnelleren Zugriff'}
          </p>
          <div className="flex gap-2">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Installieren
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-sm font-medium text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Später
            </button>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
