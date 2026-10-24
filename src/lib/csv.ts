function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  // Neutralise l'injection de formules dans Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Génère un CSV (séparateur « ; », BOM UTF-8) lisible directement par Excel en français. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(';'))
  return '﻿' + lines.join('\r\n')
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
