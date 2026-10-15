// Étiquettes des tournées à découper : un document Word (A4, grille de 2 colonnes,
// traits pointillés), une étiquette par tournée avec ses membres et ses secteurs.
import { tourAreas } from './places'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const run = (text, { bold, size = 22, color } = {}) =>
  `<w:r><w:rPr>${bold ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
const para = (runs, { after = 60, center } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="${after}"/>${center ? '<w:jc w:val="center"/>' : ''}</w:pPr>${runs}</w:p>`

// Contenu d'une étiquette.
export function labelOf(tour) {
  const members = (tour.members ?? []).map((m) => String(m).trim()).filter(Boolean)
  return {
    number: tour.number,
    color: /^#[0-9a-f]{6}$/i.test(tour.color ?? '') ? tour.color.slice(1) : '1F2A24',
    members: members.length ? members : [tour.name ?? ''].filter(Boolean),
    sectors: tourAreas(tour).map((a) => a.name),
  }
}

const COL = 5103 // largeur d'une colonne (twips) : 2 colonnes sur 18 cm utiles
const dashed = ['top', 'left', 'bottom', 'right'].map((b) => `<w:${b} w:val="dashed" w:sz="6" w:space="0" w:color="888888"/>`).join('')

function cell(l, header) {
  if (!l) return `<w:tc><w:tcPr><w:tcW w:w="${COL}" w:type="dxa"/><w:tcBorders>${dashed}</w:tcBorders></w:tcPr><w:p/></w:tc>`
  const body = [
    header ? para(run(header, { size: 16, color: '777777' }), { after: 40 }) : '',
    para(run(`Tournée ${l.number}`, { bold: true, size: 36, color: l.color }), { after: 100 }),
    para(run('Membres', { bold: true, size: 18, color: '555555' }), { after: 20 }),
    para(run(l.members.join(', ') || 'À compléter', { size: 24 }), { after: 100 }),
    para(run(l.sectors.length > 1 ? 'Secteurs' : 'Secteur', { bold: true, size: 18, color: '555555' }), { after: 20 }),
    ...(l.sectors.length ? l.sectors : ['À compléter']).map((s) => para(run(`• ${s}`, { size: 22 }), { after: 20 })),
  ].join('')
  return `<w:tc><w:tcPr><w:tcW w:w="${COL}" w:type="dxa"/><w:tcBorders>${dashed}</w:tcBorders><w:tcMar><w:top w:w="200" w:type="dxa"/><w:left w:w="220" w:type="dxa"/><w:bottom w:w="160" w:type="dxa"/><w:right w:w="220" w:type="dxa"/></w:tcMar></w:tcPr>${body}</w:tc>`
}

export function labelsDocumentXml(tours, header = '') {
  const labels = [...tours].sort((a, b) => a.number - b.number).map(labelOf)
  const rows = []
  for (let i = 0; i < labels.length; i += 2) {
    rows.push(`<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="2600" w:hRule="atLeast"/></w:trPr>${cell(labels[i], header)}${cell(labels[i + 1], header)}</w:tr>`)
  }
  const table = `<w:tbl><w:tblPr><w:tblW w:w="${COL * 2}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${dashed}<w:insideH w:val="dashed" w:sz="6" w:space="0" w:color="888888"/><w:insideV w:val="dashed" w:sz="6" w:space="0" w:color="888888"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${COL}"/><w:gridCol w:w="${COL}"/></w:tblGrid>${rows.join('')}</w:tbl>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${rows.length ? table : ''}<w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="850" w:bottom="567" w:left="850" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`

// Fichier .docx prêt à imprimer.
export async function labelsDocx(tours, header) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/_rels/document.xml.rels', DOC_RELS)
  zip.file('word/styles.xml', STYLES)
  zip.file('word/document.xml', labelsDocumentXml(tours, header))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}
