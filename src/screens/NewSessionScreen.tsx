import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../app/router'
import { FORMATS, findFormat } from '../core/formats'
import type { Place, SpotMode, TargetFace, TimerConfig } from '../core/types'
import { createSession, listFaces, listSetups, listVersions, type StageSpec } from '../db/repo'
import { Button, Card, Field, Note, Segmented, Toggle } from '../ui/atoms'
import { TargetView } from '../ui/TargetView'

const DEFAULT_TIMER: TimerConfig = { enabled: false, seconds: 120, abcd: false, prepSeconds: 10 }

/**
 * Числовые поля формы держим строками, а не числами.
 * Иначе поле нельзя очистить: стёр — на его место тут же подставляется значение
 * по умолчанию, и новое число можно только дописать к нему.
 */
interface StageDraft {
  distance: string
  faceId: string
  ends: string
  arrows: string
}

/** Черновик в спецификацию этапа. null — введено что-то, с чем стрелять нельзя. */
function toSpec(d: StageDraft): StageSpec | null {
  const distanceM = Number(d.distance.replace(',', '.'))
  const arrowsPerEnd = Number(d.arrows)
  const endsRaw = d.ends.trim()
  const ends = endsRaw === '' ? null : Number(endsRaw)

  if (!Number.isFinite(distanceM) || distanceM <= 0) return null
  if (!Number.isFinite(arrowsPerEnd) || arrowsPerEnd < 1) return null
  if (ends !== null && (!Number.isFinite(ends) || ends < 1)) return null
  if (!d.faceId) return null

  return {
    distanceM,
    faceId: d.faceId,
    ends: ends === null ? null : Math.round(ends),
    arrowsPerEnd: Math.round(arrowsPerEnd),
  }
}

function faceSummary(f: TargetFace | undefined): string {
  if (!f) return ''
  if (f.kind === 'blank') return `поле ${f.widthMm / 10} см, сетка ${f.gridStepMm} мм`
  const values = f.rings.map((r) => r.value)
  const parts = [
    f.spots ? `${f.spots.centers.length} спота по ${(f.rings.at(-1)!.radiusMm * 2) / 10} см` : `${f.widthMm / 10} см`,
    `кольца ${Math.max(...values)}–${Math.min(...values)}`,
  ]
  if (f.innerTenOnly) parts.push('только внутренняя 10')
  else if (f.hasX) parts.push('есть X')
  return parts.join(' · ')
}

