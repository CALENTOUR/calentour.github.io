// Petite rue illustrée (maisons, arbres, camion de pompiers), en aplats sobres.
export default function StreetArt({ className = 'street-art' }) {
  return (
    <svg className={className} viewBox="0 0 360 74" role="img" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <rect x="0" y="66" width="360" height="8" fill="#d9cfbc" />
      <circle cx="318" cy="16" r="9" fill="#e6c27a" />
      <g fill="#7a8f6a">
        <circle cx="22" cy="44" r="13" /><rect x="20" y="52" width="4" height="14" fill="#6c5a44" />
        <circle cx="236" cy="42" r="15" /><rect x="234" y="52" width="4" height="14" fill="#6c5a44" />
      </g>
      <g>
        <rect x="44" y="34" width="44" height="32" fill="#efe4cf" stroke="#1f2a24" strokeWidth="1.5" />
        <path d="M40 36 L66 16 L92 36 Z" fill="#b8432f" stroke="#1f2a24" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="52" y="42" width="9" height="8" fill="#2f5f8f" /><rect x="71" y="50" width="9" height="16" fill="#6c5a44" />
      </g>
      <g>
        <rect x="98" y="22" width="38" height="44" fill="#e3ebf3" stroke="#1f2a24" strokeWidth="1.5" />
        <rect x="94" y="18" width="46" height="6" fill="#4f6b7e" stroke="#1f2a24" strokeWidth="1.5" />
        <rect x="104" y="30" width="8" height="7" fill="#2f5f8f" /><rect x="122" y="30" width="8" height="7" fill="#2f5f8f" />
        <rect x="104" y="43" width="8" height="7" fill="#2f5f8f" /><rect x="122" y="43" width="8" height="7" fill="#2f5f8f" />
        <rect x="113" y="54" width="8" height="12" fill="#6c5a44" />
      </g>
      <g>
        <rect x="146" y="38" width="38" height="28" fill="#f2dcd3" stroke="#1f2a24" strokeWidth="1.5" />
        <path d="M142 40 L165 22 L188 40 Z" fill="#d39b2a" stroke="#1f2a24" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="153" y="46" width="8" height="8" fill="#2f5f8f" /><rect x="168" y="52" width="8" height="14" fill="#6c5a44" />
      </g>
      <g>
        <rect x="192" y="40" width="30" height="26" fill="#efe4cf" stroke="#1f2a24" strokeWidth="1.5" />
        <path d="M189 42 L207 28 L225 42 Z" fill="#4f8a4c" stroke="#1f2a24" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="200" y="50" width="8" height="16" fill="#6c5a44" />
      </g>
      <g>
        <rect x="262" y="44" width="62" height="18" rx="2" fill="#b8432f" stroke="#1f2a24" strokeWidth="1.5" />
        <rect x="306" y="36" width="28" height="26" rx="2" fill="#b8432f" stroke="#1f2a24" strokeWidth="1.5" />
        <rect x="314" y="41" width="14" height="9" fill="#e3ebf3" />
        <path d="M268 40 L304 40" stroke="#1f2a24" strokeWidth="2" /><path d="M272 36 L272 44 M280 36 L280 44 M288 36 L288 44 M296 36 L296 44" stroke="#1f2a24" strokeWidth="1.5" />
        <rect x="318" y="31" width="6" height="5" fill="#2f5f8f" />
        <circle cx="276" cy="64" r="5" fill="#1f2a24" /><circle cx="320" cy="64" r="5" fill="#1f2a24" />
      </g>
    </svg>
  )
}
