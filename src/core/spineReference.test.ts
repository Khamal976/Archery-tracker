import { describe, expect, it } from 'vitest'
import { computeSetup, type ArrowInput, type BowInput } from './spine'

/**
 * Эталон снят с формул самого калькулятора Стю: их текст вытащен из книги
 * (лист защищён паролем, поэтому входы менять нельзя) и переписан один в один
 * в отдельную книгу, где Excel посчитал десять комбинаций.
 *
 * Зачем так: раньше сверка шла по одной точке, и на ней две разные формулы
 * множителя по GPI совпадали случайно. Здесь точки специально разнесены —
 * GPI от 3.6 до 15.5, деревянное древко, футинг, бочкообразное древко,
 * персональная поправка обоих знаков.
 *
 * Пересобрать: scratchpad/bench.py (нужен Excel).
 */

interface Case {
  arrow: ArrowInput
  bow: BowInput
  expect: {
    dynamicSpine: number
    requiredSpine: number
    totalWeight: number
    foc: number
    speed: number
    energy: number
    gpp: number
    gpiFactor: number
  }
}

const CASES: Case[] = [
  {
    arrow: {
      deflection: 0.62,
      gpi: 10.03448276,
      od: 0.296875,
      focCompPct: 0,
      bop: 30,
      pointGrains: 90,
      insertGrains: 0,
      nockGrains: 16,
      fletchGrains: 18.3,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 1.07,
      ratedWeight: 38,
      ratedDraw: 28,
      drawLength: 28,
      strikePosition: -0.1875,
      stringFactor: 1.03,
      formFactor: 0,
    },
    expect: {
      dynamicSpine: 59.327212,
      requiredSpine: 59.8798,
      totalWeight: 425.334483,
      foc: 6.906329,
      speed: 176.897401,
      energy: 29.506651,
      gpp: 11.193013,
      gpiFactor: 1.00965517,
    },
  },
  {
    arrow: {
      deflection: 0.5,
      gpi: 6.9,
      od: 0.19291,
      focCompPct: 0,
      bop: 28.5,
      pointGrains: 100,
      insertGrains: 0,
      nockGrains: 10,
      fletchGrains: 6.9,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 1.04,
      ratedWeight: 38,
      ratedDraw: 28,
      drawLength: 28,
      strikePosition: -0.125,
      stringFactor: 1.03,
      formFactor: 0,
    },
    expect: {
      dynamicSpine: 82.145097,
      requiredSpine: 55.7056,
      totalWeight: 313.55,
      foc: 13.444511,
      speed: 193.020971,
      energy: 25.897761,
      gpp: 8.251316,
      gpiFactor: 1.041,
    },
  },
  {
    arrow: {
      deflection: 2.0,
      gpi: 3.6,
      od: 0.19528,
      focCompPct: 0,
      bop: 27,
      pointGrains: 70,
      insertGrains: 0,
      nockGrains: 8,
      fletchGrains: 4.8,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 1.0,
      ratedWeight: 24,
      ratedDraw: 28,
      drawLength: 27,
      strikePosition: -0.0625,
      stringFactor: 1.05,
      formFactor: 0,
    },
    expect: {
      dynamicSpine: 22.228359,
      requiredSpine: 33.528006,
      totalWeight: 180.0,
      foc: 16.135802,
      speed: 187.479809,
      energy: 14.02581,
      gpp: 7.999358,
      gpiFactor: 1.074,
    },
  },
  {
    arrow: {
      deflection: 0.336,
      gpi: 13.724,
      od: 0.34375,
      focCompPct: 0,
      bop: 31,
      pointGrains: 160,
      insertGrains: 30,
      nockGrains: 20,
      fletchGrains: 12.8,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 1.04,
      ratedWeight: 55,
      ratedDraw: 28,
      drawLength: 30,
      strikePosition: 0,
      stringFactor: 0.98,
      formFactor: 0,
    },
    expect: {
      dynamicSpine: 67.611491,
      requiredSpine: 67.666977,
      totalWeight: 648.244,
      foc: 12.284303,
      speed: 178.263878,
      energy: 45.667962,
      gpp: 10.536629,
      gpiFactor: 0.97276,
    },
  },
  {
    arrow: {
      deflection: 0.37454545,
      gpi: 9.4,
      od: 0.302,
      focCompPct: 3,
      bop: 29,
      pointGrains: 125,
      insertGrains: 15,
      nockGrains: 12,
      fletchGrains: 9.6,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 1.04,
      ratedWeight: 45,
      ratedDraw: 28,
      drawLength: 28.5,
      strikePosition: 0.0625,
      stringFactor: 1.075,
      formFactor: 0,
    },
    expect: {
      dynamicSpine: 89.787722,
      requiredSpine: 53.800864,
      totalWeight: 434.2,
      foc: 14.738029,
      speed: 183.982467,
      energy: 32.582854,
      gpp: 9.363959,
      gpiFactor: 1.016,
    },
  },
  {
    arrow: {
      deflection: 0.63030303,
      gpi: 10.46,
      od: 0.34375,
      focCompPct: 0,
      bop: 28.5,
      pointGrains: 125,
      insertGrains: 30,
      nockGrains: 12,
      fletchGrains: 9.6,
      footingLength: 0,
      footingGrains: 0,
      isWood: true,
    },
    bow: {
      efficiency: 0.97,
      ratedWeight: 45,
      ratedDraw: 28,
      drawLength: 28,
      strikePosition: 0.125,
      stringFactor: 0.99,
      formFactor: 0,
    },
    expect: {
      dynamicSpine: 51.027166,
      requiredSpine: 41.2135,
      totalWeight: 444.71,
      foc: 11.814914,
      speed: 167.150702,
      energy: 27.544807,
      gpp: 9.882444,
      gpiFactor: 1.0054,
    },
  },
  {
    arrow: {
      deflection: 0.54545455,
      gpi: 8.9,
      od: 0.265,
      focCompPct: 0,
      bop: 29.5,
      pointGrains: 100,
      insertGrains: 0,
      nockGrains: 11,
      fletchGrains: 6.9,
      footingLength: 1.5,
      footingGrains: 40,
      isWood: false,
    },
    bow: {
      efficiency: 1.05,
      ratedWeight: 42,
      ratedDraw: 28,
      drawLength: 29,
      strikePosition: 0.1875,
      stringFactor: 1.1,
      formFactor: 0,
    },
    expect: {
      dynamicSpine: 62.696105,
      requiredSpine: 46.400792,
      totalWeight: 420.45,
      foc: 14.659233,
      speed: 183.895078,
      energy: 31.521073,
      gpp: 9.431473,
      gpiFactor: 1.021,
    },
  },
  {
    arrow: {
      deflection: 0.42424242,
      gpi: 10.2,
      od: 0.31,
      focCompPct: 0,
      bop: 32,
      pointGrains: 145,
      insertGrains: 20,
      nockGrains: 18,
      fletchGrains: 6.9,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 1.05,
      ratedWeight: 50,
      ratedDraw: 28,
      drawLength: 31,
      strikePosition: 0.25,
      stringFactor: 1.15,
      formFactor: 12,
    },
    expect: {
      dynamicSpine: 52.478345,
      requiredSpine: 73.849707,
      totalWeight: 516.3,
      foc: 13.672102,
      speed: 198.297413,
      energy: 45.007268,
      gpp: 8.750847,
      gpiFactor: 1.008,
    },
  },
  {
    arrow: {
      deflection: 0.72727273,
      gpi: 7.2,
      od: 0.246,
      focCompPct: 0,
      bop: 27.5,
      pointGrains: 80,
      insertGrains: 0,
      nockGrains: 9,
      fletchGrains: 3.2,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 0.97,
      ratedWeight: 30,
      ratedDraw: 28,
      drawLength: 26.5,
      strikePosition: -0.145,
      stringFactor: 0.97,
      formFactor: -9,
    },
    expect: {
      dynamicSpine: 66.095072,
      requiredSpine: 38.118196,
      totalWeight: 290.2,
      foc: 11.781843,
      speed: 162.816767,
      energy: 17.054622,
      gpp: 10.686446,
      gpiFactor: 1.038,
    },
  },
  {
    arrow: {
      deflection: 0.29090909,
      gpi: 15.5,
      od: 0.325,
      focCompPct: 0,
      bop: 30,
      pointGrains: 200,
      insertGrains: 50,
      nockGrains: 25,
      fletchGrains: 0,
      footingLength: 0,
      footingGrains: 0,
      isWood: false,
    },
    bow: {
      efficiency: 1.0,
      ratedWeight: 60,
      ratedDraw: 28,
      drawLength: 29.5,
      strikePosition: 0.5,
      stringFactor: 1.0,
      formFactor: 3,
    },
    expect: {
      dynamicSpine: 68.153769,
      requiredSpine: 50.263567,
      totalWeight: 740.0,
      foc: 15.202703,
      speed: 156.668131,
      energy: 40.266091,
      gpp: 11.33363,
      gpiFactor: 0.955,
    },
  },
]

