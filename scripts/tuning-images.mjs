/**
 * Готовит иллюстрации справочника по настройке из исходного PDF.
 *
 *   node scripts/tuning-images.mjs "C:/путь/Настройка рекурсивного лука.pdf"
 *
 * Что делает: вытаскивает JPEG-потоки (/DCTDecode) прямо из PDF без внешних
 * зависимостей, отбирает нужные по MANIFEST, ужимает и кладёт в public/tuning/.
 * Ужимать обязательно: оригиналы весят 3.5 МБ, а всё приложение целиком уходит
 * в офлайн-кэш сервис-воркера.
 *
 * Картинки, которых нет в MANIFEST, не переносятся сознательно — среди них
 * есть превью чужих роликов с YouTube.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'tuning')

/** Порядковый номер JPEG-потока в PDF -> имя файла на выходе. */
const MANIFEST = {
  1: 'cover',
  3: 'limb-bolts-1',
  4: 'limb-bolts-2',
  5: 'limb-projection',
  6: 'limb-result',
  7: 'brace-height',
  8: 'brace-groups',
  9: 'tiller-scheme',
  10: 'tiller-bolt',
  11: 'tiller-bolt-end',
  12: 'nocking-square',
  14: 'nockfit-hang',
  15: 'nockfit-hold',
  16: 'nockfit-drop',
  17: 'centershot-view',
  18: 'centershot-scheme',
}

const MAX_DIM = 1000
const QUALITY = 68

function extractJpegs(buf) {
  const out = []
  const needle = Buffer.from('/DCTDecode')
  let from = 0
  while (true) {
    const i = buf.indexOf(needle, from)
    if (i === -1) break
    from = i + 1
    const s = buf.indexOf(Buffer.from('stream'), i)
    if (s === -1) continue
    let start = s + 6
    if (buf[start] === 0x0d) start++
    if (buf[start] === 0x0a) start++
    const e = buf.indexOf(Buffer.from('endstream'), start)
    if (e === -1) continue
    let end = e
    while (end > start && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d)) end--
    const data = buf.subarray(start, end)
    if (data[0] === 0xff && data[1] === 0xd8) out.push(data)
  }
  return out
}

/** Усреднение по площади: для фотографий этого достаточно, зависимостей не нужно. */
function resize(src, w2, h2) {
  const { data, width: w1, height: h1 } = src
  const dst = Buffer.alloc(w2 * h2 * 4)
  for (let y = 0; y < h2; y++) {
    const sy0 = Math.floor((y * h1) / h2)
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h1) / h2))
    for (let x = 0; x < w2; x++) {
      const sx0 = Math.floor((x * w1) / w2)
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w1) / w2))
      let r = 0, g = 0, b = 0, n = 0
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * w1 + sx) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          n++
        }
      }
      const o = (y * w2 + x) * 4
      dst[o] = r / n
      dst[o + 1] = g / n
      dst[o + 2] = b / n
      dst[o + 3] = 255
    }
  }
  return { data: dst, width: w2, height: h2 }
}

const pdfPath = process.argv[2]
if (!pdfPath) {
  console.error('Укажи путь к PDF: node scripts/tuning-images.mjs "<файл>.pdf"')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
const jpegs = extractJpegs(readFileSync(pdfPath))
console.log(`найдено JPEG в PDF: ${jpegs.length}`)

let total = 0
for (const [indexStr, name] of Object.entries(MANIFEST)) {
  const raw = jpegs[Number(indexStr) - 1]
  if (!raw) {
    console.warn(`нет потока №${indexStr} (${name}) — пропущен`)
    continue
  }
  const img = jpeg.decode(raw, { useTArray: true })
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const resized = scale < 1 ? resize(img, w, h) : img
  const encoded = jpeg.encode(resized, QUALITY)
  const file = join(OUT, `${name}.jpg`)
  writeFileSync(file, encoded.data)
  total += encoded.data.length
  console.log(`${name}.jpg — ${w}×${h}, ${(encoded.data.length / 1024).toFixed(0)} КБ`)
}

console.log(`итого ${(total / 1024).toFixed(0)} КБ в public/tuning/`)
