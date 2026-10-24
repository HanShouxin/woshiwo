/**
 * 生成应用图标：256px PNG + 内嵌 PNG 的 ICO。
 * 图形与侧边栏品牌印记一致：一点在上，两道潮纹在下。
 * 运行：node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'build')

const SIZE = 256
const SS = 4 // 超采样倍数
const N = SIZE * SS

const BG = [0xfb, 0xfa, 0xf8]
const INK = [0x1d, 0x1d, 0x1f]

const buf = new Uint8Array(N * N * 4)

function put(x, y, rgb) {
  if (x < 0 || y < 0 || x >= N || y >= N) return
  const i = (y * N + x) * 4
  buf[i] = rgb[0]
  buf[i + 1] = rgb[1]
  buf[i + 2] = rgb[2]
  buf[i + 3] = 255
}

/** 圆角矩形（含内部） */
function roundRect(x0, y0, x1, y1, radius, rgb) {
  for (let y = Math.floor(y0); y < y1; y += 1) {
    for (let x = Math.floor(x0); x < x1; x += 1) {
      let inside = true
      const corners = [
        [x0 + radius, y0 + radius],
        [x1 - radius, y0 + radius],
        [x0 + radius, y1 - radius],
        [x1 - radius, y1 - radius]
      ]
      if (x < x0 + radius && y < y0 + radius) inside = dist2(x, y, corners[0]) <= radius * radius
      else if (x > x1 - radius && y < y0 + radius) inside = dist2(x, y, corners[1]) <= radius * radius
      else if (x < x0 + radius && y > y1 - radius) inside = dist2(x, y, corners[2]) <= radius * radius
      else if (x > x1 - radius && y > y1 - radius) inside = dist2(x, y, corners[3]) <= radius * radius
      if (inside) put(x, y, rgb)
    }
  }
}

function dist2(x, y, [cx, cy]) {
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy
}

function disc(cx, cy, radius, rgb) {
  const r2 = radius * radius
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
      if (dist2(x, y, [cx, cy]) <= r2) put(x, y, rgb)
    }
  }
}

/** 三次贝塞尔粗线：沿曲线密集撒圆盘 */
function strokeBezier(p0, p1, p2, p3, width, rgb) {
  const steps = 2400
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const mt = 1 - t
    const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0]
    const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
    disc(x, y, width / 2, rgb)
  }
}

const s = (v) => v * SS

// 背景：暖白圆角块
roundRect(s(4), s(4), s(252), s(252), s(56), BG)

// 上方一点
disc(s(128), s(92), s(18), INK)

// 第一道潮
strokeBezier([s(50), s(152)], [s(72), s(122)], [s(104), s(122)], [s(128), s(152)], s(13), INK)
strokeBezier([s(128), s(152)], [s(152), s(182)], [s(184), s(182)], [s(206), s(152)], s(13), INK)

// 第二道潮（细）
strokeBezier([s(74), s(200)], [s(88), s(182)], [s(108), s(182)], [s(124), s(200)], s(9), INK)
strokeBezier([s(124), s(200)], [s(140), s(218)], [s(160), s(218)], [s(176), s(200)], s(9), INK)

// 缩采样到 256
const rgba = new Uint8Array(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const i = ((y * SS + sy) * N + (x * SS + sx)) * 4
        r += buf[i]
        g += buf[i + 1]
        b += buf[i + 2]
        a += buf[i + 3]
      }
    }
    const count = SS * SS
    const o = (y * SIZE + x) * 4
    rgba[o] = Math.round(r / count)
    rgba[o + 1] = Math.round(g / count)
    rgba[o + 2] = Math.round(b / count)
    rgba[o + 3] = Math.round(a / count)
  }
}

/* ---------- PNG 编码 ---------- */

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filter: none
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const png = encodePng(SIZE, SIZE, rgba)

/* ---------- ICO（内嵌 PNG，Vista+） ---------- */

function encodeIco(pngBuffer) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // count

  const entry = Buffer.alloc(16)
  entry[0] = 0 // width 256
  entry[1] = 0 // height 256
  entry[2] = 0 // palette
  entry[3] = 0 // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bpp
  entry.writeUInt32LE(pngBuffer.length, 8)
  entry.writeUInt32LE(22, 12) // data offset

  return Buffer.concat([header, entry, pngBuffer])
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'icon.png'), png)
writeFileSync(join(OUT, 'icon.ico'), encodeIco(png))

console.log(`icon.png ${png.length} bytes`)
console.log(`icon.ico done`)
