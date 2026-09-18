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

  // Click photon pulse energy
  let pulseEnergy = 0;

  // Floating ambient cosmic dust motes
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

  // Continuous physical spectral palette matching vgpu (Image #1)
  const spectrumStops = [
    { pos: 0.00, r: 255, g: 30, b: 50 },   // Deep Ruby Red (top)
    { pos: 0.16, r: 255, g: 115, b: 0 },  // Solar Orange
    { pos: 0.33, r: 255, g: 235, b: 0 },  // Golden Yellow
    { pos: 0.50, r: 16, g: 232, b: 84 },  // Emerald Green
    { pos: 0.67, r: 0, g: 229, b: 255 },  // Electric Cyan
    { pos: 0.83, r: 41, g: 98, b: 255 },  // Royal Blue
    { pos: 1.00, r: 124, g: 77, b: 255 }, // Violet (bottom)
  ];

  // Helper to interpolate RGB along the continuous spectrum
  function getSpectrumColor(t: number): { r: number; g: number; b: number } {
    const clampedT = Math.max(0, Math.min(1, t));
    for (let i = 0; i < spectrumStops.length - 1; i++) {
      const s0 = spectrumStops[i];
      const s1 = spectrumStops[i + 1];
      if (clampedT >= s0.pos && clampedT <= s1.pos) {
        const factor = (clampedT - s0.pos) / (s1.pos - s0.pos);
        return {
          r: Math.round(s0.r + (s1.r - s0.r) * factor),
          g: Math.round(s0.g + (s1.g - s0.g) * factor),
          b: Math.round(s0.b + (s1.b - s0.b) * factor),
        };
      }
    }
    return spectrumStops[spectrumStops.length - 1];
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

    // Populate ambient particles
    for (let i = 0; i < 50; i++) {
      particles.push({
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

    // 1. Draw a Beveled 3D Glass Triangular Prism (Matching Image #1)
    function drawBeveledGlassPrism(
      cx: number,
      cy: number,
      radius: number,
      angle: number,
      internalRay: { inX: number; inY: number; outX: number; outY: number } | null = null
    ) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Outer equilateral triangle vertices
      const r = radius;
      const top = { x: 0, y: -r };
      const right = { x: r * Math.cos(Math.PI / 6), y: r * Math.sin(Math.PI / 6) };
      const left = { x: -r * Math.cos(Math.PI / 6), y: r * Math.sin(Math.PI / 6) };

      // Inner beveled facet frame
      const bevelRatio = 0.78;
      const itop = { x: top.x * bevelRatio, y: top.y * bevelRatio };
      const iright = { x: right.x * bevelRatio, y: right.y * bevelRatio };
      const ileft = { x: left.x * bevelRatio, y: left.y * bevelRatio };

      // Base Glass Fill (Deep obsidian translucent dielectric glass)
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(left.x, left.y);
      ctx.closePath();

      const glassGrad = ctx.createLinearGradient(left.x, top.y, right.x, right.y);
      glassGrad.addColorStop(0, 'rgba(8, 12, 22, 0.92)');
      glassGrad.addColorStop(0.5, 'rgba(14, 20, 36, 0.85)');
      glassGrad.addColorStop(1, 'rgba(20, 28, 48, 0.90)');
      ctx.fillStyle = glassGrad;
      ctx.fill();

      // Chamfer Bevel Facets (3 Outer Bevel Strips)
      // Right bevel facet
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(iright.x, iright.y);
      ctx.lineTo(itop.x, itop.y);
      ctx.closePath();
      const rBevel = ctx.createLinearGradient(itop.x, itop.y, right.x, right.y);
      rBevel.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
      rBevel.addColorStop(0.5, 'rgba(160, 210, 255, 0.15)');
      rBevel.addColorStop(1, 'rgba(60, 90, 140, 0.10)');
      ctx.fillStyle = rBevel;
      ctx.fill();

      // Left bevel facet
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(left.x, left.y);
      ctx.lineTo(ileft.x, ileft.y);
      ctx.lineTo(itop.x, itop.y);
      ctx.closePath();
      const lBevel = ctx.createLinearGradient(itop.x, itop.y, left.x, left.y);
      lBevel.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      lBevel.addColorStop(0.5, 'rgba(140, 190, 240, 0.12)');
      lBevel.addColorStop(1, 'rgba(40, 70, 120, 0.08)');
      ctx.fillStyle = lBevel;
      ctx.fill();

      // Bottom base bevel
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(iright.x, iright.y);
      ctx.lineTo(ileft.x, ileft.y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 25, 45, 0.35)';
      ctx.fill();

      // Internal Refracted Light Beam inside the Glass (White-Cyan Core with internal dispersion)
      if (internalRay) {
        // Convert global ray coords to local prism coords
        const cosA = Math.cos(-angle);
        const sinA = Math.sin(-angle);
        const lx1 = (internalRay.inX - cx) * cosA - (internalRay.inY - cy) * sinA;
        const ly1 = (internalRay.inX - cx) * sinA + (internalRay.inY - cy) * cosA;
        const lx2 = (internalRay.outX - cx) * cosA - (internalRay.outY - cy) * sinA;
        const ly2 = (internalRay.outX - cx) * sinA + (internalRay.outY - cy) * cosA;

        // Internal beam core
        const intBeamGrad = ctx.createLinearGradient(lx1, ly1, lx2, ly2);
        intBeamGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        intBeamGrad.addColorStop(0.5, 'rgba(200, 240, 255, 0.95)');
        intBeamGrad.addColorStop(1, 'rgba(120, 210, 255, 0.90)');

        ctx.strokeStyle = intBeamGrad;
        ctx.lineWidth = 5.5 + pulseEnergy * 4.0;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 18 + pulseEnergy * 20;
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();

        // Internal beam halo
        ctx.strokeStyle = 'rgba(80, 180, 255, 0.35)';
        ctx.lineWidth = 14 + pulseEnergy * 6.0;
        ctx.stroke();
      }

      // 4. Polished Glass Specular Reflections (Studio Reflection on Bevels)
      // Right entry edge specular line
      const rightEdge = ctx.createLinearGradient(top.x, top.y, right.x, right.y);
      rightEdge.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      rightEdge.addColorStop(0.3, 'rgba(220, 245, 255, 0.85)');
      rightEdge.addColorStop(0.8, 'rgba(140, 190, 255, 0.3)');
      rightEdge.addColorStop(1, 'rgba(80, 130, 200, 0.1)');
      ctx.strokeStyle = rightEdge;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#aaccff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();

      // Left exit edge specular line
      const leftEdge = ctx.createLinearGradient(top.x, top.y, left.x, left.y);
      leftEdge.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      leftEdge.addColorStop(0.35, 'rgba(200, 235, 255, 0.7)');
      leftEdge.addColorStop(1, 'rgba(60, 110, 180, 0.2)');
      ctx.strokeStyle = leftEdge;
      ctx.lineWidth = 2.0;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(left.x, left.y);
      ctx.stroke();

      // Bottom base edge line
      ctx.strokeStyle = 'rgba(140, 180, 230, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(right.x, right.y);
      ctx.lineTo(left.x, left.y);
      ctx.stroke();

      // Inner bevel chamfer line
      ctx.strokeStyle = 'rgba(200, 235, 255, 0.22)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(itop.x, itop.y);
      ctx.lineTo(iright.x, iright.y);
      ctx.lineTo(ileft.x, ileft.y);
      ctx.closePath();
      ctx.stroke();

      // Corner connector lines
      ctx.beginPath();
      ctx.moveTo(top.x, top.y); ctx.lineTo(itop.x, itop.y);
      ctx.moveTo(right.x, right.y); ctx.lineTo(iright.x, iright.y);
      ctx.moveTo(left.x, left.y); ctx.lineTo(ileft.x, ileft.y);
      ctx.stroke();

      // Top Apex Specular Glint
      const apexGlint = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, 18);
      apexGlint.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      apexGlint.addColorStop(0.35, 'rgba(200, 235, 255, 0.5)');
      apexGlint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = apexGlint;
      ctx.beginPath();
      ctx.arc(top.x, top.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 2. Draw Continuous Volumetric Rainbow Dispersion Ribbon (vgpu Style: Zero Gaps!)
    function drawContinuousSpectralRibbon(
      x0: number, y0: number, width0: number,
      x1: number, y1: number, width1: number,
      angle: number,
      alphaMultiplier: number = 1.0
    ) {
      if (!ctx) return;
      ctx.save();

      // Normal vector perpendicular to the beam direction
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      // We render a dense mesh of continuous slices (zero black gaps)
      const slices = 48;
      for (let s = 0; s < slices; s++) {
        const t0 = s / slices;
        const t1 = (s + 1.05) / slices; // Slightly overlapping to eliminate gaps

        const col = getSpectrumColor(t0);

        // Start segment points (at Prism exit)
        const offset0_a = (t0 - 0.5) * width0;
        const offset0_b = (t1 - 0.5) * width0;
        const p0a = { x: x0 + perpX * offset0_a, y: y0 + perpY * offset0_a };
        const p0b = { x: x0 + perpX * offset0_b, y: y0 + perpY * offset0_b };

        // End segment points (at target)
        const offset1_a = (t0 - 0.5) * width1;
        const offset1_b = (t1 - 0.5) * width1;
        const p1a = { x: x1 + perpX * offset1_a, y: y1 + perpY * offset1_a };
        const p1b = { x: x1 + perpX * offset1_b, y: y1 + perpY * offset1_b };

        // Quad slice
        ctx.beginPath();
        ctx.moveTo(p0a.x, p0a.y);
        ctx.lineTo(p1a.x, p1a.y);
        ctx.lineTo(p1b.x, p1b.y);
        ctx.lineTo(p0b.x, p0b.y);
        ctx.closePath();

        const a = (0.92 + pulseEnergy * 0.35) * alphaMultiplier;
        ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${a})`;
        ctx.shadowColor = `rgba(${col.r}, ${col.g}, ${col.b}, 0.6)`;
        ctx.shadowBlur = 8;
        ctx.fill();
      }

      // Volumetric soft outer bloom covering the entire ribbon
      const bloomGrad = ctx.createLinearGradient(
        x0 - perpX * width0 * 0.6, y0 - perpY * width0 * 0.6,
        x0 + perpX * width0 * 0.6, y0 + perpY * width0 * 0.6
      );
      bloomGrad.addColorStop(0, 'rgba(255, 30, 50, 0.15)');
      bloomGrad.addColorStop(0.5, 'rgba(0, 230, 150, 0.18)');
      bloomGrad.addColorStop(1, 'rgba(124, 77, 255, 0.15)');

      ctx.beginPath();
      ctx.moveTo(x0 - perpX * width0 * 0.6, y0 - perpY * width0 * 0.6);
      ctx.lineTo(x1 - perpX * width1 * 0.6, y1 - perpY * width1 * 0.6);
      ctx.lineTo(x1 + perpX * width1 * 0.6, y1 + perpY * width1 * 0.6);
      ctx.lineTo(x0 + perpX * width0 * 0.6, y0 + perpY * width0 * 0.6);
      ctx.closePath();
      ctx.fillStyle = bloomGrad;
      ctx.shadowBlur = 16;
      ctx.fill();

      ctx.restore();
    }

    const render = () => {
      animId = requestAnimationFrame(render);

      // Smooth inertia
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
      for (const m of particles) {
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

      // 2. Optical Coordinates & Geometries
      // --- Prism 1 (Dispersing Prism: Positioned Upper Right) ---
      const p1R = Math.min(w, h) * 0.21;
      const p1X = w * 0.76 + currentX * 14;
      const p1Y = h * 0.35 + currentY * 10;
      const p1Angle = -0.06;

      // --- Prism 2 (Receiving & Second Dispersion: Positioned Lower Center) ---
      const p2R = Math.min(w, h) * 0.19;
      const p2X = w * 0.44 + currentX * 18;
      const p2Y = h * 0.72 + currentY * 12;
      const p2Angle = 0.12;

      // Incident ray entry into Prism 1 (on its right facet)
      const p1EntryX = p1X + p1R * 0.42;
      const p1EntryY = p1Y - p1R * 0.05;

      // Exit from Prism 1 (on its left facet)
      const p1ExitX = p1X - p1R * 0.45;
      const p1ExitY = p1Y + p1R * 0.08;

      // Rainbow arrival at Prism 2 (on its right facet)
      const p2EntryX = p2X + p2R * 0.42;
      const p2EntryY = p2Y - p2R * 0.08;

      // Exit from Prism 2 (on its left facet)
      const p2ExitX = p2X - p2R * 0.45;
      const p2ExitY = p2Y + p2R * 0.06;

      ctx.save();

      // --- A. INCIDENT WHITE LASER BEAM (Shoots into Prism 1 from off-screen top-right) ---
      const incSourceX = w * 1.05;
      const incSourceY = h * 0.08 + currentY * 18;

      const incGrad = ctx.createLinearGradient(incSourceX, incSourceY, p1EntryX, p1EntryY);
      incGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      incGrad.addColorStop(1, 'rgba(240, 248, 255, 1.0)');

      ctx.strokeStyle = incGrad;
      ctx.lineWidth = 4.5 + pulseEnergy * 4.0;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20 + pulseEnergy * 25;
      ctx.beginPath();
      ctx.moveTo(incSourceX, incSourceY);
      ctx.lineTo(p1EntryX, p1EntryY);
      ctx.stroke();

      // Prism 1 Entry Caustic Flash
      const p1EntryGlint = ctx.createRadialGradient(p1EntryX, p1EntryY, 0, p1EntryX, p1EntryY, 32 + pulseEnergy * 35);
      p1EntryGlint.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      p1EntryGlint.addColorStop(0.35, 'rgba(180, 230, 255, 0.5)');
      p1EntryGlint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = p1EntryGlint;
      ctx.beginPath();
      ctx.arc(p1EntryX, p1EntryY, 32 + pulseEnergy * 35, 0, Math.PI * 2);
      ctx.fill();

      // Fresnel Specular Reflection Ray (Bouncing off Prism 1 entry facet)
      const reflX = p1EntryX + 180;
      const reflY = p1EntryY - 140;
      const reflGrad = ctx.createLinearGradient(p1EntryX, p1EntryY, reflX, reflY);
      reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      reflGrad.addColorStop(1, 'rgba(180, 225, 255, 0.0)');
      ctx.strokeStyle = reflGrad;
      ctx.lineWidth = 2.2 + pulseEnergy * 2.0;
      ctx.shadowColor = '#aaccff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(p1EntryX, p1EntryY);
      ctx.lineTo(reflX, reflY);
      ctx.stroke();

      // --- B. STAGE 1 DISPERSION (Prism 1 -> Prism 2) ---
      // Dense, continuous, gapless volumetric rainbow ribbon (vgpu Style!)
      const dx12 = p2EntryX - p1ExitX;
      const dy12 = p2EntryY - p1ExitY;
      const angle12 = Math.atan2(dy12, dx12);

      drawContinuousSpectralRibbon(
        p1ExitX, p1ExitY, 26,             // Narrow at Prism 1 exit
        p2EntryX, p2EntryY, 52,           // Fanning out across the gap to Prism 2
        angle12,
        1.0
      );

      // Prism 2 Entry Multi-Spectral Caustic Glow
      const p2EntryGlint = ctx.createRadialGradient(p2EntryX, p2EntryY, 0, p2EntryX, p2EntryY, 40 + pulseEnergy * 45);
      p2EntryGlint.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      p2EntryGlint.addColorStop(0.35, 'rgba(120, 220, 255, 0.5)');
      p2EntryGlint.addColorStop(0.7, 'rgba(255, 180, 80, 0.2)');
      p2EntryGlint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = p2EntryGlint;
      ctx.beginPath();
      ctx.arc(p2EntryX, p2EntryY, 40 + pulseEnergy * 45, 0, Math.PI * 2);
      ctx.fill();

      // --- C. STAGE 2 DISPERSION: Secondary Physical Dispersion Exiting Prism 2 ---
      // The light refracts further inside Prism 2 and disperses outward in an expansive rainbow fan across to the left!
      const secAngle = Math.PI - 0.12 + currentY * 0.04;
      const secLen = w * 0.56;
      const secEndX = p2ExitX + Math.cos(secAngle) * secLen;
      const secEndY = p2ExitY + Math.sin(secAngle) * secLen;

      drawContinuousSpectralRibbon(
        p2ExitX, p2ExitY, 32,             // Starts at Prism 2 exit facet
        secEndX, secEndY, 135,            // Expands gracefully into a wide, luminous physical spectrum across the left!
        secAngle,
        0.95
      );

      // Prism 2 Exit Caustic Flare
      const p2ExitGlint = ctx.createRadialGradient(p2ExitX, p2ExitY, 0, p2ExitX, p2ExitY, 34 + pulseEnergy * 35);
      p2ExitGlint.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      p2ExitGlint.addColorStop(0.4, 'rgba(0, 229, 255, 0.4)');
      p2ExitGlint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = p2ExitGlint;
      ctx.beginPath();
      ctx.arc(p2ExitX, p2ExitY, 34 + pulseEnergy * 35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 3. Render Both Transparent 3D Beveled Glass Prisms (Matching Image #1)
      // Prism 1 (Dispersing: Upper Right)
      drawBeveledGlassPrism(
        p1X, p1Y, p1R, p1Angle,
        { inX: p1EntryX, inY: p1EntryY, outX: p1ExitX, outY: p1ExitY }
      );

      // Prism 2 (Receiving & Secondary Dispersion: Lower Mid-Right)
      drawBeveledGlassPrism(
        p2X, p2Y, p2R, p2Angle,
        { inX: p2EntryX, inY: p2EntryY, outX: p2ExitX, outY: p2ExitY }
      );
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
  aria-label="rakuyou's labyrinth dual-prism optical physical dispersion hero"
>
  <!-- Unified Real-time Optical Physics Canvas: Transparent Prisms & Continuous Wavelength Dispersion -->
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
