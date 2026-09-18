<script lang="ts">
  import { onMount } from 'svelte';

  let heroRef: HTMLDivElement | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  let mouseX = $state(0.5);
  let mouseY = $state(0.5);

  let targetX = 0.5;
  let targetY = 0.5;
  let currentX = 0.5;
  let currentY = 0.5;
  let animId = 0;

  // Dust particles floating in the light beam
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
  }
  const particles: Particle[] = [];

  onMount(() => {
    if (!canvasRef || !heroRef) return;
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (!heroRef || !canvas) return;
      canvas.width = heroRef.clientWidth;
      canvas.height = heroRef.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize subtle light motes
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3 - 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 1.8 + 0.6,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef) return;
      const rect = heroRef.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width;
      targetY = (e.clientY - rect.top) / rect.height;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      animId = requestAnimationFrame(render);
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      mouseX = currentX;
      mouseY = currentY;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render floating illuminated dust motes
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle dynamic flare at the prism entrance point (around 72% x, 52% y)
      const flareX = canvas.width * 0.72 + (currentX - 0.5) * 20;
      const flareY = canvas.height * 0.51 + (currentY - 0.5) * 15;
      const grad = ctx.createRadialGradient(flareX, flareY, 0, flareX, flareY, 180);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      grad.addColorStop(0.3, 'rgba(160, 220, 255, 0.05)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(flareX, flareY, 180, 0, Math.PI * 2);
      ctx.fill();
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  });
</script>

<div
  bind:this={heroRef}
  class="relative w-full min-h-[560px] md:min-h-[640px] lg:min-h-[720px] bg-black overflow-hidden select-none flex items-center"
  role="region"
  aria-label="rakuyou's labyrinth hero banner"
>
  <!-- Background 3D Glass Prism Layer (1:1 from vgpu) -->
  <div class="absolute inset-0 w-full h-full pointer-events-none overflow-hidden flex items-center justify-end">
    <img
      src="/hero-prism.webp"
      alt="Optical Light Prism with Spectral Rainbow Dispersion"
      class="w-full h-full object-cover object-center lg:object-right scale-100 transition-transform duration-700 ease-out pointer-events-none"
      style="transform: translate({(mouseX - 0.5) * -12}px, {(mouseY - 0.5) * -8}px);"
      loading="eager"
      decoding="async"
    />
  </div>

  <!-- Interactive Canvas Overlay (Dust motes & reactive light flares) -->
  <canvas
    bind:this={canvasRef}
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  ></canvas>

  <!-- Bottom seamless fade into black background -->
  <div class="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none z-10"></div>

  <!-- Foreground Content Overlay (Aligned to left column, matching vgpu layout) -->
  <div class="relative z-20 w-full max-w-[1400px] mx-auto px-6 sm:px-8 py-16 md:py-24">
    <div class="max-w-xl">
      <!-- Title: High fashion serif, matching vgpu wordmark elegance -->
      <h1 class="text-6xl sm:text-7xl md:text-8xl lg:text-[5.5rem] font-serif font-normal tracking-tight text-white leading-[0.95] drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
        rakuyou<span class="italic font-light text-zinc-400">’s</span><br />
        <span class="text-white">labyrinth</span>
      </h1>

      <!-- Subtitle: Clean sans-serif -->
      <p class="mt-6 text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight leading-snug drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-md">
        The graphics, shader & real-time optics notebook.
      </p>

      <!-- Meta Tags row -->
      <div class="mt-8 flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
        <span class="text-white font-medium">Prompt</span>
        <span class="text-zinc-600">•</span>
        <span class="text-zinc-300">Shaders</span>
        <span class="text-zinc-600">•</span>
        <span class="text-zinc-300">WebGPU</span>
        <span class="text-zinc-600">•</span>
        <span class="text-zinc-300">Optics</span>
      </div>

      <!-- Quick Command / Prompt -->
      <div class="mt-5 text-xs font-mono text-zinc-400 flex items-center gap-2 drop-shadow">
        <span class="text-sky-400">λ</span>
        <span class="text-zinc-400">Enter the labyrinth: explore writings & cases below</span>
      </div>
    </div>
  </div>
</div>
