import type { PrecisionResult, SightAdvice } from '../core/metrics'
import { formatMm, formatMrad } from '../lib/stats'
import { Note } from './atoms'

const DIRECTION: Record<string, string> = {
  right: 'вправо',
  left: 'влево',
  up: 'вверх',
  down: 'вниз',
}

function Row({ label, mm, mrad, hint }: { label: string; mm: number | null; mrad: number; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-muted">
        {label}
        {hint && <span className="ml-1 text-xs opacity-70">{hint}</span>}
      </span>
      <span className="num text-right text-sm">
        {mm !== null && <span className="font-semibold">{formatMm(mm)} мм</span>}
        {mm !== null && ' · '}
        <span className={mm === null ? 'font-semibold' : 'text-muted'}>{formatMrad(mrad)} mrad</span>
      </span>
    </div>
  )
}

/**
 * Кучность и точность. Всё показывается и в мм, и в mrad: без углового пересчёта
 * 18 м и 70 м несравнимы.
 */
export function PrecisionBlock({
  mm,
  mrad,
  compact,
}: {
  /** null, если дистанции разные и миллиметры смешивать нельзя. */
  mm: PrecisionResult | null
  mrad: PrecisionResult
  compact?: boolean
}) {
  if (mrad.insufficient) {
    return (
      <Note>
        Мало данных: {mrad.n === 0 ? 'нет координат' : `выстрелов с координатами ${mrad.n}`}.
        Кучность считается от трёх.
      </Note>
    )
  }
  const m = mm && !mm.insufficient ? mm : null

  return (
    <div className="divide-y divide-line">
      <Row label="Mean radius" mm={m ? m.meanRadius : null} mrad={mrad.meanRadius} />
      <Row label="CEP50" mm={m ? m.cep50 : null} mrad={mrad.cep50} />
      <Row
        label="CEP95"
        mm={m ? m.cep95 : null}
        mrad={mrad.cep95}
        hint={mrad.cep95Approx ? 'ориентировочно' : undefined}
      />
      {!compact && (
        <>
          <Row label="СКО по x" mm={m ? m.sdX : null} mrad={mrad.sdX} />
          <Row label="СКО по y" mm={m ? m.sdY : null} mrad={mrad.sdY} />
          <Row label="Extreme spread" mm={m ? m.extremeSpread : null} mrad={mrad.extremeSpread} />
        </>
      )}
      <Row
        label="Смещение центроида"
        mm={m ? Math.hypot(m.centroid.x, m.centroid.y) : null}
        mrad={Math.hypot(mrad.centroid.x, mrad.centroid.y)}
      />
      {!compact && (
        <div className="num flex justify-between gap-3 py-1 text-xs text-muted">
          <span>по осям</span>
          <span>
            {m
              ? `x ${m.centroid.x >= 0 ? '+' : ''}${formatMm(m.centroid.x)} · y ${m.centroid.y >= 0 ? '+' : ''}${formatMm(m.centroid.y)} мм`
              : `x ${formatMrad(mrad.centroid.x)} · y ${formatMrad(mrad.centroid.y)} mrad`}
          </span>
        </div>
      )}
      <div className="num pt-1 text-xs text-muted">выстрелов с координатами: {mrad.n}</div>
    </div>
  )
}

export function SightAdviceBlock({
  advice,
  distanceM,
}: {
  advice: SightAdvice
  distanceM: number
}) {
  if (!advice.enough) return null
  if (!advice.any) {
    return <Note>Смещение центроида в пределах случайной ошибки — прицел не трогать.</Note>
  }
  const parts: string[] = []
  if (advice.horizontal.significant && advice.horizontal.direction) {
    parts.push(
      `${DIRECTION[advice.horizontal.direction]} на ${formatMm(Math.abs(advice.horizontal.offset))} мм (${formatMrad(Math.abs(advice.horizontal.offset) / distanceM)} mrad)`,
    )
  }
  if (advice.vertical.significant && advice.vertical.direction) {
    parts.push(
      `${DIRECTION[advice.vertical.direction]} на ${formatMm(Math.abs(advice.vertical.offset))} мм (${formatMrad(Math.abs(advice.vertical.offset) / distanceM)} mrad)`,
    )
  }
  return (
    <div className="rounded-lg bg-accent/15 px-3 py-2 text-sm">
      <div className="font-semibold text-accent">Прицел: {parts.join(', ')}</div>
      <div className="mt-0.5 text-xs text-muted">
        Прицел двигается вслед за группой. Величина — на мишени, переводи в свои щелчки.
      </div>
    </div>
  )
}
