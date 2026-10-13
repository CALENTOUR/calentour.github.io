import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-banner" role="status">
      📵 Hors ligne : tes saisies sont gardées sur le téléphone et partent dès que le réseau revient.
    </div>
  )
}
