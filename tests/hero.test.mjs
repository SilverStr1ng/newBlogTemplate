import test from 'node:test';
import assert from 'node:assert/strict';
import { Timeline, StrokeBuffer, SETTINGS, wallSegments, layout, buildScene, fieldSize, cascadeConfig, distanceToSegment, angleLerp } from '../src/lib/hero/scene.js';
import { visibilityPolygon } from '../src/lib/hero/painter.js';

const advance = (timeline, seconds, hz = 60) => { for (let i = 0; i < Math.round(seconds * hz); i++) timeline.step(1 / hz); };
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('default layout holds before morphing; transitions settle into a new full hold', () => {
  const t = new Timeline(); advance(t, 11.9); assert.equal(t.phase, 'hold');
  advance(t, .2); assert.equal(t.phase, 'morph'); assert.equal(t.target, 1);
  advance(t, SETTINGS.morph); assert.equal(t.phase, 'hold'); assert.equal(t.preset, 1);
  assert.ok(t.remaining > 11.8);
});
test('interaction freezes intermediate geometry, followed by a four-second cooldown', () => {
  const t = new Timeline(); t.next(); advance(t, .6); const before = wallSegments(t);
  t.beginInteraction(); advance(t, 20); assert.deepEqual(wallSegments(t), before);
  t.endInteraction(); advance(t, 3.9); assert.deepEqual(wallSegments(t), before);
  advance(t, .2); assert.notDeepEqual(wallSegments(t), before);
});
test('pause cannot be overridden by the idle clock', () => {
  const t = new Timeline(); t.next(); advance(t, .6); t.paused = true; const progress = t.progress;
  advance(t, 40); near(t.progress, progress); t.paused = false; advance(t, .2); assert.ok(t.progress > progress);
});
test('reduced motion disables autoplay but permits an instantaneous manual next layout', () => {
  const t = new Timeline(); t.reduced = true; advance(t, 40); assert.equal(t.preset, 0);
  t.next(); assert.equal(t.preset, 1); assert.equal(t.phase, 'hold');
});
test('manual changes are ignored while drawing or already morphing', () => {
  const t = new Timeline(); t.beginInteraction(); assert.equal(t.next(), false); t.endInteraction();
  assert.equal(t.next(), true); assert.equal(t.next(), false); assert.equal(t.target, 1);
});
test('reset preserves accessibility preferences and clears transition state', () => {
  const t = new Timeline(); t.next(); t.paused = true; t.reduced = true; t.beginInteraction(); t.reset();
  assert.equal(t.preset, 0); assert.equal(t.phase, 'hold'); assert.equal(t.interacting, false);
  assert.equal(t.paused, true); assert.equal(t.reduced, true);
});
test('clock is frame-rate independent, finite and clamped after a stall', () => {
  const a = new Timeline(), b = new Timeline(); advance(a, 13, 30); advance(b, 13, 120);
  assert.equal(a.phase, b.phase); near(a.progress, b.progress, 1e-7);
  const t = new Timeline(); t.step(Infinity); t.step(NaN); t.step(-1); near(t.elapsed, 0);
  t.step(500); near(t.elapsed, .25);
});
test('every transition has finite bounded geometry and keeps the diamond chamber clear', () => {
  const t = new Timeline();
  for (let preset = 0; preset < 4; preset++) {
    t.preset = preset; t.target = (preset + 1) % 4; t.phase = 'morph';
    for (let step = 0; step <= 100; step++) {
      t.elapsed = step / 100 * SETTINGS.morph;
      const walls = wallSegments(t); assert.equal(walls.length, 20);
      for (const s of walls) {
        for (const value of [s.x0, s.y0, s.x1, s.y1]) assert.ok(Number.isFinite(value) && Math.abs(value) <= .5);
        assert.ok(distanceToSegment(0, 0, s) > .16, 'wall intersects the diamond chamber');
      }
      assert.ok(walls.filter((s) => s.moving).length <= 2, 'too many gates move together');
    }
  }
});
test('settling a morph does not cause a pose discontinuity, including wraparound', () => {
  for (let preset = 0; preset < 4; preset++) {
    const t = new Timeline(); t.preset = preset; t.target = (preset + 1) % 4; t.phase = 'morph'; t.elapsed = SETTINGS.morph;
    const before = wallSegments(t); t.preset = t.target; t.phase = 'hold';
    wallSegments(t).forEach((s, i) => ['x0', 'y0', 'x1', 'y1'].forEach((k) => near(s[k], before[i][k])));
  }
});
test('angle interpolation takes the short arc', () => { near(angleLerp(Math.PI - .1, -Math.PI + .1, .5), Math.PI); });
test('mobile/desktop geometry fits the canvas, and desktop copy is protected', () => {
  for (const [w, h] of [[320, 740], [390, 740], [768, 700], [900, 640], [1536, 640], [2560, 640]]) {
    const v = layout(w, h); const scene = buildScene(v, new Timeline(), new StrokeBuffer());
    for (const s of scene.walls) for (const p of [[s.x0, s.y0], [s.x1, s.y1]]) {
      assert.ok(p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h);
      if (w >= 900) assert.ok(p[0] > w * .52);
    }
  }
});
test('stroke storage is bounded, normalized, finite and frame-rate independent', () => {
  const s = new StrokeBuffer(); s.begin(); s.add(NaN, 0, 0, 0); assert.equal(s.items.length, 0);
  for (let i = 0; i < 2000; i++) s.add(-1, 2, .4, .5);
  assert.equal(s.items.length, SETTINGS.maxStrokes); assert.equal(s.items[0].x0, 0); assert.equal(s.items[0].y0, 1);
  s.step(SETTINGS.strokeLife); assert.equal(s.items.length, 0);
  const a = new StrokeBuffer(), b = new StrokeBuffer(); a.add(0,0,1,1); b.add(0,0,1,1);
  for (let i=0;i<60;i++) a.step(1/30); for (let i=0;i<240;i++) b.step(1/120);
  near(a.items[0].life, b.items[0].life);
});
test('maximum scene fits the fixed GPU storage buffer', () => {
  const s = new StrokeBuffer(); for (let i=0;i<100;i++) s.add(.1,.1,.2,.2);
  const scene = buildScene(layout(1536,640), new Timeline(), s);
  assert.ok(scene.shapes.length <= 96); assert.ok(scene.shapes.every((s) => s.color.every(Number.isFinite)));
});
test('cascade intervals are contiguous, angular growth is fourfold, atlas size stays constant', () => {
  for (let level=0;level<5;level++) {
    const c = cascadeConfig(level); near(512 / c.spacing * c.side, 512);
    if (level) { const prev=cascadeConfig(level-1); near(prev.end,c.start); near(c.side**2,prev.side**2*4); }
  }
  assert.ok(cascadeConfig(4).end > Math.hypot(512,320));
});
test('field allocations are bounded and divisible by the coarsest probe spacing', () => {
  for (const [w,h] of [[0,0],[1,1],[320,740],[1920,1080],[10000,10000],[10000,100]]) {
    const s=fieldSize(w,h); assert.equal(s.width%32,0); assert.equal(s.height%32,0);
    assert.ok(s.width>=32&&s.width<=512&&s.height>=32&&s.height<=320);
  }
});
test('fallback visibility clips each light at an opaque barrier', () => {
  const points=visibilityPolygon(25,50,[{x0:50,y0:0,x1:50,y1:100}],100,100);
  assert.ok(points.every((p)=>p.x<=50.001));
  assert.ok(points.every((p)=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('enabling reduced motion midway does not trap the Next button forever', () => {
  const t=new Timeline(); t.next(); advance(t,.5); t.reduced=true;
  assert.equal(t.next(),true); assert.equal(t.preset,1); assert.equal(t.phase,'hold');
});
