// 契约 mock 用的媒体字节：运行时生成 PNG / WAV，不往仓库里放二进制文件。
// 图片只用 PNG（SRS BR-MEDIA-002 不支持 SVG），音频用 WAV（BR-MEDIA-005 白名单内）。
import { deflateSync } from 'node:zlib'

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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/** 封面：双色斜向渐变 + 柔光圆 + 几条「代码行」 */
export function makeCoverPng(seed, from, to, w = 960, h = 540) {
  const a = hex(from)
  const b = hex(to)
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const circles = Array.from({ length: 7 }, () => ({ x: rnd() * w, y: rnd() * h, r: 40 + rnd() * 140 }))
  const bars = Array.from({ length: 6 }, (_, i) => ({ y: 120 + i * 46, x: 120, len: 160 + rnd() * 360 }))
  const raw = Buffer.alloc((w * 3 + 1) * h)
  let o = 0
  for (let y = 0; y < h; y++) {
    raw[o++] = 0
    for (let x = 0; x < w; x++) {
      const t = (x / w) * 0.6 + (y / h) * 0.4
      let r = a[0] + (b[0] - a[0]) * t
      let g = a[1] + (b[1] - a[1]) * t
      let bl = a[2] + (b[2] - a[2]) * t
      let light = 0
      for (const c of circles) {
        const d = Math.hypot(x - c.x, y - c.y)
        if (d < c.r) light += 0.1 * (1 - d / c.r)
      }
      for (const bar of bars) {
        if (y >= bar.y && y < bar.y + 10 && x >= bar.x && x < bar.x + bar.len) light += 0.22
      }
      r += (255 - r) * light
      g += (255 - g) * light
      bl += (255 - bl) * light
      raw[o++] = r
      raw[o++] = g
      raw[o++] = bl
    }
  }
  return encodePng(w, h, raw)
}

/** 正文示意图：浅底 + 三个方框 + 连线 */
export function makeDiagramPng(w = 1200, h = 420) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  const boxes = [
    { x: 80, y: 140, w: 260, h: 140, c: [79, 70, 229] },
    { x: 470, y: 140, w: 260, h: 140, c: [194, 65, 12] },
    { x: 860, y: 140, w: 260, h: 140, c: [5, 150, 105] },
  ]
  let o = 0
  for (let y = 0; y < h; y++) {
    raw[o++] = 0
    for (let x = 0; x < w; x++) {
      let px = [250, 248, 244]
      if ((x + y) % 24 === 0) px = [238, 233, 222]
      if (y >= 206 && y < 214 && ((x > 340 && x < 470) || (x > 730 && x < 860))) px = [120, 113, 100]
      for (const bx of boxes) {
        const inside = x >= bx.x && x < bx.x + bx.w && y >= bx.y && y < bx.y + bx.h
        const border = inside && (x < bx.x + 6 || x >= bx.x + bx.w - 6 || y < bx.y + 6 || y >= bx.y + bx.h - 6)
        if (border) px = bx.c
        else if (inside) px = bx.c.map((v) => v + (255 - v) * 0.85)
      }
      raw[o++] = px[0]
      raw[o++] = px[1]
      raw[o++] = px[2]
    }
  }
  return encodePng(w, h, raw)
}

function encodePng(w, h, raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 音频：几秒的和弦正弦波，带淡入淡出 */
export function makeWav(seconds = 8, rate = 22050) {
  const n = seconds * rate
  const data = Buffer.alloc(n * 2)
  const freqs = [261.63, 329.63, 392.0]
  for (let i = 0; i < n; i++) {
    const t = i / rate
    const env = Math.min(1, t / 0.5, (seconds - t) / 0.8)
    let v = 0
    for (const f of freqs) v += Math.sin(2 * Math.PI * f * t)
    data.writeInt16LE(Math.round((v / freqs.length) * env * 0.35 * 32767), i * 2)
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + data.length, 4)
  head.write('WAVE', 8)
  head.write('fmt ', 12)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(rate, 24)
  head.writeUInt32LE(rate * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36)
  head.writeUInt32LE(data.length, 40)
  return Buffer.concat([head, data])
}