export function NewSessionScreen() {
  const faces = useLiveQuery(() => listFaces(), [], undefined)
  const setups = useLiveQuery(() => listSetups(), [], undefined)

  const [formatId, setFormatId] = useState('wa18')
  const format = findFormat(formatId) ?? FORMATS[0]
  const [stages, setStages] = useState<StageDraft[]>([])
  const [setupId, setSetupId] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [place, setPlace] = useState<Place>('indoor')
  const [note, setNote] = useState('')
  const [timer, setTimer] = useState<TimerConfig>(DEFAULT_TIMER)
  const [spotMode, setSpotMode] = useState<SpotMode>('onePerSpot')

  const versions = useLiveQuery(
    () => (setupId ? listVersions(setupId) : Promise.resolve([])),
    [setupId],
    [],
  )

  // Умолчания формата: дистанции и фейсы приходят отсюда, дальше можно поправить.
  useEffect(() => {
    setStages(
      format.stages.map((s) => ({
        distance: String(s.distanceM),
        faceId: s.defaultFaceId,
        ends: s.ends === null ? '' : String(s.ends),
        arrows: String(s.arrowsPerEnd),
      })),
    )
    if (format.place) setPlace(format.place)
  }, [format])

  // По умолчанию — последняя версия выбранного сетапа.
  useEffect(() => {
    if (!setupId && setups && setups.length > 0) setSetupId(setups[0].id)
  }, [setups, setupId])
  useEffect(() => {
    setVersionId(versions?.[0]?.id ?? null)
  }, [versions])

  const faceById = useMemo(
    () => new Map((faces ?? []).map((f) => [f.id, f] as const)),
    [faces],
  )

  const optionsFor = (i: number): TargetFace[] => {
    const list = faces ?? []
    const allowed = format.stages[Math.min(i, format.stages.length - 1)]?.faceOptions ?? []
    if (!format.customStages && allowed.length > 0) {
      return allowed.map((id) => faceById.get(id)).filter((f): f is TargetFace => !!f)
    }
    if (format.id === 'blank') return list.filter((f) => f.kind === 'blank')
    return list
  }

  const patchStage = (i: number, patch: Partial<StageDraft>) =>
    setStages((prev) => prev.map((s, j) => (i === j ? { ...s, ...patch } : s)))

  const specs = stages.map(toSpec)
  const ready = stages.length > 0 && specs.every((s): s is StageSpec => s !== null)

  const start = async () => {
    if (!ready) return
    const id = await createSession({
      format,
      stages: specs as StageSpec[],
      setupId,
      setupVersionId: versionId,
      place,
      note,
      timer: timer.enabled ? timer : null,
      spotMode,
    })
    navigate(`/shoot/${id}`)
  }

  const anyTrispot = stages.some((s) => (faceById.get(s.faceId)?.spots?.centers.length ?? 0) > 0)

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Формат" className="lg:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormatId(f.id)}
              className={`tap rounded-xl border px-3 py-2 text-left ${
                f.id === formatId ? 'border-accent bg-surface2' : 'border-line'
              }`}
            >
              <div className="font-semibold">{f.name}</div>
              <div className="text-xs text-muted">{f.short}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Этапы">
        <div className="grid gap-3">
          {stages.map((s, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Этап {i + 1}</span>
                {format.customStages && stages.length > 1 && (
                  <button
                    className="text-xs text-danger"
                    onClick={() => setStages((p) => p.filter((_, j) => j !== i))}
                  >
                    удалить
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Дистанция, м">
                  <input
                    inputMode="decimal"
                    disabled={!format.customStages}
                    value={s.distance}
                    onChange={(e) => patchStage(i, { distance: e.target.value })}
                  />
                </Field>
                <Field label="Фейс">
                  <select value={s.faceId} onChange={(e) => patchStage(i, { faceId: e.target.value })}>
                    {optionsFor(i).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Превью выбранного фейса: спутать трёхспот с одиночным на старте легко. */}
                <div className="col-span-2 flex items-center gap-3 rounded-lg bg-surface2 p-2">
                  {faceById.get(s.faceId) && (
                    <TargetView
                      face={faceById.get(s.faceId)!}
                      shots={[]}
                      readOnly
                      className="h-24 w-24 shrink-0"
                    />
                  )}
                  <div className="min-w-0 text-xs text-muted">
                    <div className="text-ink">{faceById.get(s.faceId)?.name ?? '—'}</div>
                    <div className="num">{faceSummary(faceById.get(s.faceId))}</div>
                  </div>
                </div>

                <Field label="Серий">
                  <input
                    inputMode="numeric"
                    disabled={!format.customStages}
                    value={s.ends}
                    placeholder="без ограничения"
                    onChange={(e) => patchStage(i, { ends: e.target.value })}
                  />
                </Field>
                <Field label="Стрел в серии">
                  <input
                    inputMode="numeric"
                    disabled={!format.customStages}
                    value={s.arrows}
                    onChange={(e) => patchStage(i, { arrows: e.target.value })}
                  />
                </Field>
                {specs[i] === null && (
                  <p className="col-span-2 text-xs text-danger">
                    Проверь этап: дистанция больше нуля, стрел в серии хотя бы одна. Число
                    серий можно оставить пустым — тогда стреляем сколько захочется.
                  </p>
                )}
              </div>
            </div>
          ))}
          {format.customStages && (
            <Button
              variant="ghost"
              onClick={() =>
                setStages((p) => [
                  ...p,
                  {
                    ...(p.at(-1) ?? {
                      distance: '18',
                      faceId: (faces ?? [])[0]?.id ?? '',
                      ends: '',
                      arrows: '3',
                    }),
                  },
                ])
              }
            >
              + Этап
            </Button>
          )}
          {format.id === 'free' && (
            <Note>
              Свободная тренировка: серий сколько захочется, счёт ведётся. Дистанцию можно
              сменить прямо во время сессии — это создаст новый этап.
            </Note>
          )}
          {format.id === 'blank' && (
            <Note>Отстрел без счёта: пишутся координаты и заметки, кучность считается.</Note>
          )}
        </div>
      </Card>

      <div className="grid gap-3">
        <Card title="Снаряжение">
          {setups?.length === 0 ? (
            <div className="grid gap-2">
              <Note>Сетапов пока нет. Сессию можно начать и без него, но сравнить настройки потом не выйдет.</Note>
              <Button variant="ghost" onClick={() => navigate('/setups')}>
                Завести сетап
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <Field label="Сетап">
                <select
                  value={setupId ?? ''}
                  onChange={(e) => setSetupId(e.target.value || null)}
                >
                  <option value="">без сетапа</option>
                  {setups?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              {setupId && (
                <Field label="Версия" hint="По умолчанию последняя">
                  <select
                    value={versionId ?? ''}
                    onChange={(e) => setVersionId(e.target.value || null)}
                  >
                    {versions?.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNo} · {new Date(v.createdAt).toLocaleDateString('ru-RU')} ·{' '}
                        {v.reason}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}
        </Card>

        <Card title="Условия">
          <div className="grid gap-3">
            <Segmented<Place>
              value={place}
              onChange={setPlace}
              options={[
                { value: 'indoor', label: 'Зал' },
                { value: 'outdoor', label: 'Улица' },
              ]}
            />
            <Field label="Заметка" hint="Погода, ветер, самочувствие">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {anyTrispot && (
              <Field label="Трёхспот">
                <Segmented<SpotMode>
                  value={spotMode}
                  onChange={setSpotMode}
                  options={[
                    { value: 'onePerSpot', label: 'По одной в спот' },
                    { value: 'free', label: 'Свободно' },
                  ]}
                />
              </Field>
            )}
          </div>
        </Card>

        <Card title="Таймер">
          <div className="grid gap-2">
            <Toggle
              checked={timer.enabled}
              onChange={(v) => setTimer({ ...timer, enabled: v })}
              label="Таймер серии"
              hint="Вибро и звук на старте, за 30 секунд и в конце"
            />
            {timer.enabled && (
              <>
                <Segmented<string>
                  value={String(timer.seconds)}
                  onChange={(v) => setTimer({ ...timer, seconds: Number(v) })}
                  options={[
                    { value: '120', label: '2 минуты' },
                    { value: '240', label: '4 минуты' },
                  ]}
                />
                <Toggle
                  checked={timer.abcd}
                  onChange={(v) => setTimer({ ...timer, abcd: v })}
                  label="Режим AB/CD"
                  hint="После своей серии идёт равное по времени ожидание чужой линии"
                />
              </>
            )}
          </div>
        </Card>

        <Button variant="primary" className="h-14" onClick={start} disabled={!ready}>
          Поехали
        </Button>
      </div>
    </div>
  )
}
