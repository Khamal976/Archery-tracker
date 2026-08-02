import type { TargetFace } from '../core/types'
import { faceRingValues } from '../core/faces'

export interface NumberKey {
  label: string
  value: number
  isX: boolean
  isMiss: boolean
}

export function keysFor(face: TargetFace): NumberKey[] {
  const keys: NumberKey[] = []
  if (face.hasX) keys.push({ label: 'X', value: 10, isX: true, isMiss: false })
  for (const v of faceRingValues(face)) {
    // На компаунд-фейсе внешней десятки в числовом вводе нет: она даёт 9.
    if (face.innerTenOnly && v === 10) continue
    keys.push({ label: String(v), value: v, isX: false, isMiss: false })
  }
  keys.push({ label: 'M', value: 0, isX: false, isMiss: true })
  return keys
}

export function NumberPad({
  face,
  onPick,
  disabled,
}: {
  face: TargetFace
  onPick: (k: NumberKey) => void
  disabled?: boolean
}) {
  const keys = keysFor(face)
  return (
    <div className="grid grid-cols-4 gap-2">
      {keys.map((k) => (
        <button
          key={k.label}
          disabled={disabled}
          onClick={() => onPick(k)}
          className={`tap num flex h-16 items-center justify-center rounded-xl border text-2xl font-semibold transition-opacity active:opacity-60 disabled:opacity-30 ${
            k.isX
              ? 'border-accent bg-accent text-bg'
              : k.isMiss
                ? 'border-line bg-surface2 text-muted'
                : 'border-line bg-surface2 text-ink'
          }`}
        >
          {k.label}
        </button>
      ))}
    </div>
  )
}
