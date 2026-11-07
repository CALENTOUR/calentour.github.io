import { useEffect, useState } from 'react'

// Vrai sur un écran étroit (téléphone), où l'admin a sa mise en page à lui.
const QUERY = '(max-width: 899px)'
export function useIsPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia?.(QUERY).matches ?? false)
  useEffect(() => {
    const m = window.matchMedia?.(QUERY)
    if (!m) return undefined
    const on = () => setPhone(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return phone
}
