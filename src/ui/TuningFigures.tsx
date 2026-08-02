/**
 * Схема к разделу про планжер: как выглядят попадания при настройке методом отхода.
 * Рисуется кодом — весит ничего и подстраивается под тему. Остальные иллюстрации
 * справочника — фотографии и рисунки из исходного документа, см. public/tuning.
 */

const ink = 'var(--c-text)'
const muted = 'var(--c-muted)'
const accent = 'var(--c-accent)'
const line = 'var(--c-border)'

function WalkbackPattern({ offsets }: { offsets: number[] }) {
  const ys = [26, 55, 84, 113, 142]
  return (
    <>
      <rect x={10} y={10} width={100} height={150} rx={4} fill="var(--c-surface)" stroke={line} />
      <line x1={60} y1={12} x2={60} y2={158} stroke={line} strokeDasharray="4 4" />
      <path
        d={offsets.map((o, i) => `${i === 0 ? 'M' : 'L'} ${60 + o} ${ys[i]}`).join(' ')}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        strokeDasharray="3 3"
        opacity={0.7}
      />
      {offsets.map((o, i) => (
        <circle key={i} cx={60 + o} cy={ys[i]} r={4} fill={ink} />
      ))}
      <text x={14} y={166} fill={muted} fontSize={8}>
        ближе
      </text>
      <text x={106} y={166} fill={muted} fontSize={8} textAnchor="end">
        дальше
      </text>
    </>
  )
}

export function WalkbackFigure() {
  const patterns: { title: string; offsets: number[] }[] = [
    { title: 'Изгиб влево', offsets: [0, -3, -9, -19, -34] },
    { title: 'Изгиб вправо', offsets: [0, 3, 9, 19, 34] },
    { title: 'Диагональ влево', offsets: [0, -9, -18, -27, -36] },
    { title: 'Диагональ вправо', offsets: [0, 9, 18, 27, 36] },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {patterns.map((p) => (
        <figure key={p.title} className="rounded-xl border border-line bg-surface2 p-2">
          <svg viewBox="0 0 120 170" className="w-full" preserveAspectRatio="xMidYMid meet">
            <WalkbackPattern offsets={p.offsets} />
          </svg>
          <figcaption className="mt-1 text-center text-xs text-muted">{p.title}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export function TuningFigure({ figure }: { figure: string }) {
  if (figure === 'walkback') return <WalkbackFigure />
  return null
}
