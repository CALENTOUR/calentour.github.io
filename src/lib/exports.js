import { PAYMENT_MODES } from '../config/constants'
import { formatDate } from './format'
import { dwellings } from './stats'
import { labelsDocx } from './labels'

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

const modeLabel = (key) => PAYMENT_MODES.find((m) => m.key === key)?.label ?? ''

// Export comptable : chaque don, le total par tournée, le récapitulatif.
export async function exportCompta({ year, amicale, tours, statesById, stats }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CalenTour'

  const sheet = (name, columns, rows) => {
    const ws = wb.addWorksheet(name)
    ws.columns = columns
    ws.addRows(rows)
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    for (const c of columns) if (c.money) ws.getColumn(c.key).numFmt = '#,##0.00 €'
    return ws
  }

  const dons = []
  for (const t of tours) {
    const h = statesById[t.id]?.h ?? {}
    for (const d of dwellings(t)) {
      const e = h[d.key]
      if (e?.s !== 'given') continue
      dons.push({
        date: formatDate(e.at), tournee: t.number, binome: t.name,
        adresse: d.house.label, logement: d.unit?.label ?? '',
        mode: modeLabel(e.mode), montant: Number(e.amount) || 0,
      })
    }
  }
  dons.sort((a, b) => a.tournee - b.tournee || a.date.localeCompare(b.date))
  sheet('Dons', [
    { header: 'Date', key: 'date', width: 17 },
    { header: 'Tournée', key: 'tournee', width: 9 },
    { header: 'Binôme', key: 'binome', width: 24 },
    { header: 'Adresse', key: 'adresse', width: 36 },
    { header: 'Logement', key: 'logement', width: 12 },
    { header: 'Mode', key: 'mode', width: 11 },
    { header: 'Montant', key: 'montant', width: 12, money: true },
  ], dons)

  const modeCols = PAYMENT_MODES.map((m) => ({ header: m.label, key: m.key, width: 13, money: true }))
  sheet('Par tournée', [
    { header: 'Tournée', key: 'tournee', width: 9 },
    { header: 'Binôme', key: 'binome', width: 24 },
    { header: 'Nombre de dons', key: 'dons', width: 15 },
    { header: 'Nombre de chèques', key: 'cheques', width: 17 },
    ...modeCols,
    { header: 'Total', key: 'total', width: 13, money: true },
  ], [...stats.perTour].sort((a, b) => a.tour.number - b.tour.number).map(({ tour, stats: s }) => ({
    tournee: tour.number, binome: tour.name, dons: s.counts.given, cheques: s.chequeCount,
    ...s.byMode, total: s.amount,
  })))

  const recap = sheet('Récapitulatif', [
    { header: 'Poste', key: 'poste', width: 28 },
    { header: 'Valeur', key: 'valeur', width: 16 },
  ], [
    { poste: 'Amicale', valeur: amicale ?? '' },
    { poste: 'Campagne', valeur: year },
    ...PAYMENT_MODES.map((m) => ({ poste: `Total ${m.label.toLowerCase()}`, valeur: stats.byMode[m.key] ?? 0 })),
    { poste: 'Nombre de chèques', valeur: stats.chequeCount },
    { poste: 'Total général', valeur: stats.amount },
    { poste: 'Nombre de dons', valeur: stats.counts.given },
    { poste: 'Export du', valeur: formatDate(new Date()) },
  ])
  recap.getColumn('valeur').alignment = { horizontal: 'right' }
  // Lignes : 1 en-tête, 2 amicale, 3 campagne, puis un total par mode, le nombre de chèques, le total général.
  const firstMode = 4
  const totalRow = firstMode + PAYMENT_MODES.length + 1
  for (let r = firstMode; r < firstMode + PAYMENT_MODES.length; r++) recap.getCell(`B${r}`).numFmt = '#,##0.00 €'
  recap.getCell(`B${totalRow}`).numFmt = '#,##0.00 €'

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `calentour-compta-${year}.xlsx`,
  )
}

// Copie des tournées (rues, maisons, adresses), sans les dons ni les comptes :
// à envoyer pour faire vérifier les tracés et les villages.
export function exportTours(tours) {
  const data = tours.map(({ id, number, name, color, pieces, houses }) => ({ id, number, name, color, pieces, houses }))
  downloadBlob(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tours: data })], { type: 'application/json' }), `calentour-tournees-${new Date().toISOString().slice(0, 10)}.json`)
}

// Étiquettes à découper : une par tournée (membres et secteurs), au format Word.
export async function exportLabels(tours, { amicale, year } = {}) {
  const header = [amicale, year ? `Calendriers ${year}` : ''].filter(Boolean).join(' · ')
  downloadBlob(await labelsDocx(tours, header), `calentour-etiquettes-${year ?? new Date().getFullYear()}.docx`)
}
