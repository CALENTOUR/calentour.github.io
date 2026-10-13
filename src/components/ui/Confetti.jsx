import { useEffect, useState } from 'react'

const BITS = ['🎉', '💶', '⭐', '🚒', '✨', '💚']

// Petite explosion festive après un don.
export default function Confetti({ trigger }) {
  const [pieces, setPieces] = useState([])
  useEffect(() => {
    if (!trigger) return undefined
    setPieces(Array.from({ length: 18 }, (_, i) => ({
      id: `${trigger}-${i}`,
      bit: BITS[i % BITS.length],
      x: Math.round((Math.random() - 0.5) * 320),
      y: Math.round(-140 - Math.random() * 220),
      r: Math.round((Math.random() - 0.5) * 540),
      d: 0.9 + Math.random() * 0.6,
    })))
    const t = setTimeout(() => setPieces([]), 1700)
    return () => clearTimeout(t)
  }, [trigger])
  if (!pieces.length) return null
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, animationDuration: `${p.d}s` }}>{p.bit}</span>
      ))}
    </div>
  )
}
