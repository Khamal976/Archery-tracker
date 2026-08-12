import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import {
  ASTM_TO_AMO,
  computeSetup,
  parseInches,
  type ArrowInput,
  type BowInput,
} from '../core/spine'
import {
  BOWS,
  FLETCHINGS,
  NOCKS,
  SHAFTS,
  STRINGS,
  WOODS,
  type ShaftSpec,
} from '../core/spineData'
import { db } from '../db/db'
import { listSetups } from '../db/repo'
import { Button, Card, Field, Note, Stat, Toggle } from '../ui/atoms'

/** Черновик формы переживает переход между экранами: вводить это заново каждый раз мучительно. */
const DRAFT_KEY = 'spine-draft-v1'

const MATERIALS: { value: ShaftSpec['material'] | 'manual'; label: string }[] = [
  { value: 'carbon', label: 'Карбон' },
  { value: 'aluminum', label: 'Алюминий' },
  { value: 'hybrid', label: 'Гибрид' },
  { value: 'fiberglass', label: 'Стеклопластик' },
  { value: 'manual', label: 'Дерево / вручную' },
]

interface Draft {
  bowBrand: string
  bowModel: string
  ratedWeight: string
  ratedDraw: string
  drawLength: string
  strikePosition: string
  plateThickness: string
  stringName: string
  formFactor: string

  material: ShaftSpec['material'] | 'manual'
  shaftBrand: string
  shaftSeries: string
  shaftSize: string
  manualDeflection: string
  /** Дерево маркируют статическим спайном в фунтах, а не прогибом в дюймах. */
  manualSpineLb: string
  manualGpi: string
  manualOd: string
  woodSpecies: string

  bop: string
  point: string
  insert: string
  nock: string
  fletchName: string
  fletchGrains: string
  footingOn: boolean
  footingLength: string
  footingGrains: string
}

const DEFAULT_DRAFT: Draft = {
  bowBrand: 'Generic',
  bowModel: 'Recurve',
  ratedWeight: '38',
  ratedDraw: '28',
  drawLength: '28',
  strikePosition: '-0.125',
  plateThickness: '1/16',
  stringName: 'FastFlight 16 strand',
  formFactor: '0',

  // Стартовый набор подобран так, чтобы стрела попадала в допуск лука:
  // с пустого экрана сразу видно, как выглядит сошедшийся расчёт.
  material: 'carbon',
  shaftBrand: 'Easton Carbon',
  shaftSeries: 'Axis Traditional',
  shaftSize: '500',
  manualDeflection: '',
  manualSpineLb: '',
  manualGpi: '',
  manualOd: '',
  woodSpecies: '',

  bop: '28.5',
  point: '100',
  insert: '0',
  nock: '10',
  fletchName: '3 x 4" Feathers',
  fletchGrains: '18',
  footingOn: false,
  footingLength: '0',
  footingGrains: '0',
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? { ...DEFAULT_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : DEFAULT_DRAFT
  } catch {
    return DEFAULT_DRAFT
  }
}

