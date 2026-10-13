// Remise à zéro de la démo (sans charger la base de démo dans l'application réelle).
export const DEMO_STORAGE_KEY = 'calentour-demo-v2'
export const DEMO_SESSION_KEY = 'calentour-demo-session-v2'

export function resetDemo() {
  try {
    localStorage.removeItem(DEMO_STORAGE_KEY)
    localStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    // ignore
  }
  window.location.reload()
}
