<script lang="ts">
  import { onMount } from 'svelte';

  let heroContainer: HTMLDivElement | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  let animId = 0;

  // Mouse inertia state (bounded small range)
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  // Click photon pulse energy
  let pulseEnergy = 0;

  // Ambient cosmic dust particles
  interface Mote {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    hue: number;
  }
  const motes: Mote[] = [];

  // Spectral rainbow colors (physical wavelength gradient)
  const spectralGradient = [
    { r: 244, g: 63, b: 94 },  // Ruby Red
    { r: 251, g: 113, b: 36 }, // Solar Orange
    { r: 250, g: 204, b: 21 }, // Golden Yellow
    { r: 74, g: 222, b: 128 }, // Emerald Green
    { r: 56, g: 189, b: 248 }, // Cyan
    { r: 99, g: 102, b: 241 }, // Royal Blue
    { r: 168, g: 85, b: 247 }, // Violet
  ];

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

    // Populate ambient particles
    for (let i = 0; i < 60; i++) {
      motes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2 - 0.08,
        vy: (Math.random() - 0.5) * 0.15,
        size: Math.random() * 1.5 + 0.5,
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

    const handleClick = () => {
      pulseEnergy = 1.0;
    };

    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    heroContainer.addEventListener('mouseleave', handleMouseLeave);
    heroContainer.addEventListener('click', handleClick);

    // Draw a single seamless transparent 3D glass prism
    function drawGlassPrism(
      cx: number,
      cy: number,
      radius: number,
      rotation: number,
      tiltX: number,
      tiltY: number,
      internalGlowHue: number = 200
    ) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(cx + tiltX * 8, cy + tiltY * 6);
      ctx.rotate(rotation + tiltX * 0.04);

      // Equilateral triangle vertices with chamfers
      const r = radius;
      const v1 = { x: 0, y: -r };
      const v2 = { x: r * Math.cos(Math.PI / 6), y: r * Math.sin(Math.PI / 6) };
      const v3 = { x: -r * Math.cos(Math.PI / 6), y: r * Math.sin(Math.PI / 6) };

      // 1. Transparent Dielectric Glass Body Fill
      const glassGrad = ctx.createLinearGradient(v1.x, v1.y, (v2.x + v3.x) / 2, (v2.y + v3.y) / 2);
      glassGrad.addColorStop(0, 'rgba(18, 26, 45, 0.45)');
      glassGrad.addColorStop(0.5, 'rgba(10, 16, 30, 0.35)');
      glassGrad.addColorStop(1, 'rgba(25, 38, 65, 0.55)');

      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
      ctx.lineTo(v3.x, v3.y);
      ctx.closePath();
      ctx.fillStyle = glassGrad;
      ctx.fill();

      // 2. Internal Refraction Caustic Glow
      const caustic = ctx.createRadialGradient(0, r * 0.1, 0, 0, r * 0.1, r * 0.85);
      caustic.addColorStop(0, `hsla(${internalGlowHue}, 100%, 85%, ${0.25 + pulseEnergy * 0.4})`);
      caustic.addColorStop(0.5, `hsla(${internalGlowHue}, 80%, 60%, ${0.08 + pulseEnergy * 0.2})`);
      caustic.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = caustic;
      ctx.fill();

      // 3. Faceted Chamfer / Bevel Inner Lines (Giving 3D Glass Depth)
      const innerScale = 0.82;
      const iv1 = { x: v1.x * innerScale, y: v1.y * innerScale };
      const iv2 = { x: v2.x * innerScale, y: v2.y * innerScale };
      const iv3 = { x: v3.x * innerScale, y: v3.y * innerScale };

      ctx.strokeStyle = 'rgba(180, 220, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(iv1.x, iv1.y);
      ctx.lineTo(iv2.x, iv2.y);
      ctx.lineTo(iv3.x, iv3.y);
      ctx.closePath();
      ctx.stroke();

      // Corner bevel connectors
      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y); ctx.lineTo(iv1.x, iv1.y);
      ctx.moveTo(v2.x, v2.y); ctx.lineTo(iv2.x, iv2.y);
      ctx.moveTo(v3.x, v3.y); ctx.lineTo(iv3.x, iv3.y);
      ctx.stroke();

      // 4. Polished Glass Specular Rim Glints (Vercel Studio Reflection Effect)
      // Right entry edge highlight
      const rGrad = ctx.createLinearGradient(v1.x, v1.y, v2.x, v2.y);
      rGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      rGrad.addColorStop(0.4, 'rgba(180, 225, 255, 0.75)');
      rGrad.addColorStop(1, 'rgba(120, 180, 240, 0.3)');
      ctx.strokeStyle = rGrad;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#99ccff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
      ctx.stroke();

      // Left exit edge highlight
      const lGrad = ctx.createLinearGradient(v1.x, v1.y, v3.x, v3.y);
      lGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      lGrad.addColorStop(0.5, 'rgba(200, 235, 255, 0.6)');
      lGrad.addColorStop(1, 'rgba(100, 160, 230, 0.25)');
      ctx.strokeStyle = lGrad;
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v3.x, v3.y);
      ctx.stroke();

      // Base edge subtle reflection
      ctx.strokeStyle = 'rgba(120, 160, 210, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(v2.x, v2.y);
      ctx.lineTo(v3.x, v3.y);
      ctx.stroke();

      // Apex Glint Flare
      const apexGlint = ctx.createRadialGradient(v1.x, v1.y, 0, v1.x, v1.y, 14);
      apexGlint.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      apexGlint.addColorStop(0.5, 'rgba(180, 225, 255, 0.4)');
      apexGlint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = apexGlint;
      ctx.beginPath();
      ctx.arc(v1.x, v1.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    const render = () => {
      animId = requestAnimationFrame(render);

      // Smooth mouse inertia
      currentX += (targetX - currentX) * 0.045;
      currentY += (targetY - currentY) * 0.045;

      // Pulse energy decay
      if (pulseEnergy > 0.005) {
        pulseEnergy *= 0.94;
      } else {
        pulseEnergy = 0.0;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;

      // 1. Ambient Cosmic Dust Motes
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x < 0) m.x = w;
        if (m.x > w) m.x = 0;
        if (m.y < 0) m.y = h;
        if (m.y > h) m.y = 0;

        ctx.fillStyle = `hsla(${m.hue}, 80%, 75%, ${m.alpha})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Optical Transmission Geometry Coordinates
      // Prism 1 (Dispersing: Positioned Far Upper Right)
      const p1X = w * 0.82 + currentX * 12;
      const p1Y = h * 0.35 + currentY * 10;
      const p1Radius = Math.min(w, h) * 0.14;

      // Prism 2 (Receiving & Transmission: Positioned Lower Mid-Right, Well Spaced)
      const p2X = w * 0.52 + currentX * 16;
      const p2Y = h * 0.70 + currentY * 12;
      const p2Radius = Math.min(w, h) * 0.13;

      // Ray entry & exit coordinates on prisms
      const p1EntryX = p1X + p1Radius * 0.5;
      const p1EntryY = p1Y - p1Radius * 0.1;
      const p1ExitX = p1X - p1Radius * 0.5;
      const p1ExitY = p1Y + p1Radius * 0.15;

      const p2EntryX = p2X + p2Radius * 0.45;
      const p2EntryY = p2Y - p2Radius * 0.15;
      const p2ExitX = p2X - p2Radius * 0.5;
      const p2ExitY = p2Y + p2Radius * 0.05;

      ctx.save();

      // --- A. INCIDENT WHITE LASER BEAM (From off-screen top-right into Prism 1) ---
      const incSourceX = w * 1.05;
      const incSourceY = h * 0.08 + currentY * 20;

      const incGrad = ctx.createLinearGradient(incSourceX, incSourceY, p1EntryX, p1EntryY);
      incGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      incGrad.addColorStop(1, 'rgba(240, 248, 255, 1.0)');

      ctx.strokeStyle = incGrad;
      ctx.lineWidth = 3.5 + pulseEnergy * 4.0;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18 + pulseEnergy * 25;
      ctx.beginPath();
      ctx.moveTo(incSourceX, incSourceY);
      ctx.lineTo(p1EntryX, p1EntryY);
      ctx.stroke();

      // Prism 1 Entry Refraction Glint
      const p1Glint = ctx.createRadialGradient(p1EntryX, p1EntryY, 0, p1EntryX, p1EntryY, 32 + pulseEnergy * 35);
      p1Glint.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      p1Glint.addColorStop(0.4, 'rgba(180, 225, 255, 0.4)');
      p1Glint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = p1Glint;
      ctx.beginPath();
      ctx.arc(p1EntryX, p1EntryY, 32 + pulseEnergy * 35, 0, Math.PI * 2);
      ctx.fill();

      // Internal Caustic Beam in Prism 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 4.0 + pulseEnergy * 3.5;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(p1EntryX, p1EntryY);
      ctx.lineTo(p1ExitX, p1ExitY);
      ctx.stroke();

      // --- B. CONTINUOUS SPECTRAL RAINBOW TRANSMISSION (Prism 1 -> Prism 2) ---
      // Fanning rainbow ribbon across the open diagonal space
      const numBands = 24;
      for (let b = 0; b < numBands; b++) {
        const f = b / (numBands - 1); // 0 (Red) to 1 (Violet)

        const startX = p1ExitX;
        const startY = p1ExitY + (f - 0.5) * 16;
        const endX = p2EntryX;
        const endY = p2EntryY + (f - 0.5) * 48; // Expands gracefully across the gap

        // Spectral color blending
        const cIdx = f * (spectralGradient.length - 1);
        const i0 = Math.floor(cIdx);
        const i1 = Math.min(spectralGradient.length - 1, i0 + 1);
        const blend = cIdx - i0;
        const cr = Math.round(spectralGradient[i0].r * (1 - blend) + spectralGradient[i1].r * blend);
        const cg = Math.round(spectralGradient[i0].g * (1 - blend) + spectralGradient[i1].g * blend);
        const cb = Math.round(spectralGradient[i0].b * (1 - blend) + spectralGradient[i1].b * blend);

        const bandAlpha = 0.88 + pulseEnergy * 0.4;
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${bandAlpha})`;
        ctx.lineWidth = 3.2 + pulseEnergy * 2.8;
        ctx.shadowColor = `rgba(${cr}, ${cg}, ${cb}, 0.85)`;
        ctx.shadowBlur = 14 + pulseEnergy * 16;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      // Prism 2 Entry Multi-Spectral Caustic Burst
      const p2Glint = ctx.createRadialGradient(p2EntryX, p2EntryY, 0, p2EntryX, p2EntryY, 42 + pulseEnergy * 45);
      p2Glint.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      p2Glint.addColorStop(0.35, 'rgba(120, 220, 255, 0.45)');
      p2Glint.addColorStop(0.7, 'rgba(255, 180, 100, 0.15)');
      p2Glint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = p2Glint;
      ctx.beginPath();
      ctx.arc(p2EntryX, p2EntryY, 42 + pulseEnergy * 45, 0, Math.PI * 2);
      ctx.fill();

      // Internal Refraction & Recombination in Prism 2
      ctx.strokeStyle = 'rgba(220, 250, 255, 0.9)';
      ctx.lineWidth = 4.5 + pulseEnergy * 4.0;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(p2EntryX, p2EntryY);
      ctx.lineTo(p2ExitX, p2ExitY);
      ctx.stroke();

      // --- C. RECOMBINED TRANSMISSION EXIT BEAM (Shoots out to the left) ---
      const exitEndX = -50;
      const exitEndY = p2ExitY - 6;

      const exitGrad = ctx.createLinearGradient(p2ExitX, p2ExitY, exitEndX, exitEndY);
      exitGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      exitGrad.addColorStop(0.35, 'rgba(160, 230, 255, 0.9)');
      exitGrad.addColorStop(1, 'rgba(100, 180, 255, 0.1)');

      ctx.strokeStyle = exitGrad;
      ctx.lineWidth = 4.2 + pulseEnergy * 4.0;
      ctx.shadowColor = '#66ccff';
      ctx.shadowBlur = 22 + pulseEnergy * 25;
      ctx.beginPath();
      ctx.moveTo(p2ExitX, p2ExitY);
      ctx.lineTo(exitEndX, exitEndY);
      ctx.stroke();

      ctx.restore();

      // 3. Render the Two Transparent 3D Glass Prisms
      // Prism 1 (Dispersing Prism: Upper Right)
      drawGlassPrism(p1X, p1Y, p1Radius, -0.15, currentX, currentY, 210);

      // Prism 2 (Receiving & Transmission Prism: Lower Mid-Right)
      drawGlassPrism(p2X, p2Y, p2Radius, -0.08, currentX * 0.85, currentY * 0.85, 185);
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
  class="relative w-full h-[520px] sm:h-[580px] md:h-[640px] bg-black overflow-hidden select-none flex items-center cursor-crosshair"
  role="region"
  aria-label="rakuyou's labyrinth dual-prism optical transmission hero"
>
  <!-- Unified Real-time Optical Transmission Canvas: Zero image seams, crystal-clear transparency -->
  <canvas
    bind:this={canvasRef}
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  ></canvas>

  <!-- Bottom subtle fade into dark page content -->
  <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-20"></div>

  <!-- Noise Grain Overlay -->
  <div class="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-25 z-20"></div>

  <!-- Foreground Content: Positioned purely in the upper-left dark void, zero clutter, 100% crisp -->
  <div class="relative z-30 w-full max-w-7xl mx-auto px-6 sm:px-8 pointer-events-none">
    <div class="max-w-xl pb-12">
      <!-- Title: Upright, Elegant Serif strictly on ONE LINE -->
      <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-serif font-normal tracking-tight text-white whitespace-nowrap leading-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)]">
        rakuyou’s labyrinth
      </h1>

      <!-- One-line clean description, zero marketing fluff -->
      <p class="mt-4 text-sm sm:text-base text-zinc-400 font-light tracking-wide truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
        A personal notebook on graphics, shaders & real-time optics.
      </p>
    </div>
  </div>
</div>