const num = (s: string, fallback = 0): number => {
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

const uniq = (xs: string[]): string[] => [...new Set(xs)].sort((a, b) => a.localeCompare(b, 'ru'))

const fmt = (x: number, digits = 1): string => x.toFixed(digits)

/**
 * Шкала подбора: зелёное окно — допуск лука, метка — динамический спайн стрелы.
 * Стрелу тянут в окно длиной, наконечником и вставкой.
 */
function SpineMeter({
  required,
  min,
  max,
  arrow,
}: {
  required: number
  min: number
  max: number
  arrow: number
}) {
  const half = Math.max((max - min) * 1.5, Math.abs(arrow - required) * 1.3, 6)
  const from = required - half
  const span = half * 2
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - from) / span) * 100))}%`
  const inside = arrow >= min && arrow <= max

  return (
    <div className="grid gap-1">
      <div className="relative h-10 overflow-hidden rounded-xl border border-line bg-surface2">
        <div
          className="absolute inset-y-0 bg-accent/25"
          style={{ left: pos(min), width: `${((max - min) / span) * 100}%` }}
        />
        <div className="absolute inset-y-0 w-px bg-accent/70" style={{ left: pos(required) }} />
        <div
          className={`absolute inset-y-1 w-1 rounded-full ${inside ? 'bg-accent' : 'bg-danger'}`}
          style={{ left: pos(arrow) }}
        />
      </div>
      <div className="num flex justify-between text-xs text-muted">
        <span>{fmt(min)}</span>
        <span className="text-ink">нужно {fmt(required)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  )
}

export function SpineScreen() {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const setups = useLiveQuery(() => listSetups(), [], undefined)
  const versions = useLiveQuery(() => db.setupVersions.toArray(), [], undefined)
  const [setupId, setSetupId] = useState('')

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  // ------------------------------------------------------------------ лук

  const bowBrands = useMemo(() => {
    const rest = uniq(BOWS.map((b) => b.brand).filter((b) => b !== 'Generic'))
    return ['Generic', ...rest]
  }, [])

  const bowModels = useMemo(
    () => BOWS.filter((b) => b.brand === draft.bowBrand),
    [draft.bowBrand],
  )

  const bowSpec = useMemo(
    () => bowModels.find((b) => b.model === draft.bowModel) ?? bowModels[0],
    [bowModels, draft.bowModel],
  )

  // У обобщённых типов выреза нет — положение полки вводит стрелок.
  // У конкретной модели вырез известен, остаётся толщина накладки.
  const strikePosition = useMemo(() => {
    if (!bowSpec || bowSpec.riserCut === null) return num(draft.strikePosition)
    return bowSpec.riserCut + (parseInches(draft.plateThickness) ?? 0)
  }, [bowSpec, draft.strikePosition, draft.plateThickness])

  // ---------------------------------------------------------------- стрела

  const manual = draft.material === 'manual'

  const shaftBrands = useMemo(
    () => uniq(SHAFTS.filter((s) => s.material === draft.material).map((s) => s.brand)),
    [draft.material],
  )

  const shaftSeries = useMemo(
    () =>
      uniq(
        SHAFTS.filter((s) => s.material === draft.material && s.brand === draft.shaftBrand).map(
          (s) => s.series,
        ),
      ),
    [draft.material, draft.shaftBrand],
  )

  const shaftSizes = useMemo(
    () =>
      SHAFTS.filter(
        (s) =>
          s.material === draft.material &&
          s.brand === draft.shaftBrand &&
          s.series === draft.shaftSeries,
      ),
    [draft.material, draft.shaftBrand, draft.shaftSeries],
  )

  const shaft = useMemo(
    () => shaftSizes.find((s) => s.size === draft.shaftSize) ?? shaftSizes[0],
    [shaftSizes, draft.shaftSize],
  )

  // Каскад «залипает»: смена материала оставляет производителя из прошлого списка.
  // Черновик в зависимостях не нужен и вреден — эффект сам его правит и зациклится.
  useEffect(() => {
    if (manual) return
    if (!shaftBrands.includes(draft.shaftBrand)) patch({ shaftBrand: shaftBrands[0] ?? '' })
    else if (!shaftSeries.includes(draft.shaftSeries)) patch({ shaftSeries: shaftSeries[0] ?? '' })
    else if (shaft && shaft.size !== draft.shaftSize) patch({ shaftSize: shaft.size })
  }, [manual, shaftBrands, shaftSeries, shaft, draft.shaftBrand, draft.shaftSeries, draft.shaftSize])

  // То же самое для луков: смена производителя обнуляет модель на первую из нового списка.
  useEffect(() => {
    if (bowSpec && bowSpec.model !== draft.bowModel) patch({ bowModel: bowSpec.model })
  }, [bowSpec, draft.bowModel])

  const fletchGrains = useMemo(() => {
    if (draft.fletchName === 'Другое') return num(draft.fletchGrains)
    return FLETCHINGS.find((f) => f.name === draft.fletchName)?.value ?? 0
  }, [draft.fletchName, draft.fletchGrains])

  const isWood = manual && draft.woodSpecies !== ''

  const arrowInput: ArrowInput | null = useMemo(() => {
    // Дерево маркируют статическим спайном AMO в фунтах — переводим его в прогиб.
    const woodSpine = num(draft.manualSpineLb)
    const manualDeflection =
      isWood && woodSpine > 0 ? 26 / (woodSpine * ASTM_TO_AMO) : num(draft.manualDeflection)
    const deflection = manual ? manualDeflection : (shaft?.deflection ?? 0)
    const gpi = manual ? num(draft.manualGpi) : (shaft?.gpi ?? 0)
    const od = manual ? (parseInches(draft.manualOd) ?? 0) : (shaft?.od ?? 0)
    if (deflection <= 0 || gpi <= 0 || od <= 0) return null
    return {
      deflection,
      gpi,
      od,
      bop: num(draft.bop),
      pointGrains: num(draft.point),
      insertGrains: num(draft.insert),
      nockGrains: num(draft.nock),
      fletchGrains,
      footingLength: draft.footingOn ? num(draft.footingLength) : 0,
      footingGrains: draft.footingOn ? num(draft.footingGrains) : 0,
      isWood,
    }
  }, [manual, isWood, shaft, draft, fletchGrains])

  const bowInput: BowInput | null = useMemo(() => {
    if (!bowSpec) return null
    return {
      efficiency: bowSpec.efficiency,
      ratedWeight: num(draft.ratedWeight),
      ratedDraw: num(draft.ratedDraw, 28),
      drawLength: num(draft.drawLength, 28),
      strikePosition,
      stringFactor: STRINGS.find((s) => s.name === draft.stringName)?.value ?? 1,
      formFactor: num(draft.formFactor),
    }
  }, [bowSpec, draft, strikePosition])

  const result = useMemo(
    () => (arrowInput && bowInput && bowInput.ratedWeight > 0 ? computeSetup(arrowInput, bowInput) : null),
    [arrowInput, bowInput],
  )

  // ------------------------------------------------------- подстановка сетапа

  const applySetup = () => {
    const setup = setups?.find((s) => s.id === setupId)
    const version = versions?.find((v) => v.id === setup?.currentVersionId)
    if (!version) return
    const f = version.fields
    const p: Partial<Draft> = {}
    if (f.drawWeight) p.ratedWeight = f.drawWeight
    if (f.arrowLength) p.bop = f.arrowLength
    if (f.pointWeight) p.point = f.pointWeight
    if (f.stringStrands) {
      const strands = Math.round(num(f.stringStrands))
      const dacron = /дакрон|dacron/i.test(f.stringMaterial ?? '')
      const prefix = dacron ? 'Dacron' : 'FastFlight'
      const match = STRINGS.filter((s) => s.name.startsWith(prefix)).reduce<string | null>(
        (best, s) => {
          const n = num(s.name.replace(/\D+/g, ''))
          const bestN = best ? num(best.replace(/\D+/g, '')) : Infinity
          return Math.abs(n - strands) < Math.abs(bestN - strands) ? s.name : best
        },
        null,
      )
      if (match) p.stringName = match
    }
    patch(p)
  }

  const versionFor = (id: string | undefined) => versions?.find((v) => v.id === id)

  return (
    <div className="grid gap-3 pb-4">
      <Card title="Динамический спайн">
        <p className="text-sm text-muted">
          Считает, какой спайн нужен луку и какой получается у собранной стрелы. Совпали в пределах
          зелёного окна — стрела подобрана, дальше правится базой и выносом полки.
        </p>
        {setups && setups.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Подставить из сетапа">
              <select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
                <option value="">— выберите —</option>
                {setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              onClick={applySetup}
              disabled={!setupId || !versionFor(setups.find((s) => s.id === setupId)?.currentVersionId)}
            >
              Подставить
            </Button>
          </div>
        )}
      </Card>

      {result && (
        <Card title="Результат">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat label="Нужно луку, #" value={fmt(result.bow.requiredSpine)} />
            <Stat
              label="У стрелы, #"
              value={fmt(result.arrow.dynamicSpine)}
              sub={`${result.delta >= 0 ? '+' : ''}${fmt(result.delta)} — ${
                result.delta >= 0 ? 'жёстче' : 'слабее'
              }`}
            />
          </div>

          <SpineMeter
            required={result.bow.requiredSpine}
            min={result.bow.min}
            max={result.bow.max}
            arrow={result.arrow.dynamicSpine}
          />

          <p className={`mt-2 text-sm ${result.inTolerance ? 'text-accent' : 'text-danger'}`}>
            {result.inTolerance
              ? 'Стрела в допуске лука.'
              : `Мимо допуска на ${fmt(Math.abs(result.delta) - result.bow.tolerance)} #.`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Вес, гран" value={fmt(result.arrow.totalWeight, 0)} />
            <Stat label="FOC, %" value={fmt(result.arrow.foc)} />
            <Stat label="Гран на фунт" value={result.gpp === null ? '—' : fmt(result.gpp)} />
            <Stat label="Скорость, fps" value={result.speed === null ? '—' : fmt(result.speed, 0)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Энергия, ft·lbs" value={result.energy === null ? '—' : fmt(result.energy)} muted />
            <Stat label="Статический AMO" value={fmt(result.arrow.amoStaticSpine)} muted />
            <Stat label="Допуск лука, ±#" value={fmt(result.bow.tolerance, 2)} muted />
            <Stat label="Натяжение на растяжке" value={fmt(result.bow.weightAtDraw)} muted />
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-3 grid gap-2">
              {result.warnings.map((w) => (
                <Note key={w} tone="warn">
                  {w}
                </Note>
              ))}
            </div>
          )}
        </Card>
      )}

      {!result && (
        <Card title="Результат">
          <Note tone="warn">
            Не хватает данных: нужны прогиб, GPI и диаметр древка, а также паспортное натяжение лука.
          </Note>
        </Card>
      )}

      <Card title="Лук">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Производитель">
            <select value={draft.bowBrand} onChange={(e) => patch({ bowBrand: e.target.value })}>
              {bowBrands.map((b) => (
                <option key={b} value={b}>
                  {b === 'Generic' ? 'Обобщённый тип' : b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Модель">
            <select value={bowSpec?.model ?? ''} onChange={(e) => patch({ bowModel: e.target.value })}>
              {bowModels.map((b) => (
                <option key={b.model} value={b.model}>
                  {b.model}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Паспортное натяжение, фунты">
            <input
              inputMode="decimal"
              value={draft.ratedWeight}
              onChange={(e) => patch({ ratedWeight: e.target.value })}
            />
          </Field>
          <Field label="Паспортная растяжка, дюймы">
            <input
              inputMode="decimal"
              value={draft.ratedDraw}
              onChange={(e) => patch({ ratedDraw: e.target.value })}
            />
          </Field>

          <Field label="Своя растяжка, дюймы" hint="До дна прорези хвостовика на полном растяге">
            <input
              inputMode="decimal"
              value={draft.drawLength}
              onChange={(e) => patch({ drawLength: e.target.value })}
            />
          </Field>

          {bowSpec?.riserCut === null ? (
            <Field
              label="Положение полки, дюймы"
              hint="Минус — прорезано за центр тетивы, плюс — не доходит до центра"
            >
              <input
                inputMode="decimal"
                value={draft.strikePosition}
                onChange={(e) => patch({ strikePosition: e.target.value })}
              />
            </Field>
          ) : (
            <Field
              label="Толщина накладки, дюймы"
              hint={`Вырез рукоятки ${bowSpec?.riserCut ?? 0}″ уже учтён. Можно дробью: 1/16`}
            >
              <input
                value={draft.plateThickness}
                onChange={(e) => patch({ plateThickness: e.target.value })}
              />
            </Field>
          )}

          <Field label="Тетива">
            <select value={draft.stringName} onChange={(e) => patch({ stringName: e.target.value })}>
              {STRINGS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Персональная поправка"
            hint="−15…+15. Ноль, пока не откалибруете по голому древку"
          >
            <input
              inputMode="decimal"
              value={draft.formFactor}
              onChange={(e) => patch({ formFactor: e.target.value })}
            />
          </Field>
        </div>
        <p className="num mt-2 text-xs text-muted">
          Положение полки в расчёте: {strikePosition.toFixed(4)}″
        </p>
      </Card>

      <Card title="Древко">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Материал">
            <select
              value={draft.material}
              onChange={(e) => patch({ material: e.target.value as Draft['material'] })}
            >
              {MATERIALS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          {manual ? (
            <Field label="Порода дерева" hint="Подставит средний GPI для трубки 11/32″">
              <select
                value={draft.woodSpecies}
                onChange={(e) => {
                  const wood = WOODS.find((w) => w.name === e.target.value)
                  patch({
                    woodSpecies: e.target.value,
                    manualGpi: wood ? String(wood.value) : draft.manualGpi,
                    manualOd: wood && !draft.manualOd ? '11/32' : draft.manualOd,
                  })
                }}
              >
                <option value="">Не дерево</option>
                {WOODS.map((w) => (
                  <option key={w.name} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Производитель">
              <select
                value={draft.shaftBrand}
                onChange={(e) => patch({ shaftBrand: e.target.value })}
              >
                {shaftBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {!manual && (
            <>
              <Field label="Серия">
                <select
                  value={draft.shaftSeries}
                  onChange={(e) => patch({ shaftSeries: e.target.value })}
                >
                  {shaftSeries.map((s) => (
                    <option key={s} value={s}>
                      {s || '—'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Размер">
                <select
                  value={shaft?.size ?? ''}
                  onChange={(e) => patch({ shaftSize: e.target.value })}
                >
                  {shaftSizes.map((s) => (
                    <option key={s.size} value={s.size}>
                      {s.size}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {manual && (
            <>
              {isWood ? (
                <Field
                  label="Статический спайн AMO, фунты"
                  hint="Как маркируют дерево: для диапазона 45–50# берите середину"
                >
                  <input
                    inputMode="decimal"
                    value={draft.manualSpineLb}
                    onChange={(e) => patch({ manualSpineLb: e.target.value })}
                  />
                </Field>
              ) : (
                <Field
                  label="Прогиб по ASTM, дюймы"
                  hint="Спайн 500 — это 0.500. База 28″, груз 1.94 фунта"
                >
                  <input
                    inputMode="decimal"
                    value={draft.manualDeflection}
                    onChange={(e) => patch({ manualDeflection: e.target.value })}
                  />
                </Field>
              )}
              <Field label="GPI, гран на дюйм">
                <input
                  inputMode="decimal"
                  value={draft.manualGpi}
                  onChange={(e) => patch({ manualGpi: e.target.value })}
                />
              </Field>
              <Field label="Наружный диаметр, дюймы" hint="Можно дробью: 11/32">
                <input
                  value={draft.manualOd}
                  onChange={(e) => patch({ manualOd: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>

        {!manual && shaft && (
          <p className="num mt-2 text-xs text-muted">
            Прогиб {shaft.deflection}″ · GPI {shaft.gpi} · диаметр {shaft.od}″
            {shaft.stockLength ? ` · заводская длина ${shaft.stockLength}″` : ''}
            {shaft.insertGrains ? ` · вставка ${shaft.insert} ${shaft.insertGrains} гран` : ''}
          </p>
        )}
      </Card>

      <Card title="Сборка стрелы">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Длина BOP, дюймы" hint="От дна прорези хвостовика до задней кромки наконечника">
            <input inputMode="decimal" value={draft.bop} onChange={(e) => patch({ bop: e.target.value })} />
          </Field>
          <Field label="Наконечник, гран">
            <input
              inputMode="decimal"
              value={draft.point}
              onChange={(e) => patch({ point: e.target.value })}
            />
          </Field>
          <Field label="Вставка, гран" hint="Длинную вставку заводите футингом, а не сюда">
            <input
              inputMode="decimal"
              value={draft.insert}
              onChange={(e) => patch({ insert: e.target.value })}
            />
          </Field>
          <Field label="Хвостовик, гран" hint="Вместе с обмоткой и пином">
            <input
              inputMode="decimal"
              value={draft.nock}
              onChange={(e) => patch({ nock: e.target.value })}
            />
          </Field>
          <Field label="…или взять из справочника" hint={`${NOCKS.length} хвостовиков с весами`}>
            <select
              value=""
              onChange={(e) => {
                const found = NOCKS.find((n) => n.name === e.target.value)
                if (found) patch({ nock: String(found.value) })
              }}
            >
              <option value="">— выберите —</option>
              {NOCKS.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name} — {n.value} гран
                </option>
              ))}
            </select>
          </Field>

          <Field label="Оперение">
            <select value={draft.fletchName} onChange={(e) => patch({ fletchName: e.target.value })}>
              {FLETCHINGS.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
              <option value="Другое">Другое</option>
            </select>
          </Field>
          {draft.fletchName === 'Другое' && (
            <Field label="Вес оперения, гран">
              <input
                inputMode="decimal"
                value={draft.fletchGrains}
                onChange={(e) => patch({ fletchGrains: e.target.value })}
              />
            </Field>
          )}
        </div>

        <div className="mt-2 border-t border-line pt-2">
          <Toggle
            checked={draft.footingOn}
            onChange={(v) => patch({ footingOn: v })}
            label="Футинг"
            hint="Латунная вставка, HIT, трубка поверх трубки — всё, что длиннее обычных 0.9″"
          />
          {draft.footingOn && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field
                label="Длина футинга, дюймы"
                hint="Для внешнего — полная длина минус 0.9″"
              >
                <input
                  inputMode="decimal"
                  value={draft.footingLength}
                  onChange={(e) => patch({ footingLength: e.target.value })}
                />
              </Field>
              <Field label="Вес футинга, гран">
                <input
                  inputMode="decimal"
                  value={draft.footingGrains}
                  onChange={(e) => patch({ footingGrains: e.target.value })}
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <p className="px-1 text-xs text-muted">
        Формулы и справочники —{' '}
        <a
          href="https://heilakka.com/stumiller/"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          Stu Miller&apos;s Dynamic Spine Calculator
        </a>
        , версия V3 (Rev 5-12, 2012). Модель построена на традиционных луках с пальцевым отпуском:
        для олимпийского рекурва с плунжером считайте её ориентиром.
      </p>
    </div>
  )
}
