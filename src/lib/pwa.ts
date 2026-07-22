import { registerSW } from 'virtual:pwa-register'

// Keep the installed app on the latest deploy without a manual reinstall.
//
// registerType is 'autoUpdate', so a new service worker skip-waits and claims
// clients the moment it's found — but *finding* it is the hard part on a
// long-lived phone PWA: the browser only re-checks the worker on its own
// schedule (and iOS is famously slow about it). We register through the
// plugin's helper (which reloads the page once a new worker takes control)
// and actively poll for updates, so a deploy reaches an already-installed app
// on next foreground instead of whenever the OS feels like it.
export function initPWA(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Check hourly, and whenever the app returns to the foreground.
      setInterval(() => void registration.update(), 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    },
  })
}
