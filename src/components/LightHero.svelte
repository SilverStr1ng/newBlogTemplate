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

<div bind:this={container} class="hero" role="region" aria-labelledby="hero-title"
  data-backend={state.backend} data-preset={state.preset} data-morphing={state.morphing}>
  <img class="poster" src="/hero-prism.webp" alt="" aria-hidden="true" fetchpriority="high" />
  <canvas bind:this={gpuCanvas} class="gpu" aria-hidden="true"></canvas>
  <canvas bind:this={overlayCanvas} class="scene" class:drawing={state.drawMode} aria-hidden="true"></canvas>
  <div class="grid" aria-hidden="true"></div>
  <div class="reading-shade" aria-hidden="true"></div>
  <div class="bottom-shade" aria-hidden="true"></div>

  <div class="copy">
    <p class="eyebrow">FIELD NOTES / GRAPHICS & LIGHT</p>
    <h1 id="hero-title">rakuyou’s labyrinth</h1>
  </div>

  <!-- No visible description, link, telemetry, countdown, or text-button group.
       Keep pause operable and preserve keyboard/touch access without visual clutter. -->
  <div class="quiet-actions">
    <button class="touch-toggle icon-button" disabled={!ready} aria-pressed={state.drawMode}
      aria-label={state.drawMode ? '退出触屏绘光' : '启用触屏绘光'} onclick={() => controller?.toggleDraw()}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1 4 4-1L20 7l-3-3Z M14 7l3 3" /></svg>
    </button>
    <button class="icon-button" disabled={!ready || state.reduced} aria-pressed={state.paused}
      aria-label={state.reduced ? '系统已启用减少动态' : state.paused ? '继续场景动画' : '暂停场景动画'}
      onclick={() => controller?.pause()}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {#if state.paused}<path d="m9 5 10 7-10 7Z" />{:else}<path d="M8 5v14 M16 5v14" />{/if}
      </svg>
    </button>
  </div>
  <div class="keyboard-actions" aria-label="迷宫键盘操作">
    <button disabled={!ready} onclick={() => controller?.placeLight()}>放置光源</button>
    <button disabled={!ready || state.busy} onclick={() => controller?.next()}>切换迷宫</button>
    <button disabled={!ready} onclick={() => controller?.reset()}>重置场景</button>
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
  .grid { background-image: linear-gradient(#b6d5e505 1px, transparent 1px), linear-gradient(90deg, #b6d5e505 1px, transparent 1px); background-size: 44px 44px; }
  .reading-shade { background: linear-gradient(90deg, #030507f5 0%, #030507ec 28%, #030507b3 43%, transparent 65%); }
  .bottom-shade { background: linear-gradient(0deg, #000 0%, #0008 8%, transparent 27%); }
  .copy { position: relative; top: 50%; transform: translateY(-58%); max-width: 1280px; margin: 0 auto; padding: 0 32px; pointer-events: none; }
  .eyebrow { margin: 0 0 24px; font: 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .18em; color: #9baeba; }
  h1 { max-width: 650px; margin: 0; color: #f6f6f2; font-family: var(--font-serif, Georgia, 'Times New Roman', serif); font-size: clamp(44px, 4.4vw, 68px); font-weight: 400; line-height: 1.08; letter-spacing: -.045em; }
  .quiet-actions { position: absolute; right: 24px; bottom: 20px; display: flex; gap: 4px; }
  .icon-button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; background: transparent; color: #91a7b6; cursor: pointer; border-radius: 50%; }
  .icon-button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .icon-button:hover, .icon-button[aria-pressed='true'] { color: #e4f3ef; background: #15202999; }
  .icon-button:disabled { opacity: .35; cursor: default; }
  button:focus-visible { outline: 2px solid #c3eadf; outline-offset: 3px; }
  .touch-toggle { display: none; }
  .keyboard-actions { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .keyboard-actions:focus-within { left: 24px; bottom: 20px; width: auto; height: auto; padding: 8px; display: flex; gap: 4px; clip-path: none; overflow: visible; background: #080d14; border-radius: 4px; }
  .keyboard-actions button { min-height: 44px; padding: 0 10px; border: 0; border-radius: 3px; background: transparent; color: #dae4eb; font: 11px ui-monospace, monospace; cursor: pointer; }
  @media (any-pointer: coarse) { .touch-toggle { display: grid; } }
  @media (max-width: 899px) {
    .hero { height: 620px; }
    .copy { top: 64px; transform: none; padding: 0 24px; }
    .eyebrow { margin-bottom: 18px; font-size: 9px; }
    h1 { max-width: 600px; font-size: clamp(38px, 6.8vw, 54px); letter-spacing: -.04em; }
    .reading-shade { background: linear-gradient(180deg, #030507fc 0%, #030507e0 22%, #03050750 35%, transparent 48%); }
  }
  @media (max-width: 480px) { .hero { height: 560px; } .quiet-actions { right: 16px; bottom: 12px; } }
</style>
