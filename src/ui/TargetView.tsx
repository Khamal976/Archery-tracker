import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Ellipse } from '../core/geometry'
import { toFaceCoords } from '../core/scoring'
import type { Point, TargetFace } from '../core/types'
import { clientToModel, faceViewBox } from '../core/viewbox'

export interface ShotPoint {
  id: string
  x: number
  y: number
  spotIndex: number | null
  value: number
  isX: boolean
  isMiss: boolean
  flyer?: boolean
}

/** Заливка кольца по номиналу — канонические зоны WA. */
function ringFill(value: number): string {
  if (value >= 9) return 'var(--t-gold)'
  if (value >= 7) return 'var(--t-red)'
  if (value >= 5) return 'var(--t-blue)'
  if (value >= 3) return 'var(--t-black)'
  return 'var(--t-paper)'
}

/** Линия кольца: на чёрных кольцах светлая, в остальных тёмная. */
function ringStroke(value: number): string {
  return value >= 3 && value <= 4 ? 'var(--t-line-inv)' : 'var(--t-line)'
}

function SpotRings({ face, cx, cy }: { face: TargetFace; cx: number; cy: number }) {
  const line = Math.max(face.widthMm * 0.0015, 0.35)
  // Сверху вниз по радиусу: большие кольца рисуются первыми.
  const rings = [...face.rings].sort((a, b) => b.radiusMm - a.radiusMm)
  return (
    <g transform={`translate(${cx} ${-cy})`}>
      {rings.map((r) => (
        <circle
          key={r.value}
          cx={0}
          cy={0}
          r={r.radiusMm}
          fill={ringFill(r.value)}
          stroke={ringStroke(r.value)}
          strokeWidth={line}
        />
      ))}
      {face.hasX && face.xRadiusMm !== null && (
        <circle
          cx={0}
          cy={0}
          r={face.xRadiusMm}
          fill="none"
          stroke={ringStroke(10)}
          strokeWidth={line}
        />
      )}
    </g>
  )
}

function BlankGrid({ face }: { face: TargetFace }) {
  const step = face.gridStepMm ?? 50
  const hw = face.widthMm / 2
  const hh = face.heightMm / 2
  const lines: React.ReactElement[] = []
  const w = Math.max(face.widthMm * 0.0012, 0.3)
  for (let x = -Math.floor(hw / step) * step; x <= hw; x += step) {
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={-hh}
        x2={x}
        y2={hh}
        stroke="var(--c-grid)"
        strokeWidth={x === 0 ? w * 2 : w}
      />,
    )
  }
  for (let y = -Math.floor(hh / step) * step; y <= hh; y += step) {
    lines.push(
      <line
        key={`h${y}`}
        x1={-hw}
        y1={y}
        x2={hw}
        y2={y}
        stroke="var(--c-grid)"
        strokeWidth={y === 0 ? w * 2 : w}
      />,
    )
  }
  return <g>{lines}</g>
}

function FaceContent({
  face,
  highlightSpot,
}: {
  face: TargetFace
  highlightSpot?: number | null
}) {
  const hw = face.widthMm / 2
  const hh = face.heightMm / 2
  const paperExtra = face.kind === 'blank' ? 0 : Math.max(face.widthMm * 0.02, 6)

  return (
    <g>
      <rect
        x={-hw - paperExtra}
        y={-hh - paperExtra}
        width={face.widthMm + paperExtra * 2}
        height={face.heightMm + paperExtra * 2}
        fill="var(--t-paper)"
        rx={Math.max(face.widthMm * 0.01, 2)}
      />
      {face.kind === 'blank' ? (
        <BlankGrid face={face} />
      ) : face.spots ? (
        <>
          {face.spots.centers.map((c, i) => (
            <SpotRings key={i} face={face} cx={c.x} cy={c.y} />
          ))}
          {highlightSpot !== null && highlightSpot !== undefined && face.spots.centers[highlightSpot] && (
            <circle
              cx={face.spots.centers[highlightSpot].x}
              cy={-face.spots.centers[highlightSpot].y}
              r={face.spots.zoneRadiusMm * 1.06}
              fill="none"
              stroke="var(--c-accent)"
              strokeWidth={Math.max(face.widthMm * 0.008, 2)}
              strokeDasharray={`${face.widthMm * 0.04} ${face.widthMm * 0.03}`}
            />
          )}
        </>
      ) : (
        <SpotRings face={face} cx={0} cy={0} />
      )}
    </g>
  )
}

function Shots({
  face,
  shots,
  selectedId,
  r,
}: {
  face: TargetFace
  shots: ShotPoint[]
  selectedId?: string | null
  r: number
}) {
  return (
    <g>
      {shots.map((s) => {
        const p = toFaceCoords(face, { x: s.x, y: s.y }, s.spotIndex)
        const selected = s.id === selectedId
        const fill = s.flyer ? 'var(--c-danger)' : s.isMiss ? 'var(--c-muted)' : 'var(--c-shot)'
        return (
          <g key={s.id}>
            <circle
              cx={p.x}
              cy={-p.y}
              r={selected ? r * 1.5 : r}
              fill={fill}
              stroke="var(--c-shot-ring)"
              strokeWidth={r * 0.35}
            />
            {selected && (
              <circle
                cx={p.x}
                cy={-p.y}
                r={r * 3}
                fill="none"
                stroke="var(--c-accent)"
                strokeWidth={r * 0.5}
              />
            )}
          </g>
        )
      })}
    </g>
  )
}

