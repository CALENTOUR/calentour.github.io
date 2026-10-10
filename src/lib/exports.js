import { PAYMENT_FIELDS, STATUSES } from '../config/constants'
import { formatDate } from './format'

// Les bibliothèques d'export sont chargées à la demande pour garder
// l'application légère sur téléphone.

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function addressRows({ addresses, visitsByAddress, sectorsById, communesById, usersById }) {
  return addresses.map((a) => {
    const v = visitsByAddress[a.id] ?? {}
    const sector = sectorsById[a.sectorId]
    return {
      adresse: a.label,
      commune: communesById[sector?.communeId]?.name ?? '',
      secteur: sector?.name ?? '',
      statut: STATUSES[v.status ?? 'todo'].label,
      calendriers: v.calendars ?? 0,
      especes: v.cash ?? 0,
      cheque: v.cheque ?? 0,
      cb: v.card ?? 0,
      virement: v.transfer ?? 0,
      total: v.total ?? 0,
      membre: usersById[v.userId]?.name ?? '',
      date: v.date ? formatDate(v.date) : '',
      commentaire: [a.comment, v.comment].filter(Boolean).join(' / '),
      latitude: a.lat,
      longitude: a.lng,
    }
  })
}

function bucketRow(b) {
  return {
    nom: b.name,
    adresses: b.addresses,
    avancement: Math.round(b.progress * 100) / 100,
    dons: b.counts.done,
    absents: b.counts.absent,
    refus: b.counts.refused,
    vacants: b.counts.vacant,
    calendriers: b.calendars,
    ...Object.fromEntries(PAYMENT_FIELDS.map((p) => [p.label.toLowerCase(), b[p.key]])),
    total: b.total,
  }
}

export async function exportExcel({ year, stats, ...data }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CalenTour'

  const addSheet = (name, rows, money = []) => {
    const ws = wb.addWorksheet(name)
    if (!rows.length) return
    ws.columns = Object.keys(rows[0]).map((key) => ({
      header: key.charAt(0).toUpperCase() + key.slice(1),
      key,
      width: key === 'adresse' || key === 'commentaire' ? 40 : 14,
    }))
    ws.addRows(rows)
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    for (const key of money) ws.getColumn(key).numFmt = '#,##0.00 €'
    if (ws.columns.some((c) => c.key === 'avancement')) ws.getColumn('avancement').numFmt = '0%'
  }

  const moneyKeys = ['especes', 'cheque', 'cb', 'virement', 'total']
  const bucketMoney = [...PAYMENT_FIELDS.map((p) => p.label.toLowerCase()), 'total']
  addSheet('Adresses', addressRows(data), moneyKeys)
  addSheet('Secteurs', stats.bySector.map(bucketRow), bucketMoney)
  addSheet('Communes', stats.byCommune.map(bucketRow), bucketMoney)
  addSheet('Membres', stats.byMember.map(bucketRow), bucketMoney)

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `calentour-${year}.xlsx`,
  )
}

export async function exportPdf({ year, stats, previousStats, previousYear }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const eur = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} EUR`
  const pct = (n) => `${Math.round((n || 0) * 100)} %`
  const head = { fillColor: [30, 41, 59], textColor: 255 }

  doc.setFontSize(18)
  doc.text(`CalenTour - Campagne ${year}`, 14, 16)
  doc.setFontSize(10)
  doc.text(`Édité le ${formatDate(new Date())}`, 14, 22)

  const g = stats.global
  const p = previousStats?.global
  autoTable(doc, {
    startY: 28,
    headStyles: head,
    head: [['Indicateur', String(year), previousYear ? String(previousYear) : 'N-1']],
    body: [
      ['Total des dons', eur(g.total), p ? eur(p.total) : '-'],
      ['Calendriers distribués', g.calendars, p ? p.calendars : '-'],
      ['Dons réalisés', g.counts.done, p ? p.counts.done : '-'],
      ['Absents / repasses', g.counts.absent, p ? p.counts.absent : '-'],
      ['Refus', g.counts.refused, p ? p.counts.refused : '-'],
      ['Don moyen', eur(g.average), p ? eur(p.average) : '-'],
      ['Avancement', pct(g.progress), p ? pct(p.progress) : '-'],
    ],
  })

  const bucketTable = (title, rows) => {
    doc.addPage()
    doc.setFontSize(14)
    doc.text(title, 14, 16)
    autoTable(doc, {
      startY: 22,
      headStyles: head,
      head: [['Nom', 'Adresses', 'Avancement', 'Dons', 'Absents', 'Refus', 'Calendriers', 'Total']],
      body: rows.map((b) => [b.name, b.addresses, pct(b.progress), b.counts.done, b.counts.absent, b.counts.refused, b.calendars, eur(b.total)]),
    })
  }
  bucketTable('Par secteur', stats.bySector)
  bucketTable('Par commune', stats.byCommune)

  doc.addPage()
  doc.setFontSize(14)
  doc.text('Classement des membres', 14, 16)
  autoTable(doc, {
    startY: 22,
    headStyles: head,
    head: [['#', 'Membre', 'Dons', 'Absents', 'Refus', 'Calendriers', 'Total']],
    body: stats.byMember.map((m, i) => [i + 1, m.name, m.counts.done, m.counts.absent, m.counts.refused, m.calendars, eur(m.total)]),
  })

  doc.save(`calentour-${year}.pdf`)
}
