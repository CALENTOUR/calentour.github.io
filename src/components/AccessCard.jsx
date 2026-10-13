// Carte d'accès imprimable remise au binôme.
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
export default function AccessCard({ amicale, tour, login, password }) {
  const url = window.location.href.split('#')[0]
  const print = () => {
    const w = window.open('', '_blank', 'width=480,height=640')
    if (!w) return
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Accès CalenTour</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}.c{border:3px solid #dc2626;border-radius:16px;padding:20px;max-width:360px}
      h1{color:#dc2626;margin:0 0 4px;font-size:22px}p{margin:6px 0}.k{font-size:20px;font-weight:700;font-family:monospace}</style></head>
      <body><div class="c"><h1>🚒 CalenTour</h1><p>${esc(amicale)}</p><p><strong>Tournée n°${esc(tour.number)}</strong> · ${esc(tour.name)}</p>
      <p>Adresse : ${esc(url)}</p><p>Identifiant : <span class="k">${esc(login)}</span></p>${password ? `<p>Mot de passe : <span class="k">${esc(password)}</span></p>` : ''}
      <p style="font-size:13px;color:#555">Ouvre l’adresse sur ton téléphone, puis « Ajouter à l’écran d’accueil ».</p></div>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }
  return (
    <div className="access-card">
      <div className="small muted">Tournée n°{tour.number} · {tour.name}</div>
      <div>Identifiant : <code className="big-code">{login}</code></div>
      {password && <div>Mot de passe : <code className="big-code">{password}</code></div>}
      {password && <div className="small warn">Note-le maintenant : le mot de passe ne sera plus affiché.</div>}
      <button type="button" className="btn-sm" onClick={print}>🖨️ Imprimer la carte d’accès</button>
    </div>
  )
}
