// A fighter jet flown while the model thinks hard (effort high and above). Side view of a small 3D model: the wings,
// tail and canopy are rolled about the jet's long axis and projected each frame, so banks and rolls show the wings
// tilting. Pure SMIL, precomputed here: the desktop Svg element runs it without scripts.

export type JetLevel = 'high' | 'xhigh' | 'max'

type Pace = { period: number; wind: number; flame: number; color: string; lines: number; shock: boolean }

// Higher effort: a shorter maneuver cycle, faster wind, a longer and hotter flame.
export const PACE: Record<JetLevel, Pace> = {
  high: { period: 7.2, wind: 1.3, flame: 5, color: '#EF9F27', lines: 3, shock: false },
  xhigh: { period: 6, wind: 0.8, flame: 8, color: '#E24B4A', lines: 5, shock: false },
  max: { period: 4.8, wind: 0.45, flame: 11, color: '#7F77DD', lines: 8, shock: true },
}

// The effort turn.step reports: a level, or an integer budget (no jet for those).
export const jetLevel = (effort: unknown): JetLevel | null =>
  effort === 'high' || effort === 'xhigh' || effort === 'max' ? effort : null

type P3 = readonly [number, number, number]
type Frame = { phi: number; dx: number; dy: number; pitch: number }

const FRAMES = 96
const BANK = 24
const ELEV = (14 * Math.PI) / 180 // the camera looks down a little, so level flight shows the near wing's top
const WIND = '#888780'
const GREY = '#9AA5B4'
const CAM = { y: -Math.sin(ELEV), z: Math.cos(ELEV) }
const LIGHT = (() => {
  const m = Math.hypot(0.75, 0.66)
  return { y: -0.75 / m, z: 0.66 / m }
})()

// Body frame: x forward, y down, z toward the viewer.
const FUSELAGE =
  'M15,0.4 C12,-0.6 9,-1.6 6,-2.0 L-2,-2.3 C-6,-2.4 -9,-2.2 -12,-1.9 L-13.2,-1.6 L-13.2,1.6 L-10,2.2 C-4,2.6 2,2.6 6,2.2 C9,1.9 12,1.2 15,0.4 Z'
const WING: P3[] = [[7.5, 0.6, 1.4], [2, 0.6, 2.6], [-5.5, 0.6, 8.6], [-8.6, 0.6, 8.6], [-9, 0.6, 2.0]]
const STAB: P3[] = [[-10, 0.4, 1.6], [-12.4, 0.4, 5.6], [-14.2, 0.4, 5.6], [-13.6, 0.4, 1.5]]
const FIN: P3[] = [[-6, -2.2, 0], [-10.8, -8.3, 0], [-12.8, -8.3, 0], [-12.6, -1.9, 0]]
const FLASH: P3[] = [[-9.78, -7, 0], [-10.8, -8.3, 0], [-12.8, -8.3, 0], [-12.76, -7, 0]]
const MISSILE: P3[] = [[-3.6, 0.6, 9.0], [-9.6, 0.6, 9.0]]
const UP: P3 = [0, -1, 0]
const SIDE: P3 = [0, 0, 1]

const mirror = (ps: P3[]): P3[] => ps.map(([x, y, z]) => [x, y, -z] as const)
const n2 = (n: number): string => String(Number(n.toFixed(2)))

const roll = (y: number, z: number, phi: number) => {
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  return { y: y * c - z * s, z: y * s + z * c }
}

const project = ([x, y, z]: P3, phi: number) => {
  const r = roll(y, z, phi)
  return { x, y: r.y * Math.cos(ELEV) + r.z * Math.sin(ELEV), depth: r.z * Math.cos(ELEV) - r.y * Math.sin(ELEV) }
}

