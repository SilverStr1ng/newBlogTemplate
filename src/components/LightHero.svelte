<script lang="ts">
  import { onMount } from 'svelte';

  let heroContainer: HTMLDivElement | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  let animId = 0;

  // Bounded mouse interaction state (small range)
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  // Dust particles floating in the light beam
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    hue: number;
  }
  const particles: Particle[] = [];

  onMount(() => {
    if (!canvasRef || !heroContainer) return;
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (!heroContainer || !canvas) return;
      canvas.width = heroContainer.clientWidth;
      canvas.height = heroContainer.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize floating light motes
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25 - 0.1,
        vy: (Math.random() - 0.5) * 0.15,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.15,
        hue: Math.random() > 0.5 ? 200 + Math.random() * 40 : 40 + Math.random() * 20,
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!heroContainer) return;
      const rect = heroContainer.getBoundingClientRect();
      // Bounded normalized coordinates: center is 0, range is [-1, 1]
      const nx = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
      const ny = ((e.clientY - rect.top) / rect.height) * 2.0 - 1.0;
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
    };

    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    heroContainer.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      animId = requestAnimationFrame(render);
      // Smooth lerp damping
      currentX += (targetX - currentX) * 0.045;
      currentY += (targetY - currentY) * 0.045;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render drifting light motes
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Interactive subtle specular glint on the prism facets based on mouse tilt
      const glintX = canvas.width * 0.73 + currentX * 18;
      const glintY = canvas.height * 0.52 + currentY * 14;
      const glintGrad = ctx.createRadialGradient(glintX, glintY, 0, glintX, glintY, 120);
      glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      glintGrad.addColorStop(0.3, 'rgba(180, 220, 255, 0.06)');
      glintGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glintGrad;
      ctx.beginPath();
      ctx.arc(glintX, glintY, 120, 0, Math.PI * 2);
      ctx.fill();

      // Interactive shimmer along the dispersion exit face
      const exitX = canvas.width * 0.55 + currentX * 12;
      const exitY = canvas.height * 0.49 + currentY * 8;
      const exitGrad = ctx.createRadialGradient(exitX, exitY, 0, exitX, exitY, 90);
      exitGrad.addColorStop(0, 'rgba(140, 210, 255, 0.12)');
      exitGrad.addColorStop(0.5, 'rgba(255, 180, 100, 0.04)');
      exitGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = exitGrad;
      ctx.beginPath();
      ctx.arc(exitX, exitY, 90, 0, Math.PI * 2);
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
  bind:this={heroContainer}
  class="relative w-full h-[520px] sm:h-[580px] md:h-[640px] bg-black overflow-hidden select-none flex items-center"
  role="region"
  aria-label="rakuyou's labyrinth hero banner"
  style="perspective: 1200px;"
>
  <!-- 3D Glass Prism Scene with subtle interactive perspective tilt -->
  <div
    class="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-300 ease-out flex items-center justify-end"
    style="transform: rotateY({currentX * 2.8}deg) rotateX({-currentY * 2.2}deg) scale(1.02);"
  >
    <img
      src="/hero-prism.webp"
      alt="Optical Light Prism with Spectral Rainbow Dispersion"
      class="w-full h-full object-cover object-center lg:object-right pointer-events-none"
      style="transform: translate({currentX * -10}px, {currentY * -6}px);"
      loading="eager"
      decoding="async"
    />
  </div>

  <!-- Interactive Light Glint & Particles Canvas -->
  <canvas
    bind:this={canvasRef}
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  ></canvas>

  <!-- Bottom seamless fade into page content -->
  <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10"></div>

  <!-- Foreground Content: Positioned in the upper-left quadrant to never obstruct the light beam -->
  <div class="relative z-20 w-full max-w-6xl mx-auto px-6 sm:px-8 pointer-events-none">
    <div class="max-w-xl pb-16">
      <!-- Title: Upright, Elegant Serif -->
      <h1 class="text-5xl sm:text-6xl md:text-7xl font-serif font-normal tracking-tight text-white leading-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]">
        rakuyou’s labyrinth
      </h1>

      <!-- One-line clean description, zero fluff -->
      <p class="mt-4 text-base sm:text-lg text-zinc-300/90 font-light tracking-wide truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
        A personal notebook on graphics, shaders & real-time optics.
      </p>
    </div>
  </div>
</div>
