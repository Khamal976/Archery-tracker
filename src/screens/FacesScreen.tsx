import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { concentricRings } from '../core/faces'
import type { TargetFace } from '../core/types'
import { deleteFace, listFaces, newId, saveFace } from '../db/repo'
import { Button, Card, Field, Modal, Note, Segmented } from '../ui/atoms'
import { TargetView } from '../ui/TargetView'

type SpotLayout = 'none' | 'vertical3' | 'triangle3'

interface Draft {
  name: string
  kind: 'scored' | 'blank'
  ringWidthMm: string
  highest: string
  lowest: string
  hasX: boolean
  innerTenOnly: boolean
  spots: SpotLayout
  pitchMm: string
  blankSizeMm: string
  gridStepMm: string
}

const EMPTY: Draft = {
  name: '',
  kind: 'scored',
  ringWidthMm: '20',
  highest: '10',
  lowest: '1',
  hasX: true,
  innerTenOnly: false,
  spots: 'none',
  pitchMm: '210',
  blankSizeMm: '600',
  gridStepMm: '50',
}

function buildFace(d: Draft): TargetFace {
  const t = Date.now()
  const base = {
    id: newId(),
    name: d.name.trim() || 'Новый фейс',
    builtIn: false,
    updatedAt: t,
    deletedAt: null,
  }
  if (d.kind === 'blank') {
    const size = Math.max(50, Number(d.blankSizeMm) || 600)
    return {
      ...base,
      kind: 'blank',
      widthMm: size,
      heightMm: size,
      rings: [],
      hasX: false,
      xRadiusMm: null,
      innerTenOnly: false,
      spots: null,
      gridStepMm: Math.max(5, Number(d.gridStepMm) || 50),
    }
  }

  const w = Math.max(1, Number(d.ringWidthMm) || 20)
  const highest = Math.min(10, Math.max(1, Number(d.highest) || 10))
  const lowest = Math.min(highest, Math.max(1, Number(d.lowest) || 1))
  const rings = concentricRings(w, highest, lowest)
  const outer = rings[rings.length - 1].radiusMm
  const pitch = Math.max(outer * 2, Number(d.pitchMm) || outer * 2.1)

  if (d.spots === 'none') {
    return {
      ...base,
      kind: 'scored',
      widthMm: outer * 2,
      heightMm: outer * 2,
      rings,
      hasX: d.hasX,
      xRadiusMm: d.hasX ? w / 2 : null,
      innerTenOnly: d.innerTenOnly,
      spots: null,
      gridStepMm: null,
    }
  }

  const centers =
    d.spots === 'vertical3'
      ? [
          { x: 0, y: pitch },
          { x: 0, y: 0 },
          { x: 0, y: -pitch },
        ]
      : [
          { x: -pitch / 2, y: pitch / (2 * Math.sqrt(3)) },
          { x: pitch / 2, y: pitch / (2 * Math.sqrt(3)) },
          { x: 0, y: -pitch / Math.sqrt(3) },
        ]

  const spanX = Math.max(...centers.map((c) => Math.abs(c.x))) * 2 + outer * 2
  const spanY = Math.max(...centers.map((c) => Math.abs(c.y))) * 2 + outer * 2

  return {
    ...base,
    kind: 'scored',
    widthMm: spanX,
    heightMm: spanY,
    rings,
    hasX: d.hasX,
    xRadiusMm: d.hasX ? w / 2 : null,
    innerTenOnly: d.innerTenOnly,
    spots: { centers, zoneRadiusMm: outer },
    gridStepMm: null,
  }
}

export function FacesScreen() {
  const faces = useLiveQuery(() => listFaces(), [], undefined)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const preview = useMemo(() => buildFace(draft), [draft])
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <div className="grid gap-3">
      <Card
        title="Мишени"
        action={
          <Button
            variant="primary"
            onClick={() => {
              setDraft(EMPTY)
              setOpen(true)
            }}
          >
            + Фейс
          </Button>
        }
      >
        <Note>
          Фейс — это данные: диаметр, кольца с радиусами и номиналами, X, флаг «только
          внутренняя десятка», геометрия спотов. Встроенные удалить нельзя.
        </Note>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {faces?.map((f) => (
            <div key={f.id} className="rounded-xl border border-line p-2">
              <TargetView face={f} shots={[]} readOnly className="h-36 w-full" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm">{f.name}</div>
                  <div className="num text-xs text-muted">
                    {f.kind === 'blank'
                      ? `${f.widthMm} мм, сетка ${f.gridStepMm} мм`
                      : `${f.rings.length} колец${f.spots ? `, ${f.spots.centers.length} спота` : ''}${
                          f.innerTenOnly ? ', внутр. 10' : ''
                        }`}
                  </div>
                </div>
                {!f.builtIn && (
                  <button className="text-xs text-danger" onClick={() => deleteFace(f.id)}>
                    удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый фейс" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-3">
            <Field label="Название">
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Segmented<'scored' | 'blank'>
              value={draft.kind}
              onChange={(v) => set({ kind: v })}
              options={[
                { value: 'scored', label: 'Со счётом' },
                { value: 'blank', label: 'Пустой' },
              ]}
            />

            {draft.kind === 'blank' ? (
              <>
                <Field label="Размер поля, мм">
                  <input
                    inputMode="numeric"
                    value={draft.blankSizeMm}
                    onChange={(e) => set({ blankSizeMm: e.target.value })}
                  />
                </Field>
                <Field label="Шаг сетки, мм">
                  <input
                    inputMode="numeric"
                    value={draft.gridStepMm}
                    onChange={(e) => set({ gridStepMm: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Ширина кольца, мм" hint="Внешний радиус номинала v = (11−v)·ширина">
                  <input
                    inputMode="decimal"
                    value={draft.ringWidthMm}
                    onChange={(e) => set({ ringWidthMm: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Старший номинал">
                    <input
                      inputMode="numeric"
                      value={draft.highest}
                      onChange={(e) => set({ highest: e.target.value })}
                    />
                  </Field>
                  <Field label="Младший номинал">
                    <input
                      inputMode="numeric"
                      value={draft.lowest}
                      onChange={(e) => set({ lowest: e.target.value })}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.hasX}
                    onChange={(e) => set({ hasX: e.target.checked })}
                  />
                  Есть внутренняя десятка (X)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.innerTenOnly}
                    onChange={(e) => set({ innerTenOnly: e.target.checked })}
                  />
                  Засчитывается только внутренняя десятка (внешняя даёт 9)
                </label>
                <Field label="Споты">
                  <select
                    value={draft.spots}
                    onChange={(e) => set({ spots: e.target.value as SpotLayout })}
                  >
                    <option value="none">Один центр</option>
                    <option value="vertical3">Трёхспот вертикальный</option>
                    <option value="triangle3">Трёхспот треугольный</option>
                  </select>
                </Field>
                {draft.spots !== 'none' && (
                  <Field label="Расстояние между центрами спотов, мм">
                    <input
                      inputMode="numeric"
                      value={draft.pitchMm}
                      onChange={(e) => set({ pitchMm: e.target.value })}
                    />
                  </Field>
                )}
              </>
            )}
          </div>

          <div className="grid content-start gap-3">
            <TargetView face={preview} shots={[]} readOnly className="h-64 w-full" />
            <Button
              variant="primary"
              onClick={async () => {
                await saveFace(buildFace(draft))
                setOpen(false)
              }}
            >
              Сохранить фейс
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
