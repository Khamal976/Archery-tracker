// Иконки PWA генерируются кодом, чтобы в репозитории не лежали бинарники
// непонятного происхождения: npm run icons.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // бит на канал
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // фильтр None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

const BG = hex('#12100e')
const BANDS = [
  [0.16, hex('#d9bf42')], // жёлтое
  [0.32, hex('#d9bf42')],
  [0.5, hex('#bd4634')], // красное
  [0.68, hex('#4a7d96')], // синее
  [0.86, hex('#cdc7bc')], // белое поле, приглушённое
]

/** @param {number} size @param {number} scale доля холста под мишень */
function drawTarget(size, scale) {
  const rgba = Buffer.alloc(size * size * 4)
  const c = size / 2
  const rMax = (size / 2) * scale
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / rMax
      let color = BG
      for (const [edge, rgb] of BANDS) {
        if (d <= edge) {
          color = rgb
          break
        }
      }
      // Тонкие разделительные линии между зонами.
      for (const [edge] of BANDS) {
        if (Math.abs(d - edge) < 0.012) color = hex('#14131a')
      }
      const i = (y * size + x) * 4
      rgba[i] = color[0]
      rgba[i + 1] = color[1]
      rgba[i + 2] = color[2]
      rgba[i + 3] = 255
    }
  }
  return rgba
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'icon-192.png'), png(192, 192, drawTarget(192, 0.88)))
writeFileSync(join(OUT, 'icon-512.png'), png(512, 512, drawTarget(512, 0.88)))
// Маскируемая: мишень внутри безопасной зоны, обрезка углов ничего не съест.
writeFileSync(join(OUT, 'icon-maskable-512.png'), png(512, 512, drawTarget(512, 0.62)))

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#12100e"/>
  <circle cx="32" cy="32" r="26" fill="#cdc7bc"/>
  <circle cx="32" cy="32" r="20" fill="#4a7d96"/>
  <circle cx="32" cy="32" r="14" fill="#bd4634"/>
  <circle cx="32" cy="32" r="8" fill="#d9bf42"/>
  <circle cx="32" cy="32" r="2.5" fill="#14131a"/>
</svg>
`
writeFileSync(join(OUT, 'favicon.svg'), favicon)

console.log('иконки записаны в public/')
