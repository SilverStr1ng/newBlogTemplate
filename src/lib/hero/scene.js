/** Shared, renderer-independent scene. All times are seconds; geometry is in CSS pixels. */
export const SETTINGS = Object.freeze({ hold: 12, morph: 1.8, cooldown: 4, strokeLife: 4.5, maxStrokes: 64 });
export const PRESETS = Object.freeze(['开径 / APERTURE', '折返 / PASSAGE', '回廊 / CHAMBER', '交汇 / CONFLUENCE']);
export const PALETTE = Object.freeze(['#58edb4', '#bb96ff', '#63dfff', '#ffad80']);
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smooth = (x) => { const t = clamp(x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// The permanent scaffold gives visitors a spatial reference. Only four gates move.
const scaffold = [
  [-.42, -.34, -.12, -.34], [-.42, -.34, -.42, -.08],
  [.02, -.42, .35, -.42], [.35, -.42, .35, -.20],
  [.44, -.10, .44, .34], [.44, .34, .18, .34],
  [.04, .42, -.32, .42], [-.32, .42, -.32, .21],
  [-.20, -.20, -.04, -.20], [.09, -.20, .20, -.20],
  [.20, -.20, .20, -.06], [.20, .08, .20, .20],
  [.20, .20, .02, .20], [-.12, .20, -.20, .20],
  [-.20, .20, -.20, .06], [-.20, -.06, -.20, -.20],
];
// [center x, center y, angle, length]. Adjacent presets change only two gates.
const gatePoses = [
  [[.065,-.20,0,.12], [.065,-.20,0,.12], [.015,-.20,0,.12], [.015,-.20,0,.12]],
  [[.20,.01,Math.PI/2,.07], [.20,.01,Math.PI/2,.15], [.20,.01,Math.PI/2,.15], [.20,.01,Math.PI/2,.07]],
  [[-.05,.20,0,.15], [-.10,.28,0,.15], [-.10,.28,0,.15], [-.05,.20,0,.15]],
  [[-.29,-.06,Math.PI/2,.20], [-.29,-.06,Math.PI/2,.20], [-.29,-.06,0,.20], [-.29,-.06,0,.20]],
];

export class Timeline {
  constructor() { this.preset = 0; this.target = 0; this.phase = 'hold'; this.elapsed = 0; this.cooldown = 0; this.interacting = false; this.paused = false; this.reduced = false; }
  get progress() { return this.phase === 'morph' ? clamp(this.elapsed / SETTINGS.morph) : 1; }
  get remaining() { return this.phase === 'hold' ? Math.max(0, SETTINGS.hold - this.elapsed) : 0; }
  beginInteraction() { this.interacting = true; this.cooldown = SETTINGS.cooldown; }
  endInteraction() { this.interacting = false; this.cooldown = SETTINGS.cooldown; }
  next() {
    if (this.interacting) return false;
    if (this.phase === 'morph') {
      if (!this.paused && !this.reduced) return false;
      this.preset = this.target; this.phase = 'hold'; this.elapsed = this.cooldown = 0; return true;
    }
    this.target = (this.preset + 1) % PRESETS.length;
    this.elapsed = 0; this.cooldown = 0;
    if (this.paused || this.reduced) { this.preset = this.target; this.phase = 'hold'; }
    else this.phase = 'morph';
    return true;
  }
  reset() { this.preset = this.target = 0; this.phase = 'hold'; this.elapsed = this.cooldown = 0; this.interacting = false; }
  step(seconds) {
    // A suspended tab never contributes time. Callers reset their wall clock on resume.
    if (!Number.isFinite(seconds) || seconds <= 0 || this.paused || this.reduced || this.interacting) return false;
    let dt = Math.min(seconds, .25);
    if (this.cooldown > 0) { const used = Math.min(dt, this.cooldown); this.cooldown -= used; dt -= used; }
    if (!dt) return false;
    let changed = this.phase === 'morph';
    this.elapsed += dt;
    if (this.phase === 'hold' && this.elapsed >= SETTINGS.hold) {
      const rest = this.elapsed - SETTINGS.hold;
      this.next(); this.elapsed = rest; changed = true;
    } else if (this.phase === 'morph' && this.elapsed >= SETTINGS.morph) {
      this.elapsed -= SETTINGS.morph; this.preset = this.target; this.phase = 'hold'; changed = true;
    }
    return changed;
  }
}

export class StrokeBuffer {
  constructor() { this.items = []; this.colorIndex = -1; }
  begin() { this.colorIndex = (this.colorIndex + 1) % PALETTE.length; }
  add(x0, y0, x1, y1) {
    if (![x0, y0, x1, y1].every(Number.isFinite)) return;
    this.items.push({ x0: clamp(x0), y0: clamp(y0), x1: clamp(x1), y1: clamp(y1), color: PALETTE[Math.max(0, this.colorIndex)], life: SETTINGS.strokeLife });
    if (this.items.length > SETTINGS.maxStrokes) this.items.shift();
  }
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || !this.items.length) return false;
    for (const stroke of this.items) stroke.life -= dt;
    this.items = this.items.filter((stroke) => stroke.life > 0);
    return true;
  }
  clear() { this.items.length = 0; }
}

