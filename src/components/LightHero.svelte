<script lang="ts">
  import { onMount } from 'svelte';
  import diamond from './diamond-model.json';
  import { mountHero } from '../lib/hero/controller.js';

  let container: HTMLDivElement;
  let gpuCanvas: HTMLCanvasElement;
  let overlayCanvas: HTMLCanvasElement;
  let controller: ReturnType<typeof mountHero> | undefined;
  let ready = false;
  let state = { backend: 'initializing', paused: false, reduced: false, drawMode: false,
    preset: '开径 / APERTURE', morphing: false, status: '正在准备光场', busy: false };

  onMount(() => {
    try {
      controller = mountHero({ container, gpuCanvas, overlayCanvas, diamond, onState: (next: typeof state) => { state = next; } });
      ready = true;
    } catch (error) {
      console.warn('[LightHero] Interactive rendering unavailable:', error);
      state = { ...state, backend: 'unavailable', status: '静态预览' };
    }
    return () => { ready = false; controller?.destroy(); controller = undefined; };
  });
</script>

<div bind:this={container} class="hero" role="region" aria-labelledby="hero-title">
  <img class="poster" src="/hero-prism.webp" alt="" aria-hidden="true" fetchpriority="high" />
  <canvas bind:this={gpuCanvas} class="gpu" aria-hidden="true"></canvas>
  <canvas bind:this={overlayCanvas} class="scene" class:drawing={state.drawMode} aria-hidden="true"></canvas>
  <div class="grid" aria-hidden="true"></div>
  <div class="reading-shade" aria-hidden="true"></div>
  <div class="bottom-shade" aria-hidden="true"></div>

  <div class="copy">
    <p class="eyebrow">FIELD NOTES / GRAPHICS & LIGHT</p>
    <h1 id="hero-title">rakuyou’s labyrinth</h1>
    <p class="description">A personal notebook on graphics, radiance cascades<br class="desktop-break" /> & real-time optics.</p>
    <p class="hint">拖动绘制光源，看光如何穿过迷宫。</p>
    <a class="archive-link" href="/posts">阅读文章 <span aria-hidden="true">↗</span></a>
  </div>

  <div class="experiment" aria-label="光场实验控制">
    <div class="readout">
      <span class="experiment-name">001 / {state.preset}</span>
      <span class="status"><span class:reconfiguring={state.morphing} class="status-dot" aria-hidden="true"></span>{state.status}</span>
      <span class="backend">{state.backend === 'webgpu' ? 'WEBGPU · 5 CASCADES' : state.backend === '2d' ? '2D FALLBACK · 非 RC' : state.backend === 'unavailable' ? 'STATIC PREVIEW' : 'INITIALIZING'}</span>
    </div>
    <div class="controls">
      <button class="touch-toggle" disabled={!ready} aria-pressed={state.drawMode} onclick={() => controller?.toggleDraw()}>{state.drawMode ? '退出绘光' : '触屏绘光'}</button>
      <button disabled={!ready} onclick={() => controller?.placeLight()} title="在迷宫入口放置一个光源，也可使用键盘激活">放置光源</button>
      <button disabled={!ready || state.busy} onclick={() => controller?.next()}>下一形态 <span aria-hidden="true">↗</span></button>
      <button disabled={!ready || state.reduced} aria-pressed={state.paused} onclick={() => controller?.pause()} title={state.reduced ? '已遵循系统的减少动态设置' : '暂停或继续自动重组与光迹衰减'}>{state.paused ? '继续' : '暂停'}</button>
      <button disabled={!ready} onclick={() => controller?.reset()}>重置</button>
    </div>
  </div>
</div>

