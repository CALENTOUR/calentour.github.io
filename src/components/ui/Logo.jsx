// Logo CalenTour : une page de calendrier et un repère de maison sur le trajet
// de la tournée. Même dessin que l'icône de l'application (public/favicon.svg).
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg className={`logo ${className}`} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#b8432f" />
      <rect x="34" y="34" width="444" height="444" rx="90" fill="none" stroke="#fbf9f4" strokeOpacity=".2" strokeWidth="6" />
      <rect x="104" y="128" width="304" height="288" rx="40" fill="#fbf9f4" />
      <path d="M104 168a40 40 0 0 1 40-40h224a40 40 0 0 1 40 40v22H104z" fill="#1f2a24" />
      <rect x="168" y="90" width="30" height="80" rx="15" fill="#fbf9f4" stroke="#1f2a24" strokeWidth="10" />
      <rect x="314" y="90" width="30" height="80" rx="15" fill="#fbf9f4" stroke="#1f2a24" strokeWidth="10" />
      <path d="M146 384c34-6 52-22 72-40" fill="none" stroke="#1f2a24" strokeWidth="9" strokeLinecap="round" strokeDasharray="1 20" />
      <path d="M276 386s-66-62-66-112a66 66 0 0 1 132 0c0 50-66 112-66 112z" fill="#b8432f" />
      <path d="M248 296v-26l28-22 28 22v26z" fill="#fbf9f4" />
      <rect x="270" y="278" width="12" height="18" rx="3" fill="#b8432f" />
    </svg>
  )
}