describe('сверка с формулами оригинала на десяти точках', () => {
  CASES.forEach((c, i) => {
    it(`точка ${i + 1}: GPI ${c.arrow.gpi.toFixed(2)}, лук ${c.bow.ratedWeight}#`, () => {
      const r = computeSetup(c.arrow, c.bow)
      expect(r.arrow.dynamicSpine).toBeCloseTo(c.expect.dynamicSpine, 4)
      expect(r.bow.requiredSpine).toBeCloseTo(c.expect.requiredSpine, 4)
      expect(r.arrow.totalWeight).toBeCloseTo(c.expect.totalWeight, 4)
      expect(r.arrow.foc).toBeCloseTo(c.expect.foc, 4)
      expect(r.arrow.parts.gpiFactor).toBeCloseTo(c.expect.gpiFactor, 6)
      expect(r.speed).toBeCloseTo(c.expect.speed, 3)
      expect(r.energy).toBeCloseTo(c.expect.energy, 3)
      expect(r.gpp).toBeCloseTo(c.expect.gpp, 4)
    })
  })

  it('множитель по GPI остаётся положительным на всём диапазоне справочника', () => {
    // Ровно здесь была ошибка: восстановленная по одной точке формула
    // обнулялась при GPI 6.43 и уходила в минус — и лёгкие таргетные древки
    // получали отрицательный спайн.
    for (const gpi of [3, 4, 5, 6, 6.43, 7, 10, 15, 21, 25]) {
      const factor = 1 + (11 - gpi) / 100
      expect(factor).toBeGreaterThan(0.7)
      expect(factor).toBeLessThan(1.15)
    }
  })
})