export interface TargetViewProps {
  face: TargetFace
  shots: ShotPoint[]
  /** Ввод новой стрелы: координаты в системе фейса (мм, +y вверх). */
  onAdd?: (p: Point) => void
  /** Перетаскивание выбранной стрелы. */
  onMove?: (id: string, p: Point) => void
  selectedId?: string | null
  highlightSpot?: number | null
  centroid?: Point | null
  ellipse?: Ellipse | null
  className?: string
  /** Выключает любой ввод — для карточек статистики. */
  readOnly?: boolean
  /** false — новые выстрелы не добавляются, но выбранный можно перетащить. */
  canAdd?: boolean
}

export function TargetView({
  face,
  shots,
  onAdd,
  onMove,
  selectedId,
  highlightSpot,
  centroid,
  ellipse,
  className = '',
  readOnly = false,
  canAdd = true,
}: TargetViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [pending, setPending] = useState<Point | null>(null)
  const dot = Math.max(face.widthMm * 0.011, 1.5)

  // Лупа: смещена выше пальца, иначе точка прячется под ним.
  const magR = face.widthMm * 0.16
  const magScale = 3.2
  const magOffset = magR * 1.9

  const pointFrom = (e: ReactPointerEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current
    if (!svg) return null
    return clientToModel(svg, e.clientX, e.clientY)
  }

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return
    if (!canAdd && !selectedId) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Захват не всегда доступен (например, синтетические события) — ввод от этого не страдает.
    }
    const p = pointFrom(e)
    if (p) setPending(p)
  }

  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || pending === null) return
    const p = pointFrom(e)
    if (p) setPending(p)
  }

  const up = () => {
    if (readOnly || pending === null) return
    const p = pending
    setPending(null)
    // Выбранный выстрел двигаем, иначе ставим новый — если добавлять ещё можно.
    if (selectedId && onMove) onMove(selectedId, p)
    else if (canAdd && onAdd) onAdd(p)
  }

  const vb = faceViewBox(face, face.widthMm * 0.03)
  const magY = pending ? (-pending.y - magOffset < -face.heightMm / 2 ? -pending.y + magOffset : -pending.y - magOffset) : 0

  return (
    <svg
      ref={svgRef}
      viewBox={vb}
      className={`target-svg ${className}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setPending(null)}
    >
      <defs>
        <clipPath id="mag-clip">
          <circle cx={pending?.x ?? 0} cy={magY} r={magR} />
        </clipPath>
      </defs>

      <FaceContent face={face} highlightSpot={highlightSpot} />
      <Shots face={face} shots={shots} selectedId={selectedId} r={dot} />

      {ellipse && (
        <ellipse
          cx={ellipse.cx}
          cy={-ellipse.cy}
          rx={ellipse.rx}
          ry={ellipse.ry}
          transform={`rotate(${-ellipse.angleDeg} ${ellipse.cx} ${-ellipse.cy})`}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth={dot * 0.6}
          strokeDasharray={`${dot * 3} ${dot * 2}`}
          opacity={0.9}
        />
      )}
      {centroid && (
        <g>
          <line
            x1={centroid.x - dot * 3}
            y1={-centroid.y}
            x2={centroid.x + dot * 3}
            y2={-centroid.y}
            stroke="var(--c-accent)"
            strokeWidth={dot * 0.7}
          />
          <line
            x1={centroid.x}
            y1={-centroid.y - dot * 3}
            x2={centroid.x}
            y2={-centroid.y + dot * 3}
            stroke="var(--c-accent)"
            strokeWidth={dot * 0.7}
          />
        </g>
      )}

      {pending && (
        <>
          <g clipPath="url(#mag-clip)">
            <circle cx={pending.x} cy={magY} r={magR} fill="var(--t-paper)" />
            <g
              transform={`translate(${pending.x} ${magY}) scale(${magScale}) translate(${-pending.x} ${pending.y})`}
            >
              <FaceContent face={face} highlightSpot={highlightSpot} />
              <Shots face={face} shots={shots} selectedId={selectedId} r={dot} />
              <circle
                cx={pending.x}
                cy={-pending.y}
                r={dot}
                fill="var(--c-accent)"
                stroke="var(--c-shot-ring)"
                strokeWidth={dot * 0.35}
              />
            </g>
            <line
              x1={pending.x - magR * 0.35}
              y1={magY}
              x2={pending.x + magR * 0.35}
              y2={magY}
              stroke="var(--c-accent)"
              strokeWidth={magR * 0.02}
            />
            <line
              x1={pending.x}
              y1={magY - magR * 0.35}
              x2={pending.x}
              y2={magY + magR * 0.35}
              stroke="var(--c-accent)"
              strokeWidth={magR * 0.02}
            />
          </g>
          <circle
            cx={pending.x}
            cy={magY}
            r={magR}
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth={magR * 0.04}
          />
          <circle
            cx={pending.x}
            cy={-pending.y}
            r={dot * 1.2}
            fill="var(--c-accent)"
            stroke="var(--c-shot-ring)"
            strokeWidth={dot * 0.3}
          />
        </>
      )}
    </svg>
  )
}
