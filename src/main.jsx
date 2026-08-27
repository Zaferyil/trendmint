import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.jsx'
import AuthProvider from './components/AuthProvider.jsx'

// The provider sits above App because App itself is gated on the session it
// resolves — App cannot both provide and consume it.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// Registered after load so fetching the worker never competes with the first
// render. Skipped in dev, where Vite serves modules the worker would shadow.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}