export function layout(width, height) {
  const compact = width < 900;
  return { width, height, cx: width * (compact ? .52 : .75), cy: height * (compact ? .64 : .47), scale: Math.min(width * (compact ? .88 : .46), height * (compact ? .49 : .86)) };
}

export function wallSegments(timeline) {
  const segments = scaffold.map((p) => ({ x0: p[0], y0: p[1], x1: p[2], y1: p[3], moving: false }));
  gatePoses.forEach((poses, index) => {
    const a = poses[timeline.preset], b = poses[timeline.target];
    const t = timeline.phase === 'morph' ? smooth((timeline.progress - index * .055) / .835) : 1;
    const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
    const angle = angleLerp(a[2], b[2], t), half = lerp(a[3], b[3], t) / 2;
    const dx = Math.cos(angle) * half, dy = Math.sin(angle) * half;
    segments.push({ x0: x - dx, y0: y - dy, x1: x + dx, y1: y + dy, moving: timeline.phase === 'morph' && a.some((v, i) => v !== b[i]) });
  });
  return segments;
}

export function distanceToSegment(x, y, s) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  const t = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / Math.max(dx * dx + dy * dy, 1e-12));
  return Math.hypot(x - s.x0 - t * dx, y - s.y0 - t * dy);
}

export function rgb(hex) { return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255); }

export function buildScene(view, timeline, strokes) {
  const { cx, cy, scale, width, height } = view;
  const walls = wallSegments(timeline).map((s) => ({ ...s, x0: cx + s.x0 * scale, y0: cy + s.y0 * scale, x1: cx + s.x1 * scale, y1: cy + s.y1 * scale, radius: Math.max(2.6, scale * .006), color: [0, 0, 0] }));
  const light = (x0, y0, x1, y1, color, radius = 2.4) => ({ x0: cx + x0 * scale, y0: cy + y0 * scale, x1: cx + x1 * scale, y1: cy + y1 * scale, radius, color: rgb(color) });
  const lights = [
    light(-.40, .04, -.40, .20, '#58edb4'),
    light(.29, -.30, .29, -.14, '#bb96ff'),
    // This emissive core lights the 2D field; the faceted model above it is decorative, not a refractive solver.
    light(0, 0, 0, 0, '#b7ebff', Math.max(5, scale * .025)),
    ...strokes.items.map((s) => ({ x0: s.x0 * width, y0: s.y0 * height, x1: s.x1 * width, y1: s.y1 * height, radius: 2.5, color: rgb(s.color).map((v) => v * smooth(s.life / SETTINGS.strokeLife)) })),
  ];
  return { view, walls, lights, shapes: [...walls, ...lights] };
}

/** Bound GPU memory and preserve the constant-size direction-first cascade atlases. */
export function fieldSize(width, height) {
  const factor = Math.min(.65, 512 / Math.max(1, width), 320 / Math.max(1, height));
  return { width: Math.max(32, Math.ceil(width * factor / 32) * 32), height: Math.max(32, Math.ceil(height * factor / 32) * 32) };
}

export function cascadeConfig(level) {
  return { spacing: 2 ** (level + 1), side: 2 ** (level + 1), start: 4 * (4 ** level - 1) / 3, end: 4 * (4 ** (level + 1) - 1) / 3 };
}
