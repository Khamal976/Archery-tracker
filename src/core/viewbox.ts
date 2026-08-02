import type { Point, TargetFace } from './types'

/**
 * Единственное место, где живёт разница систем координат.
 * Модель: +y вверх (взгляд стрелка на мишень). SVG: +y вниз.
 * Всё остальное приложение работает только в модельных координатах.
 */

export function modelToSvg(p: Point): Point {
  return { x: p.x, y: -p.y }
}

export function svgToModel(p: Point): Point {
  return { x: p.x, y: -p.y }
}

/** Точка указателя в модельных координатах фейса (мм). null — если матрица недоступна. */
export function clientToModel(svg: SVGSVGElement, clientX: number, clientY: number): Point | null {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: pt.x, y: -pt.y }
}

/** viewBox фейса в миллиметрах с запасом по краям. */
export function faceViewBox(face: TargetFace, paddingMm = 0): string {
  const w = face.widthMm + paddingMm * 2
  const h = face.heightMm + paddingMm * 2
  return `${-w / 2} ${-h / 2} ${w} ${h}`
}
