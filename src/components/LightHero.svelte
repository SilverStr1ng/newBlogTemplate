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

  // Dynamic interactive light rays emitted by user clicks
  interface CustomLightRay {
    id: number;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    color: string;
    life: number; // 1.0 -> 0.0
    maxLife: number;
    hue: number;
  }

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

  const activeRays: CustomLightRay[] = [];
  const particles: Particle[] = [];

  // Spectral colors for the dispersion fan
  const spectralPalette = [
    '#f43f5e', // Ruby Red
    '#fb923c', // Orange
    '#facc15', // Yellow
    '#4ade80', // Green
    '#38bdf8', // Cyan
    '#6366f1', // Blue
    '#a855f7', // Violet
  ];

  function spawnRay(x: number, y: number) {
    if (!canvasRef) return;
    const prismEntryX = canvasRef.width * 0.73;
    const prismEntryY = canvasRef.height * 0.52;
    const hues = [210, 280, 45, 160, 340];
    const chosenHue = hues[Math.floor(Math.random() * hues.length)];

    activeRays.push({
      id: Date.now() + Math.random(),
      startX: x,
      startY: y,
      targetX: prismEntryX,
      targetY: prismEntryY,
      color: `hsl(${chosenHue}, 90%, 65%)`,
      life: 1.0,
      maxLife: 1.0,
      hue: chosenHue,
    });
  }

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
    for (let i = 0; i < 45; i++) {
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
      const nx = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
      const ny = ((e.clientY - rect.top) / rect.height) * 2.0 - 1.0;
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
    };

    const handleClick = (e: MouseEvent) => {
      if (!canvasRef) return;
      const rect = canvasRef.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      spawnRay(clickX, clickY);
    };

    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    heroContainer.addEventListener('mouseleave', handleMouseLeave);
    heroContainer.addEventListener('click', handleClick);

    const render = () => {
      animId = requestAnimationFrame(render);
      // Smooth lerp damping
      currentX += (targetX - currentX) * 0.045;
      currentY += (targetY - currentY) * 0.045;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Render drifting cosmic particles
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

      // 2. Render user-spawned interactive light rays & their custom refracted dispersion
      const prismEntryX = canvas.width * 0.73 + currentX * 18;
      const prismEntryY = canvas.height * 0.52 + currentY * 14;
      const prismExitX = canvas.width * 0.55 + currentX * 12;
      const prismExitY = canvas.height * 0.49 + currentY * 8;

      for (let i = activeRays.length - 1; i >= 0; i--) {
        const ray = activeRays[i];
        ray.life -= 0.012; // Decay rate
        if (ray.life <= 0) {
          activeRays.splice(i, 1);
          continue;
        }

        const alpha = Math.sin(ray.life * Math.PI) * 0.85;

        // A. Incident ray from click point to prism entry
        ctx.save();
        ctx.strokeStyle = ray.color;
        ctx.lineWidth = 2.5 * ray.life + 0.5;
        ctx.shadowColor = ray.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(prismEntryX, prismEntryY);
        ctx.stroke();

        // Source emitter ring at click point
        ctx.beginPath();
        ctx.arc(ray.startX, ray.startY, (1.0 - ray.life) * 20 + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${ray.hue}, 90%, 70%, ${alpha * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // B. Internal crystal refraction inside prism
        ctx.strokeStyle = `hsla(${ray.hue + 20}, 95%, 85%, ${alpha})`;
        ctx.lineWidth = 3.5 * ray.life;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(prismEntryX, prismEntryY);
        ctx.lineTo(prismExitX, prismExitY);
        ctx.stroke();

        // C. Refracted fan dispersion shooting out to the left
        const fanLength = canvas.width * 0.55;
        for (let b = 0; b < spectralPalette.length; b++) {
          const spreadFactor = (b / (spectralPalette.length - 1) - 0.5) * 0.28;
          const angle = Math.PI + spreadFactor + currentY * 0.05;
          const endX = prismExitX + Math.cos(angle) * fanLength;
          const endY = prismExitY + Math.sin(angle) * fanLength;

          ctx.strokeStyle = spectralPalette[b];
          ctx.lineWidth = (3.0 - Math.abs(spreadFactor) * 5) * ray.life + 0.5;
          ctx.shadowColor = spectralPalette[b];
          ctx.shadowBlur = 12;
          ctx.globalAlpha = alpha * 0.75;
          ctx.beginPath();
          ctx.moveTo(prismExitX, prismExitY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Ambient specular glint on the prism facets based on mouse tilt
      const glintX = prismEntryX;
      const glintY = prismEntryY;
      const glintGrad = ctx.createRadialGradient(glintX, glintY, 0, glintX, glintY, 120);
      glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      glintGrad.addColorStop(0.3, 'rgba(180, 220, 255, 0.06)');
      glintGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glintGrad;
      ctx.beginPath();
      ctx.arc(glintX, glintY, 120, 0, Math.PI * 2);
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
  class="relative w-full h-[480px] sm:h-[540px] md:h-[600px] bg-black overflow-hidden select-none flex items-center cursor-crosshair"
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

  <!-- Interactive Light Glint, Pulse Rays & Particles Canvas -->
  <canvas
    bind:this={canvasRef}
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  ></canvas>

  <!-- Bottom seamless fade into page content -->
  <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10"></div>

  <!-- Foreground Content: Strict Single-Line Title and Description -->
  <div class="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 pointer-events-none">
    <div class="max-w-2xl pb-16">
      <!-- Title: Upright, Elegant Serif strictly on ONE LINE -->
      <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-serif font-normal tracking-tight text-white whitespace-nowrap leading-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)]">
        rakuyou’s labyrinth
      </h1>

      <!-- One-line clean description, zero fluff -->
      <p class="mt-4 text-sm sm:text-base text-zinc-300/90 font-light tracking-wide truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
        A personal notebook on graphics, shaders & real-time optics.
      </p>

      <!-- Minimal unobtrusive interaction hint -->
      <span class="mt-3 inline-block text-[11px] font-mono text-zinc-500 tracking-wider">
        [ CLICK CANVAS TO EMIT REFRACTING LIGHT RAYS ]
      </span>
    </div>
  </div>
</div>
