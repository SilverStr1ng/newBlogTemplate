import { Timeline, StrokeBuffer, PRESETS, SETTINGS, layout, buildScene } from './scene.js';
import { createPainter } from './painter.js';
import { createGPU } from './gpu.js';

/** Owns every listener, timer, observer and renderer; safe across Astro remounts. */
export function mountHero({ container, gpuCanvas, overlayCanvas, diamond, onState }) {
  const abort = new AbortController(), { signal } = abort;
  const timeline = new Timeline(), strokes = new StrokeBuffer();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const painter = createPainter(overlayCanvas, diamond);
  let gpu = null, disposed = false, backend = 'initializing', intersecting = true, pageHidden = false;
  let raf = 0, timer = 0, last = performance.now(), lastPublish = 0;
  let activePointer = null, lastPoint = null, drawMode = false;
  let width = 1, height = 1, dpr = 1, sceneDirty = true, overlayDirty = true;
  let pointer = { x: .5, y: .5 };
  const active = () => !disposed && intersecting && !document.hidden && !pageHidden;
  const publish = (force = false) => {
    if (disposed) return;
    const now = performance.now();
    if (!force && now - lastPublish < 240) return;
    lastPublish = now;
    onState({ backend, paused: timeline.paused, reduced: timeline.reduced, drawMode,
      preset: PRESETS[timeline.target], morphing: timeline.phase === 'morph',
      status: timeline.interacting ? '绘光中' : timeline.paused ? '已暂停' : timeline.reduced ? '减少动态' : timeline.cooldown > 0 ? '观察光场' : timeline.phase === 'morph' ? '迷宫重组' : `${Math.ceil(timeline.remaining)} 秒后重组`,
      busy: timeline.interacting || (timeline.phase === 'morph' && !timeline.paused && !timeline.reduced) });
  };
  const cancel = () => { cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; };
  const wake = () => { if (active() && !raf) { clearTimeout(timer); timer = 0; raf = requestAnimationFrame(tick); } };
  const invalidate = () => { sceneDirty = overlayDirty = true; wake(); };
  const fallback = (error) => {
    if (disposed) return;
    gpu?.destroy(); gpu = null; backend = '2d'; gpuCanvas.hidden = true;
    if (error) console.warn('[LightHero] Using the 2D fallback:', error);
    invalidate(); publish(true);
  };
  const endPointer = () => {
    if (activePointer === null) return;
    const id = activePointer; activePointer = null; lastPoint = null;
    if (overlayCanvas.hasPointerCapture(id)) overlayCanvas.releasePointerCapture(id);
    timeline.endInteraction(); last = performance.now(); publish(true); wake();
  };
  const point = (event) => {
    const r = overlayCanvas.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - r.left) / Math.max(1, r.width))), y: Math.min(1, Math.max(0, (event.clientY - r.top) / Math.max(1, r.height))) };
  };
  const down = (event) => {
    if (!event.isPrimary || event.button !== 0 || activePointer !== null || (event.pointerType === 'touch' && !drawMode)) return;
    activePointer = event.pointerId; pointer = lastPoint = point(event);
    overlayCanvas.setPointerCapture(event.pointerId);
    timeline.beginInteraction(); strokes.begin(); strokes.add(pointer.x, pointer.y, pointer.x, pointer.y);
    invalidate(); publish(true);
  };
  const move = (event) => {
    if (activePointer !== null && event.pointerId !== activePointer) return;
    pointer = point(event); overlayDirty = true;
    if (activePointer !== null && lastPoint) {
      const distance = Math.hypot((pointer.x - lastPoint.x) * width, (pointer.y - lastPoint.y) * height);
      if (distance >= 3) { strokes.add(lastPoint.x, lastPoint.y, pointer.x, pointer.y); lastPoint = pointer; sceneDirty = true; }
    }
    wake();
  };
  function tick(now) {
    raf = timer = 0;
    if (!active()) return;
    const dt = Math.min(.25, Math.max(0, (now - last) / 1000)); last = now;
    sceneDirty = timeline.step(dt) || sceneDirty;
    // Pause/reduced-motion freezes fades as well as geometry. Manual drawing still works.
    if (!timeline.paused && !timeline.reduced) sceneDirty = strokes.step(dt) || sceneDirty;
    if (window.devicePixelRatio !== dpr) resize();
    if (sceneDirty || overlayDirty) {
      const scene = buildScene(layout(width, height), timeline, strokes);
      if (sceneDirty && gpu) { try { gpu.render(scene); } catch (error) { fallback(error); } }
      painter.render(scene, !gpu, pointer);
      sceneDirty = overlayDirty = false;
    }
    publish();
    if (!timeline.paused && !timeline.reduced) {
      // Stable scenes reuse the GPU result. Moving scenes and fades use a nominal 30 Hz schedule; input can wake earlier.
      const moving = (timeline.phase === 'morph' && !timeline.interacting && timeline.cooldown <= 0) || strokes.items.length > 0;
      timer = window.setTimeout(() => { timer = 0; wake(); }, moving ? 1000 / 30 : 240);
    }
  }
  function resize() {
    if (disposed) return;
    const r = container.getBoundingClientRect();
    width = Math.max(1, r.width); height = Math.max(1, r.height); dpr = window.devicePixelRatio || 1;
    painter.resize(width, height, dpr);
    try { gpu?.resize(width, height, dpr); } catch (error) { fallback(error); }
    sceneDirty = overlayDirty = true; wake();
  }
  const suspend = () => {
    endPointer(); cancel(); last = performance.now();
    if (active()) { sceneDirty = overlayDirty = true; wake(); }
  };
  const changeMotion = () => { timeline.reduced = motion.matches; cancel(); last = performance.now(); invalidate(); publish(true); };
  motion.addEventListener('change', changeMotion, { signal });
  overlayCanvas.addEventListener('pointerdown', down, { signal });
  overlayCanvas.addEventListener('pointermove', move, { signal });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) overlayCanvas.addEventListener(name, (event) => { if (event.pointerId === activePointer) endPointer(); }, { signal });
  overlayCanvas.addEventListener('pointerleave', () => { if (activePointer === null) { pointer = { x: .5, y: .5 }; overlayDirty = true; wake(); } }, { signal });
  window.addEventListener('blur', endPointer, { signal });
  document.addEventListener('visibilitychange', suspend, { signal });
  window.addEventListener('pagehide', () => { pageHidden = true; suspend(); }, { signal });
  window.addEventListener('pageshow', () => { pageHidden = false; suspend(); }, { signal });
  window.addEventListener('resize', resize, { signal });
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
  const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; suspend(); }, { threshold: 0 }); observer.observe(container);
  timeline.reduced = motion.matches;
  resize(); publish(true);
  void createGPU(gpuCanvas, fallback, signal).then((renderer) => {
    if (disposed) { renderer.destroy(); return; }
    if (!renderer.alive) { fallback(new Error('WebGPU device lost during initialization')); return; }
    gpu = renderer; gpuCanvas.hidden = false; backend = 'webgpu';
    gpu.resize(width, height, dpr); invalidate(); publish(true);
  }).catch((error) => { if (!disposed) fallback(error); });
  return {
    pause() { timeline.paused = !timeline.paused; cancel(); last = performance.now(); invalidate(); publish(true); },
    next() { if (timeline.next()) { last = performance.now(); invalidate(); publish(true); } },
    reset() { endPointer(); timeline.reset(); strokes.clear(); last = performance.now(); invalidate(); publish(true); },
    toggleDraw() { endPointer(); drawMode = !drawMode; overlayCanvas.style.touchAction = drawMode ? 'none' : 'pan-y'; publish(true); },
    placeLight() { const v = layout(width, height); const x = (v.cx - v.scale * .27) / width, y = (v.cy + v.scale * .12) / height; strokes.begin(); strokes.add(x, y, x, y); timeline.cooldown = SETTINGS.cooldown; last = performance.now(); invalidate(); publish(true); },
    destroy() {
      if (disposed) return;
      disposed = true; endPointer(); cancel(); resizeObserver.disconnect(); observer.disconnect();
      abort.abort(); gpu?.destroy(); painter.destroy();
    },
  };
}
