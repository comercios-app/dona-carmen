const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
let initialized = false

export function initializeAnalytics() {
  // Las pantallas de administración y recuperación no envían estadísticas.
  if (window.location.hash.startsWith('#/admin') || new URLSearchParams(window.location.search).get('admin') === '1') return
  if (initialized || !import.meta.env.PROD || !/^G-[A-Z0-9]+$/.test(measurementId ?? '')) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function () {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
  initialized = true
}

export function trackWhatsAppOrderClick() {
  if (!initialized) return

  // Count the click only; never send the message or customer details.
  window.gtag('event', 'whatsapp_order_click', {
    send_to: measurementId,
  })
}