const shade = (hex: string, b: number): string => {
  const n = parseInt(hex.slice(1), 16)
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => Math.min(255, Math.round(v * b)).toString(16).padStart(2, '0'))
    .join('')}`
}

const ease = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2

// One cycle: bank right, level, bank left, level, then a full roll while climbing a little (a corkscrew).
const KEYS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0.12, BANK], [0.24, BANK], [0.36, 0], [0.48, -BANK], [0.6, -BANK], [0.7, 0], [0.72, 0], [0.9, 360], [1, 360],
]

const rollAt = (u: number): number => {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [a, from] = KEYS[i]
    const [b, to] = KEYS[i + 1]
    if (u <= b) return from + (to - from) * ease((u - a) / (b - a))
  }
  return 0
}

const frames = (): Frame[] =>
  Array.from({ length: FRAMES + 1 }, (_, i) => {
    const u = i / FRAMES
    let dy = -2.5 * Math.sin(4 * Math.PI * u)
    let dx = 0
    let pitch = -3 * Math.cos(4 * Math.PI * u)
    if (u > 0.72 && u < 0.9) {
      const g = (u - 0.72) / 0.18
      dy += -6 * Math.sin(Math.PI * g)
      dx += 3 * Math.sin(2 * Math.PI * g)
      pitch += -9 * Math.sin(2 * Math.PI * g)
    }
    return { phi: (rollAt(u) * Math.PI) / 180, dx, dy, pitch }
  })

const animate = (attr: string, values: string[], period: number, extra = ''): string =>
  `<animate attributeName="${attr}" values="${values.join(';')}" dur="${period}s" repeatCount="indefinite"${extra}/>`

const DISCRETE = ' calcMode="discrete"'

// A flat part drawn twice: behind the fuselage always, and in front of it (a <use>) while it faces the viewer.
const part = (id: string, pts: P3[], normal: P3 | null, base: string, fs: Frame[], period: number, stroke?: number) => {
  const shots = fs.map(f => {
    const q = pts.map(p => project(p, f.phi))
    const d = stroke
      ? `M${n2(q[0].x)},${n2(q[0].y)} L${n2(q[1].x)},${n2(q[1].y)}`
      : `M${q.map(p => `${n2(p.x)},${n2(p.y)}`).join(' L')} Z`
    const depth = q.reduce((a, p) => a + p.depth, 0) / q.length
    let color = base
    if (normal) {
      let n = roll(normal[1], normal[2], f.phi)
      if (n.y * CAM.y + n.z * CAM.z < 0) n = { y: -n.y, z: -n.z }
      color = shade(base, 0.55 + 0.6 * Math.max(0, n.y * LIGHT.y + n.z * LIGHT.z))
    }
    return { d, depth, color }
  })
  const paint = stroke ? 'stroke' : 'fill'
  const extra = stroke ? ` fill="none" stroke-width="${stroke}" stroke-linecap="round"` : ''
  return {
    back:
      `<path id="${id}" d="${shots[0].d}" ${paint}="${shots[0].color}"${extra}>` +
      animate('d', shots.map(s => s.d), period) +
      (normal ? animate(paint, shots.map(s => s.color), period) : '') +
      '</path>',
    front: `<use href="#${id}" opacity="0">${animate('opacity', shots.map(s => (s.depth > 0 ? '1' : '0')), period, DISCRETE)}</use>`,
  }
}

const flame = (pace: Pace): string => {
  const x = -15.4
  const shape = (len: number, h: number) =>
    `M${x},${n2(-h + 0.05)} Q${n2(x - len * 0.45)},${n2(-h)} ${n2(x - len)},0.05 Q${n2(x - len * 0.45)},${n2(h + 0.1)} ${x},${n2(h + 0.05)} Z`
  const layer = (len: number, h: number, fill: string, opacity: number) => {
    const a = shape(len, h)
    const b = shape(len * 0.78, h)
    return `<path d="${a}" fill="${fill}" opacity="${opacity}"><animate attributeName="d" values="${a};${b};${a}" dur="0.16s" repeatCount="indefinite"/></path>`
  }
  let s = layer(pace.flame * 1.35, 1.25, pace.color, 0.3) + layer(pace.flame, 0.95, pace.color, 0.9) + layer(pace.flame * 0.45, 0.55, '#FFF4D6', 0.95)
  // Shock diamonds in the plume at max.
  if (pace.shock) {
    for (const at of [0.35, 0.62]) {
      const cx = x - pace.flame * at
      s += `<path d="M${n2(cx + 0.5)},0.05 L${n2(cx)},-0.4 L${n2(cx - 0.5)},0.05 L${n2(cx)},0.5 Z" fill="#FFFFFF"><animate attributeName="opacity" values="0.9;0.35;0.9" dur="0.2s" repeatCount="indefinite"/></path>`
    }
  }
  return s
}

const jet = (pace: Pace, k: string): { defs: string; body: string } => {
  const T = pace.period
  const fs = frames()
  const wingFar = part(`${k}wf`, mirror(WING), UP, GREY, fs, T)
  const stabFar = part(`${k}sf`, mirror(STAB), UP, GREY, fs, T)
  const missileFar = part(`${k}mf`, mirror(MISSILE), null, '#E6EAF0', fs, T, 0.85)
  const wingNear = part(`${k}wn`, WING, UP, GREY, fs, T)
  const stabNear = part(`${k}sn`, STAB, UP, GREY, fs, T)
  const missileNear = part(`${k}mn`, MISSILE, null, '#E6EAF0', fs, T, 0.85)
  const fin = part(`${k}fn`, FIN, SIDE, '#97A2B1', fs, T)
  const flash = part(`${k}fl`, FLASH, SIDE, pace.color, fs, T)
  // The canopy is a dome on the spine: moved to its rolled place and squashed (flipped under) by cos(roll).
  const base = fs.map(f => project([3.2, -2.0, 0], f.phi))
  const top = fs.map(f => project([3.2, -2.3, 0], f.phi))
  const dome =
    `<g id="${k}cd"><animateTransform attributeName="transform" type="translate" values="${base.map(q => `${n2(q.x)} ${n2(q.y)}`).join(';')}" dur="${T}s" repeatCount="indefinite"/>` +
    `<g><animateTransform attributeName="transform" type="scale" values="${fs.map(f => `1 ${n2(Math.cos(f.phi))}`).join(';')}" dur="${T}s" repeatCount="indefinite"/>` +
    `<path d="M4.4,0 C3.6,-1.3 2.2,-2.1 0.4,-2.1 C-1.8,-2.1 -3.4,-1.1 -4.6,0 Z" fill="url(#${k}gg)"/>` +
    '<path d="M2.6,-1.55 C1.6,-1.85 0,-1.9 -1.4,-1.6" fill="none" stroke="#FFFFFF" stroke-width="0.35" stroke-linecap="round" opacity="0.75"/>' +
    '<path d="M1.6,-1.95 L2.1,-0.2" stroke="#1B2B3D" stroke-width="0.16" opacity="0.7"/></g></g>'
  const domeFront = `<use href="#${k}cd" opacity="0">${animate('opacity', base.map(q => (q.depth > -0.2 ? '1' : '0')), T, DISCRETE)}</use>`
  // Seen from above (rolled toward the viewer) the canopy reads as an oval on the fuselage.
  const oval =
    `<ellipse cx="3.2" cy="${n2(top[0].y)}" rx="4.1" ry="1.25" fill="url(#${k}gg)" opacity="0">` +
    animate('cy', top.map(q => n2(q.y)), T) +
    animate('opacity', fs.map(f => n2(Math.max(0, -Math.sin(f.phi)) ** 1.5)), T) +
    '</ellipse>'
  const fuselage =
    `<path d="${FUSELAGE}" fill="url(#${k}fg)"/>` +
    `<g clip-path="url(#${k}cp)"><rect x="11.4" y="-4" width="6" height="8" fill="#5B6573"/>` +
    '<path d="M-4,-1.9 C0,-1.3 6,-1.1 11,-1.0" fill="none" stroke="#FFFFFF" stroke-width="0.4" opacity="0.35"/></g>' +
    `<path d="${FUSELAGE}" fill="none" stroke="#3E4652" stroke-width="0.3" stroke-opacity="0.6"/>` +
    '<line x1="15" y1="0.4" x2="17.2" y2="0.4" stroke="#5B6573" stroke-width="0.3"/>' +
    '<path d="M-13.2,-1.6 L-15.4,-1.25 L-15.4,1.35 L-13.2,1.6 Z" fill="#454C57"/>' +
    '<line x1="-14.1" y1="-1.42" x2="-14.1" y2="1.48" stroke="#6B7480" stroke-width="0.25"/>' +
    '<line x1="-13.2" y1="-1.6" x2="-13.2" y2="1.6" stroke="#2F343C" stroke-width="0.35"/>'
  const defs =
    `<linearGradient id="${k}fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE2EA"/><stop offset="0.3" stop-color="#B3BDCA"/><stop offset="0.7" stop-color="#848FA0"/><stop offset="1" stop-color="#5E6878"/></linearGradient>` +
    `<linearGradient id="${k}gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E2A47"/><stop offset="0.55" stop-color="#2C6E9E"/><stop offset="1" stop-color="#6FB3DB"/></linearGradient>` +
    `<clipPath id="${k}cp"><path d="${FUSELAGE}"/></clipPath>`
  const back = [wingFar, missileFar, stabFar, fin, flash, wingNear, missileNear, stabNear].map(p => p.back).join('')
  const front = [fin, flash, stabFar, wingFar, missileFar, stabNear, wingNear, missileNear].map(p => p.front).join('')
  const body =
    `<g><animateTransform attributeName="transform" type="translate" values="${fs.map(f => `${n2(f.dx)},${n2(f.dy)}`).join(';')}" dur="${T}s" repeatCount="indefinite"/>` +
    `<g><animateTransform attributeName="transform" type="rotate" values="${fs.map(f => n2(f.pitch)).join(';')}" dur="${T}s" repeatCount="indefinite"/>` +
    `${flame(pace)}${back}${dome}${fuselage}${front}${domeFront}${oval}</g></g>`
  return { defs, body }
}

// Speed lines streaming past: faster wind, more lines at higher effort. The wind moves at the same speed relative to
// the jet's size on every strip (pace.wind is the time to cross WIND_REF pixels at scale 1.25), so neither the band
// nor the larger pane looks slower than the other.
const WIND_REF = 340
const WIND_SCALE = 1.25
const wind = (pace: Pace, width: number, height: number, scale: number): string => {
  const dur = Number(Math.max(0.15, (pace.wind * (width + 40) * WIND_SCALE) / (WIND_REF * scale)).toFixed(2))
  let s = ''
  for (let i = 0; i < pace.lines; i++) {
    const y = 6 + ((i * 37) % Math.max(1, height - 10))
    const len = 10 + ((i * 7) % 14)
    const delay = -((i * dur) / pace.lines)
    s +=
      `<line x1="0" y1="${y}" x2="${len}" y2="${y}" stroke="${WIND}" stroke-width="1" stroke-linecap="round" opacity="0.45">` +
      `<animateTransform attributeName="transform" type="translate" values="${width + 10},0;-30,0" dur="${dur}s" begin="${delay.toFixed(2)}s" repeatCount="indefinite"/></line>`
  }
  return s
}

const cache = new Map<string, string>()

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// The whole strip: wind and the jet centered. Memoized: the frames are the same on every draw.
export const jetStrip = (level: JetLevel, width: number, height: number, scale: number, title: string, id = 'jet'): string => {
  const key = `${level}|${width}|${height}|${scale}|${title}|${id}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const pace = PACE[level]
  const { defs, body } = jet(pace, id)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<title>${escape(title)}</title><defs>${defs}</defs>${wind(pace, width, height, scale)}` +
    `<g transform="translate(${n2(width / 2 + 6)},${n2(height / 2 + 2)}) scale(${scale})">${body}</g></svg>`
  if (cache.size > 24) cache.clear()
  cache.set(key, svg)
  return svg
}
