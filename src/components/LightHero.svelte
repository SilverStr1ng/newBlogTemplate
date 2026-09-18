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

  // Interactive light rays emitted on user click
  interface PulseRay {
    id: number;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    exitX: number;
    exitY: number;
    life: number;
    color: string;
    hue: number;
  }

  // Floating ambient light particles
  interface Mote {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    hue: number;
  }

  const activeRays: PulseRay[] = [];
  const motes: Mote[] = [];

  const dispersionColors = [
    'rgba(244, 63, 94, ',  // Ruby Red
    'rgba(251, 146, 60, ', // Orange
    'rgba(250, 204, 21, ', // Golden Yellow
    'rgba(74, 222, 128, ', // Emerald Green
    'rgba(56, 189, 248, ', // Cyan
    'rgba(99, 102, 241, ', // Royal Blue
    'rgba(168, 85, 247, ', // Violet
  ];

  function emitLightRay(clickX: number, clickY: number) {
    if (!canvasRef) return;
    const w = canvasRef.width;
    const h = canvasRef.height;

    // Prism entry facet coordinates (right side of canvas)
    const entryX = w * 0.72 + currentX * 16;
    const entryY = h * 0.58 + currentY * 12;
    // Prism exit facet coordinates
    const exitX = w * 0.53 + currentX * 10;
    const exitY = h * 0.54 + currentY * 8;

    const hues = [210, 45, 160, 330, 270];
    const chosenHue = hues[Math.floor(Math.random() * hues.length)];

    activeRays.push({
      id: Date.now() + Math.random(),
      startX: clickX,
      startY: clickY,
      targetX: entryX,
      targetY: entryY,
      exitX,
      exitY,
      life: 1.0,
      color: `hsl(${chosenHue}, 90%, 80%)`,
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

    // Populate ambient atmospheric motes
    for (let i = 0; i < 40; i++) {
      motes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2 - 0.08,
        vy: (Math.random() - 0.5) * 0.15,
        size: Math.random() * 1.6 + 0.6,
        alpha: Math.random() * 0.5 + 0.15,
        hue: Math.random() > 0.5 ? 205 + Math.random() * 30 : 40 + Math.random() * 25,
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
      emitLightRay(clickX, clickY);
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

      // Smooth lerp damping for organic 3D glass inertia
      currentX += (targetX - currentX) * 0.045;
      currentY += (targetY - currentY) * 0.045;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Drifting cosmic motes
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x < 0) m.x = canvas.width;
        if (m.x > canvas.width) m.x = 0;
        if (m.y < 0) m.y = canvas.height;
        if (m.y > canvas.height) m.y = 0;

        ctx.fillStyle = `hsla(${m.hue}, 80%, 75%, ${m.alpha})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Interactive Click Light Beams & Refracted Dispersion Waves
      const entryX = canvas.width * 0.72 + currentX * 16;
      const entryY = canvas.height * 0.58 + currentY * 12;
      const exitX = canvas.width * 0.53 + currentX * 10;
      const exitY = canvas.height * 0.54 + currentY * 8;

      for (let i = activeRays.length - 1; i >= 0; i--) {
        const ray = activeRays[i];
        ray.life -= 0.014;
        if (ray.life <= 0) {
          activeRays.splice(i, 1);
          continue;
        }

        const alpha = Math.sin(ray.life * Math.PI);

        ctx.save();

        // A. Incident laser beam from click to prism facet
        const beamGrad = ctx.createLinearGradient(ray.startX, ray.startY, entryX, entryY);
        beamGrad.addColorStop(0, `hsla(${ray.hue}, 100%, 85%, ${alpha * 0.9})`);
        beamGrad.addColorStop(1, `hsla(${ray.hue + 20}, 100%, 95%, ${alpha})`);

        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 3.0 * ray.life + 1.0;
        ctx.shadowColor = `hsla(${ray.hue}, 90%, 70%, ${alpha})`;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(entryX, entryY);
        ctx.stroke();

        // Emitter ripple at source
        ctx.beginPath();
        ctx.arc(ray.startX, ray.startY, (1.0 - ray.life) * 24 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${ray.hue}, 90%, 75%, ${alpha * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // B. Internal crystal refraction inside the prism
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        ctx.lineWidth = 4.0 * ray.life;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(exitX, exitY);
        ctx.stroke();

        // Facet refraction burst flare
        const burstGrad = ctx.createRadialGradient(entryX, entryY, 0, entryX, entryY, 40 * ray.life);
        burstGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
        burstGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = burstGrad;
        ctx.beginPath();
        ctx.arc(entryX, entryY, 40 * ray.life, 0, Math.PI * 2);
        ctx.fill();

        // C. Refracted dispersion fan waves shooting horizontally across the left
        const fanLength = canvas.width * 0.58;
        for (let b = 0; b < dispersionColors.length; b++) {
          const spreadFactor = (b / (dispersionColors.length - 1) - 0.5) * 0.28;
          const angle = Math.PI + spreadFactor + currentY * 0.04;
          const endX = exitX + Math.cos(angle) * fanLength;
          const endY = exitY + Math.sin(angle) * fanLength;

          ctx.strokeStyle = `${dispersionColors[b]}${alpha * 0.75})`;
          ctx.lineWidth = (3.5 - Math.abs(spreadFactor) * 6) * ray.life + 1.0;
          ctx.shadowColor = `${dispersionColors[b]}1.0)`;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.moveTo(exitX, exitY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 3. Subtle ambient specular glint on the crystal edges
      const glintGrad = ctx.createRadialGradient(entryX, entryY, 0, entryX, entryY, 110);
      glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      glintGrad.addColorStop(0.4, 'rgba(160, 210, 255, 0.04)');
      glintGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glintGrad;
      ctx.beginPath();
      ctx.arc(entryX, entryY, 110, 0, Math.PI * 2);
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
  class="relative w-full h-[520px] sm:h-[580px] md:h-[640px] bg-black overflow-hidden select-none flex items-start pt-16 sm:pt-20 cursor-crosshair"
  role="region"
  aria-label="rakuyou's labyrinth interactive optical hero"
  style="perspective: 1200px;"
>
  <!-- 3D Glass Prism Base: positioned gracefully on the right, shifted down so beam never obscures the title -->
  <div
    class="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-300 ease-out flex items-center justify-end"
    style="transform: rotateY({currentX * 2.8}deg) rotateX({-currentY * 2.0}deg) scale(1.02);"
  >
    <img
      src="/hero-prism.webp"
      alt="Optical Light Prism with Spectral Rainbow Dispersion"
      class="w-full h-full object-cover object-center lg:object-right pointer-events-none translate-y-6 sm:translate-y-8"
      style="transform: translate({currentX * -10}px, {currentY * -6 + 28}px);"
      loading="eager"
      decoding="async"
    />
  </div>

  <!-- Interactive Light Pulse Rays, Caustic Glints & Motes Canvas -->
  <canvas
    bind:this={canvasRef}
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  ></canvas>

  <!-- Bottom seamless fade into page content -->
  <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10"></div>

  <!-- Foreground Content: Positioned high in the upper quadrant, completely free of the beam -->
  <div class="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 pointer-events-none">
    <div class="max-w-2xl">
      <!-- Title: Upright Elegant Serif strictly on ONE LINE -->
      <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-serif font-normal tracking-tight text-white whitespace-nowrap leading-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.95)]">
        rakuyou’s labyrinth
      </h1>

      <!-- One-line clean description, zero fluff -->
      <p class="mt-3 text-sm sm:text-base text-zinc-300/90 font-light tracking-wide truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
        A personal notebook on graphics, shaders & real-time optics.
      </p>

      <!-- Unobtrusive interaction hint -->
      <span class="mt-3 inline-block text-[11px] font-mono text-zinc-500 tracking-wider">
        [ CLICK CANVAS TO EMIT REFRACTING LIGHT RAYS ]
      </span>
    </div>
  </div>
</div>
