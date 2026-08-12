/**
 * Динамический спайн: подбор стрелы под лук.
 *
 * Формулы и справочники — Stu Miller's Dynamic Spine Calculator, версия V3
 * (Rev 5-12, май 2012), https://heilakka.com/stumiller/
 * Константы (2.8, 0.4, 125, 9.5, 0.025, 30) подобраны автором эмпирически по отстрелу
 * на машине, вывода из физики у них нет — поэтому переписаны как есть, без «улучшений».
 *
 * Смысл модели: статический спайн трубки пересчитывается в динамический с поправками
 * на длину, вес переднего конца, массу, диаметр и бочкообразность; лук отдельно даёт
 * требуемое число. Совпали в пределах допуска — стрела подобрана.
 *
 * Формулы взяты не на глаз: их текст вытащен из книги Excel как есть. Восстанавливать
 * их подгонкой по значениям нельзя — на исходном сетапе множитель по GPI совпадает
 * сразу у нескольких разных формул, и ошибка вылезает только на краях диапазона.
 * Сверка живёт в spineReference.test.ts, десять точек посчитаны самим Excel.
 *
 * ГРАНИЦЫ ПРИМЕНИМОСТИ. Модель откалибрована на традиционных луках с пальцевым отпуском
 * и на древках диаметром 4.8–10.7 мм. Для тонких таргетных трубок (3.2–4.2 мм) поправка
 * на диаметр линейно экстраполируется далеко за пределы выборки и даёт −3…−4 фунта;
 * см. warnings в результате.
 *
 * Единицы имперские, как в оригинале: дюймы, граны, фунты.
 */

import { STRIKE_TABLE } from './spineData'

/** Диаметр трубки, к которому привязана поправка: 11/32 дюйма. */
const REFERENCE_OD = 11 / 32

/** Перевод прогиба ASTM (1.94 фунта / база 28") в AMO (2 фунта / база 26"). */
export const ASTM_TO_AMO = 0.825

export interface ArrowInput {
  /** Прогиб трубки по ASTM, дюймы. */
  deflection: number
  /** Вес трубки, гран на дюйм. */
  gpi: number
  /** Наружный диаметр, дюймы. */
  od: number
  /**
   * Поправка на бочкообразность, проценты: у древков с переменным сечением
   * передок жёстче. У параллельных трубок 0.
   */
  focCompPct: number
  /** Длина BOP: от дна прорези хвостовика до задней кромки наконечника, дюймы. */
  bop: number
  pointGrains: number
  insertGrains: number
  nockGrains: number
  fletchGrains: number
  /** Футинг: внутренний (длинная вставка) или внешний (трубка поверх трубки). */
  footingLength: number
  footingGrains: number
  /** Деревянные древки считаются иначе: вставки нет, длина берётся с поправкой. */
  isWood: boolean
}

export interface BowInput {
  /** КПД конструкции: множитель к паспортным фунтам. */
  efficiency: number
  /** Паспортное натяжение, фунты. */
  ratedWeight: number
  /** Растяжка, на которой заявлено натяжение, дюймы. */
  ratedDraw: number
  /** Своя растяжка, дюймы. */
  drawLength: number
  /** Положение полки относительно центра, дюймы: минус — прорезано за центр. */
  strikePosition: number
  /** Множитель тетивы. */
  stringFactor: number
  /** Персональная поправка на технику, −15…+15. */
  formFactor: number
}

export interface ArrowResult {
  /** Динамический спайн стрелы, фунты. */
  dynamicSpine: number
  /** Статический спайн по AMO — то, чем меряют трубку. */
  amoStaticSpine: number
  /** Собранный вес стрелы, граны. */
  totalWeight: number
  /** Расстояние от задней кромки наконечника до точки баланса, дюймы. */
  balancePoint: number
  /** Баланс вперёд от середины, проценты. */
  foc: number
  /** Слагаемые расчёта — чтобы было видно, откуда взялось число. */
  parts: {
    base: number
    diameter: number
    mass: number
    focComp: number
    gpiFactor: number
  }
}

export interface BowResult {
  /** Требуемый динамический спайн, фунты. */
  requiredSpine: number
  /** Допуск лука: полуширина окна подходящих спайнов, фунты. */
  tolerance: number
  min: number
  max: number
  /** Натяжение на своей растяжке, фунты. */
  weightAtDraw: number
  /** Положение полки вышло за таблицу, взят край. */
  strikeClamped: boolean
}