<style>
  .hero { position: relative; isolation: isolate; width: 100%; height: 640px; overflow: hidden; background: #030507; }
  .poster, canvas, .grid, .reading-shade, .bottom-shade { position: absolute; inset: 0; width: 100%; height: 100%; }
  .poster { object-fit: cover; opacity: .45; pointer-events: none; }
  .gpu { pointer-events: none; }
  .scene { display: block; cursor: crosshair; touch-action: pan-y; }
  .scene.drawing { touch-action: none; }
  .grid, .reading-shade, .bottom-shade { pointer-events: none; }
  .grid { background-image: linear-gradient(#b6d5e507 1px, transparent 1px), linear-gradient(90deg, #b6d5e507 1px, transparent 1px); background-size: 44px 44px; }
  .reading-shade { background: linear-gradient(90deg, #030507f5 0%, #030507ec 28%, #030507b3 43%, transparent 65%); }
  .bottom-shade { background: linear-gradient(0deg, #000 0%, #0008 8%, transparent 27%); }
  .copy { position: relative; top: 50%; transform: translateY(-58%); max-width: 1280px; margin: 0 auto; padding: 0 32px; pointer-events: none; }
  .eyebrow, .hint, .archive-link, .experiment { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .eyebrow { margin: 0 0 24px; font-size: 10px; letter-spacing: .18em; color: #9baeba; }
  h1 { max-width: 650px; margin: 0; color: #f6f6f2; font-family: var(--font-serif, Georgia, 'Times New Roman', serif); font-size: clamp(44px, 4.4vw, 68px); font-weight: 400; line-height: 1.08; letter-spacing: -.045em; }
  .description { max-width: 520px; margin: 22px 0 0; color: #b5bec5; font-size: 15px; line-height: 1.8; font-weight: 300; }
  .hint { margin: 18px 0 0; color: #94a6b3; font-size: 11px; letter-spacing: .04em; }
  .archive-link { display: inline-flex; gap: 24px; align-items: center; min-height: 44px; margin-top: 18px; pointer-events: auto; color: #dde6e9; font-size: 12px; text-decoration: none; border-bottom: 1px solid #82939d45; }
  .archive-link:hover { color: #a5efd5; border-color: currentColor; }
  .experiment { position: absolute; bottom: 25px; right: max(32px, calc((100% - 1216px) / 2)); left: max(32px, calc((100% - 1216px) / 2)); display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; font-size: 10px; }
  .readout { display: grid; gap: 7px; min-width: 0; }
  .experiment-name { color: #c3cdd4; letter-spacing: .1em; }
  .status { display: flex; align-items: center; gap: 8px; color: #a9b9c4; }
  .status-dot { width: 4px; height: 4px; border-radius: 50%; background: #89cbb5; }
  .status-dot.reconfiguring { background: #b4a0db; }
  .backend { color: #8896a1; font-size: 9px; letter-spacing: .09em; }
  .controls { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
  button { min-height: 44px; padding: 0 13px; font: inherit; font-size: 11px; color: #c7d0d7; border: 1px solid transparent; border-radius: 3px; background: #090e1480; cursor: pointer; }
  button:hover:not(:disabled), button[aria-pressed='true'] { color: #b8f2db; border-color: #97c7b744; background: #101b23; }
  button:disabled { cursor: default; opacity: .45; }
  button:focus-visible, .archive-link:focus-visible { outline: 2px solid #c3eadf; outline-offset: 4px; }
  .touch-toggle { display: none; }
  @media (pointer: coarse) { .touch-toggle { display: block; } }
  @media (max-width: 899px) {
    .hero { height: 700px; }
    .copy { top: 60px; transform: none; padding: 0 24px; }
    .eyebrow { margin-bottom: 18px; font-size: 9px; }
    h1 { max-width: 600px; font-size: clamp(38px, 6.8vw, 54px); letter-spacing: -.04em; }
    .description { max-width: 500px; margin-top: 16px; font-size: 13px; }
    .desktop-break { display: none; }
    .hint { margin-top: 10px; font-size: 10px; }
    .archive-link { margin-top: 8px; }
    .reading-shade { background: linear-gradient(180deg, #030507fc 0%, #030507ed 30%, #03050780 39%, transparent 54%); }
    .experiment { left: 24px; right: 24px; bottom: 16px; gap: 10px; align-items: center; }
    .readout { gap: 6px; }
    .experiment-name { max-width: 165px; font-size: 9px; letter-spacing: 0; }
    .backend { font-size: 8px; letter-spacing: 0; }
    .controls { max-width: 270px; gap: 0; }
    button { padding: 0 9px; font-size: 10px; }
  }
  @media (max-width: 480px) {
    .hero { height: 740px; }
    .experiment { flex-direction: column; align-items: stretch; }
    .readout { grid-template-columns: 1fr auto; gap: 5px 10px; }
    .backend { grid-column: 1 / -1; }
    .controls { max-width: none; justify-content: space-between; }
    button { padding: 0 6px; }
  }
</style>
