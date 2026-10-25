/**
 * Illustration isométrique : colonnes sombres surmontées de dalles lumineuses
 * aux couleurs des quatre catégories de la rétrospective.
 */
interface Pillar {
  id: string
  cx: number
  top: number
  height: number
  color: string
  light: string
  dark: string
}

const S = 92 // demi-largeur du losange
const T = 20 // épaisseur de la dalle

const PILLARS: Pillar[] = [
  { id: 'action', cx: 420, top: 150, height: 420, color: '#5b4cf5', light: '#8f86ff', dark: '#3a2fc0' },
  { id: 'negative', cx: 240, top: 235, height: 340, color: '#e5484d', light: '#ff8a8e', dark: '#9e2227' },
  { id: 'positive', cx: 330, top: 335, height: 240, color: '#2fbf71', light: '#7ff0b0', dark: '#16794a' },
  { id: 'improvement', cx: 150, top: 405, height: 170, color: '#0ea5e9', light: '#7dd3fc', dark: '#075985' },
]

function pts(...p: Array<[number, number]>) {
  return p.map(([x, y]) => `${x},${y}`).join(' ')
}

function PillarShape({ p }: { p: Pillar }) {
  const { cx, top, height: h } = p
  const L: [number, number] = [cx - S, top]
  const R: [number, number] = [cx + S, top]
  const B: [number, number] = [cx, top + S / 2]
  const tile = S * 0.86
  const ty = top - T
  const tL: [number, number] = [cx - tile, ty]
  const tR: [number, number] = [cx + tile, ty]
  const tB: [number, number] = [cx, ty + tile / 2]
  const tTop: [number, number] = [cx, ty - tile / 2]
  return (
    <g>
      {/* Halo */}
      <ellipse cx={cx} cy={top - 4} rx={S * 1.1} ry={S * 0.6} fill={p.color} opacity={0.55} filter="url(#pillar-blur)" />
      {/* Colonne */}
      <polygon points={pts(L, B, [B[0], B[1] + h], [L[0], L[1] + h])} fill="url(#pillar-left)" />
      <polygon points={pts(L, B, [B[0], B[1] + h], [L[0], L[1] + h])} fill="url(#pillar-ridges)" />
      <polygon points={pts(B, R, [R[0], R[1] + h], [B[0], B[1] + h])} fill="url(#pillar-right)" />
      <polygon points={pts(B, R, [R[0], R[1] + h], [B[0], B[1] + h])} fill="url(#pillar-ridges)" />
      <polygon points={pts([cx, top - S / 2], R, B, L)} fill="#1b1b22" />
      {/* Reflet coloré sur les faces */}
      <polygon points={pts(L, B, [B[0], B[1] + 90], [L[0], L[1] + 90])} fill={p.color} opacity={0.18} />
      <polygon points={pts(B, R, [R[0], R[1] + 90], [B[0], B[1] + 90])} fill={p.color} opacity={0.12} />
      {/* Dalle lumineuse */}
      <polygon points={pts(tL, tB, [tB[0], tB[1] + T], [tL[0], tL[1] + T])} fill={p.dark} />
      <polygon points={pts(tB, tR, [tR[0], tR[1] + T], [tB[0], tB[1] + T])} fill={p.color} opacity={0.85} />
      <polygon points={pts(tTop, tR, tB, tL)} fill={`url(#tile-${p.id})`} />
      <polygon points={pts(tTop, tR, tB, tL)} fill="none" stroke={p.light} strokeOpacity={0.7} strokeWidth={1.5} />
      <defs>
        <linearGradient id={`tile-${p.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.light} />
          <stop offset="55%" stopColor={p.color} />
          <stop offset="100%" stopColor={p.dark} />
        </linearGradient>
      </defs>
    </g>
  )
}

export function Pillars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={className} role="img" aria-label="Illustration : colonnes aux couleurs des quatre catégories">
      <defs>
        <filter id="pillar-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <linearGradient id="pillar-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a33" />
          <stop offset="100%" stopColor="#0c0c10" />
        </linearGradient>
        <linearGradient id="pillar-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c1c23" />
          <stop offset="100%" stopColor="#060608" />
        </linearGradient>
        <pattern id="pillar-ridges" width="7" height="600" patternUnits="userSpaceOnUse">
          <rect width="1.4" height="600" fill="#ffffff" opacity="0.07" />
        </pattern>
      </defs>
      {PILLARS.map((p) => (
        <PillarShape key={p.id} p={p} />
      ))}
    </svg>
  )
}
