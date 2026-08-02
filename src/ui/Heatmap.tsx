import type { Point } from '../core/types'

/**
 * Тепловая карта попаданий в пространстве mrad от центра фейса или своего спота:
 * так 18 м на 40 см и 70 м на 122 см попадают в одну картинку и сравнимы.
 *
 * Плотность считается по сетке, но рисуется размытой — иначе читается как россыпь
 * квадратов, а не как облако попаданий.
 */
export function Heatmap({
  points,
  rangeMrad = 4,
  bins = 28,
  className = '',
}: {
  points: Point[]
  rangeMrad?: number
  bins?: number
  className?: string
}) {
  const size = (rangeMrad * 2) / bins
  const grid = new Map<string, number>()
  let max = 0
  let outside = 0

  for (const p of points) {
    if (Math.abs(p.x) > rangeMrad || Math.abs(p.y) > rangeMrad) {
      outside++
      continue
    }
    const i = Math.min(bins - 1, Math.floor((p.x + rangeMrad) / size))
    const j = Math.min(bins - 1, Math.floor((p.y + rangeMrad) / size))
    const key = `${i}:${j}`
    const v = (grid.get(key) ?? 0) + 1
    grid.set(key, v)
    if (v > max) max = v
  }

  const cells = [...grid.entries()].map(([key, v]) => {
    const [i, j] = key.split(':').map(Number)
    return { key, x: -rangeMrad + i * size, y: -rangeMrad + (j + 1) * size, v }
  })

  const rings = [1, 2, 3, 4].filter((r) => r <= rangeMrad)
  const line = rangeMrad * 0.006

  return (
    <figure className={className}>
      <svg
        viewBox={`${-rangeMrad} ${-rangeMrad} ${rangeMrad * 2} ${rangeMrad * 2}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
      >
        <defs>
          <filter id="heat-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={size * 0.7} />
          </filter>
        </defs>

        <rect
          x={-rangeMrad}
          y={-rangeMrad}
          width={rangeMrad * 2}
          height={rangeMrad * 2}
          fill="var(--c-surface-2)"
        />

        <g filter="url(#heat-blur)">
          {cells.map((c) => (
            <rect
              key={c.key}
              x={c.x}
              y={-c.y}
              width={size}
              height={size}
              fill="var(--c-accent)"
              // Корень сглаживает разброс: единичные попадания видно, а пик не выжигает всё.
              opacity={max > 0 ? 0.15 + 0.85 * Math.sqrt(c.v / max) : 0}
            />
          ))}
        </g>

        <line x1={-rangeMrad} y1={0} x2={rangeMrad} y2={0} stroke="var(--c-border)" strokeWidth={line} />
        <line x1={0} y1={-rangeMrad} x2={0} y2={rangeMrad} stroke="var(--c-border)" strokeWidth={line} />
        {rings.map((r) => (
          <circle
            key={r}
            cx={0}
            cy={0}
            r={r}
            fill="none"
            stroke="var(--c-border)"
            strokeWidth={line * 1.4}
          />
        ))}
        {rings.map((r) => (
          <text
            key={`t${r}`}
            x={r}
            y={-rangeMrad * 0.035}
            fill="var(--c-muted)"
            fontSize={rangeMrad * 0.11}
            textAnchor="middle"
          >
            {r}
          </text>
        ))}
        <text
          x={rangeMrad * 0.97}
          y={rangeMrad * 0.95}
          fill="var(--c-muted)"
          fontSize={rangeMrad * 0.1}
          textAnchor="end"
        >
          mrad
        </text>
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          реже
          <span
            className="inline-block h-2 w-16 rounded"
            style={{
              background:
                'linear-gradient(to right, color-mix(in srgb, var(--c-accent) 15%, transparent), var(--c-accent))',
            }}
          />
          чаще
        </span>
        <span className="num">
          пик — {max} {max === 1 ? 'выстрел' : 'выстрелов'} в ячейке
          {outside > 0 && `, за кадром ${outside}`}
        </span>
      </figcaption>
    </figure>
  )
}
