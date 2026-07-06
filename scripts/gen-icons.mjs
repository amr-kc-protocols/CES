// Self-contained PWA icon generator — no native deps, no network.
// Draws a navy rounded tile with a red + white medical cross and writes PNGs
// using Node's built-in zlib. Produces the icon set referenced by the manifest.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public')
mkdirSync(OUT, { recursive: true })

// --- colors (RGBA) ---
const NAVY = [11, 46, 79, 255] // #0b2e4f
const RED = [225, 29, 46, 255] // #e11d2e
const WHITE = [255, 255, 255, 255]
const CLEAR = [0, 0, 0, 0]

// Alpha-composite src over dst.
function over(dst, src) {
  const sa = src[3] / 255
  if (sa === 0) return dst
  if (sa === 1) return src
  const da = dst[3] / 255
  const oa = sa + da * (1 - sa)
  const ch = (i) =>
    Math.round((src[i] * sa + dst[i] * da * (1 - sa)) / (oa || 1))
  return [ch(0), ch(1), ch(2), Math.round(oa * 255)]
}

// Coverage of a filled rounded rect at pixel (px,py) with 2x2 supersampling.
function roundedRectCoverage(px, py, x0, y0, x1, y1, r) {
  let hits = 0
  for (let sx = 0; sx < 2; sx++) {
    for (let sy = 0; sy < 2; sy++) {
      const x = px + 0.25 + sx * 0.5
      const y = py + 0.25 + sy * 0.5
      if (x < x0 || x > x1 || y < y0 || y > y1) continue
      // corner circles
      const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
      const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r) hits++
    }
  }
  return hits / 4
}

function drawIcon(size, { maskable = false } = {}) {
  const px = new Array(size * size)
  const S = size
  // Background: full-bleed for maskable, rounded tile otherwise.
  const bgRadius = maskable ? 0 : Math.round(S * 0.18)
  // Cross geometry. Keep within the maskable safe zone (center ~72%).
  const scale = maskable ? 0.62 : 0.72
  const c = S / 2
  const armLen = (S * scale) / 2 // half-length of each arm
  const redThick = S * scale * 0.34
  const whiteThick = redThick * 0.5

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let color = CLEAR
      // background tile
      const bgCov = roundedRectCoverage(x, y, 0, 0, S, S, bgRadius)
      if (bgCov > 0) color = over(color, [NAVY[0], NAVY[1], NAVY[2], Math.round(255 * bgCov)])

      // red cross (vertical + horizontal bar)
      const redV = roundedRectCoverage(x, y, c - redThick / 2, c - armLen, c + redThick / 2, c + armLen, redThick * 0.28)
      const redH = roundedRectCoverage(x, y, c - armLen, c - redThick / 2, c + armLen, c + redThick / 2, redThick * 0.28)
      const redCov = Math.max(redV, redH)
      if (redCov > 0) color = over(color, [RED[0], RED[1], RED[2], Math.round(255 * redCov)])

      // white inner cross
      const wV = roundedRectCoverage(x, y, c - whiteThick / 2, c - armLen * 0.66, c + whiteThick / 2, c + armLen * 0.66, whiteThick * 0.25)
      const wH = roundedRectCoverage(x, y, c - armLen * 0.66, c - whiteThick / 2, c + armLen * 0.66, c + whiteThick / 2, whiteThick * 0.25)
      const wCov = Math.max(wV, wH)
      if (wCov > 0) color = over(color, [WHITE[0], WHITE[1], WHITE[2], Math.round(255 * wCov)])

      px[y * S + x] = color
    }
  }
  return px
}

// --- minimal PNG encoder (RGBA, 8-bit) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
function encodePNG(pixels, size) {
  const S = size
  const raw = Buffer.alloc(S * (S * 4 + 1))
  let o = 0
  for (let y = 0; y < S; y++) {
    raw[o++] = 0 // filter: none
    for (let x = 0; x < S; x++) {
      const p = pixels[y * S + x]
      raw[o++] = p[0]
      raw[o++] = p[1]
      raw[o++] = p[2]
      raw[o++] = p[3]
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  { file: 'pwa-64x64.png', size: 64 },
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'apple-touch-icon-180x180.png', size: 180 },
  { file: 'maskable-icon-512x512.png', size: 512, maskable: true },
]

for (const t of targets) {
  const pixels = drawIcon(t.size, { maskable: t.maskable })
  writeFileSync(join(OUT, t.file), encodePNG(pixels, t.size))
  console.log('wrote', t.file)
}
console.log('icons generated in public/')