export interface SetupResult {
  arrow: ArrowResult
  bow: BowResult
  /** Расхождение стрелы и лука: минус — стрела слабее, чем нужно. */
  delta: number
  /** Попадает ли стрела в допуск лука. */
  inTolerance: boolean
  /** Вес стрелы на фунт натяжения. */
  gpp: number | null
  /** Начальная скорость, футы в секунду; null — вне области определения формулы. */
  speed: number | null
  /** Кинетическая энергия, фунт-футы. */
  energy: number | null
  warnings: string[]
}

const log10 = (x: number) => Math.log10(x)

/**
 * Ввод дюймов: и «0.344», и «11/32» — оригинал принимает оба вида,
 * а древки и накладки меряют то так, то эдак.
 */
export function parseInches(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (!s) return null
  const fraction = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (!denominator) return null
    return Number(fraction[1]) / denominator
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Поправка к требуемому спайну и допуск лука по положению полки.
 * В оригинале это VLOOKUP с приблизительным совпадением, то есть ступенька:
 * берётся последняя строка с положением не больше запрошенного. Повторяем как есть,
 * иначе числа разойдутся с эталоном.
 */
export function strikeLookup(position: number): {
  adjustment: number
  tolerance: number
  clamped: boolean
} {
  const first = STRIKE_TABLE[0]
  const last = STRIKE_TABLE[STRIKE_TABLE.length - 1]
  if (position < first[0]) return { adjustment: first[1], tolerance: first[2], clamped: true }
  if (position > last[0]) return { adjustment: last[1], tolerance: last[2], clamped: true }

  let row = first
  for (const candidate of STRIKE_TABLE) {
    if (candidate[0] > position) break
    row = candidate
  }
  return { adjustment: row[1], tolerance: row[2], clamped: false }
}

/** Полный вес собранной стрелы, граны. */
export function totalWeight(a: ArrowInput): number {
  const shaft = a.gpi * a.bop
  const insert = a.isWood ? 0 : a.insertGrains
  return shaft + a.pointGrains + insert + a.fletchGrains + a.nockGrains + a.footingGrains
}

export function computeArrow(a: ArrowInput): ArrowResult {
  const weight = totalWeight(a)
  const deflection26 = a.deflection * ASTM_TO_AMO

  // Деревянное древко считается на 0.9" длиннее: у него нет вставки, точка опоры другая.
  const woodOffset = a.isWood ? -0.9 : 0
  const lengthFactor = 1 + ((a.bop - 29 - woodOffset - a.footingLength) / 29) * 2.8

  const insert = a.isWood ? 0 : a.insertGrains
  const frontGrains =
    a.pointGrains + insert + a.footingGrains + a.footingLength * a.gpi
  const massFactor = 1 + ((frontGrains - 125 - a.fletchGrains + 10 - a.nockGrains) / 125) * 0.4

  const denominator = deflection26 * lengthFactor * massFactor
  const base = denominator > 0 ? 26 / denominator : 0

  const amoStaticSpine = deflection26 > 0 ? 26 / deflection26 : 0
  const diameter = (a.od - REFERENCE_OD) * 30
  const mass = (base * 9.5 - weight) * 0.025
  const focComp = (a.focCompPct / 100) * amoStaticSpine
  // Лёгкая трубка при равном спайне работает жёстче — отсюда множитель от GPI.
  const gpiFactor = 1 + (11 - a.gpi) / 100

  // Точка баланса: наконечник и вставка сидят на нуле, поэтому в числитель не входят.
  const moment = (a.gpi * a.bop * a.bop) / 2 + a.fletchGrains * (a.bop - 2.5) + a.nockGrains * a.bop
  const balancePoint = weight > 0 ? (moment / weight) * (1 - focComp / 100) : 0

  return {
    dynamicSpine: (base + diameter + mass - focComp) * gpiFactor,
    amoStaticSpine,
    totalWeight: weight,
    balancePoint,
    foc: a.bop > 0 ? ((a.bop / 2 - balancePoint) / a.bop) * 100 : 0,
    parts: { base, diameter, mass, focComp, gpiFactor },
  }
}

/**
 * Натяжение на своей растяжке для расчёта спайна.
 * Прирост на дюйм зависит от того, насколько лук уже нагружен: у мощного плеча
 * кривая круче. Отсюда логарифм по основанию 1.138 — подгонка автора.
 */
function weightAtDrawForSpine(b: BowInput): number {
  if (b.ratedWeight <= 0 || b.ratedWeight >= 241) return b.ratedWeight
  const perInch =
    3 + (Math.log(b.ratedWeight / (241 - b.ratedWeight) + 2.4) / Math.log(1.138) - 7.59) * 3
  return b.ratedWeight + (b.drawLength - b.ratedDraw) * perInch
}

/** Натяжение на своей растяжке для веса и скорости — у автора здесь другая подгонка. */
function weightAtDrawForSpeed(b: BowInput): number | null {
  if (b.ratedWeight <= 0 || b.ratedWeight >= 100) return null
  const perInch = 3 + log10(b.ratedWeight / (100 - b.ratedWeight)) * 3
  const w = b.ratedWeight + (b.drawLength - b.ratedDraw) * perInch
  return w > 0 ? w : null
}

export function computeBow(b: BowInput): BowResult {
  const strike = strikeLookup(b.strikePosition)
  const weightAtDraw = weightAtDrawForSpine(b)
  const required =
    b.efficiency * weightAtDraw * b.stringFactor * (1 + 0.015 * b.formFactor) + strike.adjustment

  return {
    requiredSpine: required,
    tolerance: strike.tolerance,
    min: required - strike.tolerance,
    max: required + strike.tolerance,
    weightAtDraw,
    strikeClamped: strike.clamped,
  }
}

/**
 * Начальная скорость, футы в секунду. Заявленная автором точность — ±2 fps.
 * Логарифм от отношения веса стрелы к запасённой энергии, плюс поправки
 * на растяжку и на глубину выреза полки. Подгонка под отстрел на машине.
 */
export function computeSpeed(a: ArrowResult, b: BowInput): number | null {
  const weightAtDraw = weightAtDrawForSpeed(b)
  if (weightAtDraw === null) return null
  const stored = b.efficiency * weightAtDraw * (b.stringFactor - 0.05)
  if (stored <= 0) return null
  const lg = log10(a.totalWeight / stored + 4) - 0.15
  if (lg <= 0) return null
  const speed =
    ((200 / lg) * (1 - (29 - b.drawLength) * 0.02) - 23) *
    (1 - (b.strikePosition - 0.063) / 6)
  return speed > 0 ? speed : null
}

function collectWarnings(a: ArrowInput, b: BowInput, bow: BowResult, delta: number): string[] {
  const w: string[] = []
  if (a.od > 0 && a.od < 0.236) {
    w.push(
      'Древко тоньше 6 мм. Модель откалибрована на трубках 4.8–10.7 мм, поправка на диаметр ' +
        'здесь экстраполируется далеко за пределы данных — считайте результат ориентиром.',
    )
  }
  if (bow.strikeClamped) {
    w.push('Положение полки вышло за таблицу поправок — взято крайнее значение.')
  }
  if (b.drawLength > 0 && Math.abs(b.drawLength - b.ratedDraw) > 4) {
    w.push('Своя растяжка отличается от паспортной больше чем на 4 дюйма: пересчёт натяжения грубеет.')
  }
  if (Math.abs(delta) > 10) {
    w.push('Расхождение больше 10 фунтов — проверьте введённые данные, обычно это опечатка.')
  }
  return w
}

/** Полный расчёт связки «лук + стрела». */
export function computeSetup(a: ArrowInput, b: BowInput): SetupResult {
  const arrow = computeArrow(a)
  const bow = computeBow(b)
  const delta = arrow.dynamicSpine - bow.requiredSpine
  const speed = computeSpeed(arrow, b)
  const weightAtDraw = weightAtDrawForSpeed(b)

  return {
    arrow,
    bow,
    delta,
    inTolerance: Math.abs(delta) <= bow.tolerance,
    gpp: weightAtDraw ? arrow.totalWeight / weightAtDraw : null,
    speed,
    // Кинетическая энергия: граны и футы в секунду сведены к фунт-футам одним делителем.
    energy: speed === null ? null : (arrow.totalWeight / 451080) * speed * speed,
    warnings: collectWarnings(a, b, bow, delta),
  }
}
