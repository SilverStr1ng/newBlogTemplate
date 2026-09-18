<script lang="ts">
  import { onMount } from 'svelte';
  import diamondData from './diamond-model.json';

  let heroContainer: HTMLDivElement | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  let animId = 0;

  // Pointer state for interactive light drawing & 3D tilt
  let isPointerDown = false;
  let pointerX = 0.5;
  let pointerY = 0.5;

  interface UserStroke {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    color: string;
    rgb: { r: number; g: number; b: number };
    life: number;
  }
  const userStrokes: UserStroke[] = [];

  let lastX = 0;
  let lastY = 0;

  const strokePalette = [
    { hex: '#00e5ff', r: 0, g: 229, b: 255 },   // Cyan
    { hex: '#ff3366', r: 255, g: 51, b: 102 },  // Neon Rose
    { hex: '#ffea00', r: 255, g: 234, b: 0 },   // Electric Yellow
    { hex: '#00ff66', r: 0, g: 255, b: 102 },   // Neon Green
    { hex: '#aa44ff', r: 170, g: 68, b: 255 },  // Purple
  ];
  let strokeColorIndex = 0;

  // Diamond 3D geometry from dflat-D9eRXupj.glb
  const rawVerts = diamondData.vertices;
  const rawIndices = diamondData.indices;
  const numTriangles = rawIndices.length / 3;

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

    const handlePointerDown = (e: MouseEvent) => {
      isPointerDown = true;
      const rect = canvas.getBoundingClientRect();
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
      strokeColorIndex = (strokeColorIndex + 1) % strokePalette.length;
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const currX = e.clientX - rect.left;
      const currY = e.clientY - rect.top;

      pointerX = currX / canvas.width;
      pointerY = currY / canvas.height;

      if (isPointerDown) {
        const dist = Math.hypot(currX - lastX, currY - lastY);
        // Only record meaningful drag segments
        if (dist > 3) {
          const colorObj = strokePalette[strokeColorIndex];
          userStrokes.push({
            x0: lastX,
            y0: lastY,
            x1: currX,
            y1: currY,
            color: colorObj.hex,
            rgb: colorObj,
            life: 1.0,
          });
          if (userStrokes.length > 35) userStrokes.shift();
          lastX = currX;
          lastY = currY;
        }
      } else {
        lastX = currX;
        lastY = currY;
      }
    };

    const handlePointerUp = () => {
      isPointerDown = false;
    };

    canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    let startTime = performance.now();

    const render = () => {
      animId = requestAnimationFrame(render);
      const elapsed = (performance.now() - startTime) * 0.001;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Dark Architectural Floor Grid (48px cell, 1px line width matching vgpu grid_albedo)
      const cellSize = 48;
      ctx.save();
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;

      // Vertical grid lines
      for (let x = (w * 0.5) % cellSize; x < w; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontal grid lines
      for (let y = (h * 0.5) % cellSize; y < h; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 2. Element Positions (https://vgpu.sh/examples/radiance-cascades)
      const centerX = w * 0.55;
      const centerY = h * 0.50;
      const diamondScale = Math.min(w, h) * 0.16;

      // Fixed Neon Occluders/Emitters from vgpu example:
      const g0 = { x: centerX - w * 0.25, y: centerY + h * 0.20 };
      const g1 = { x: centerX - w * 0.12, y: centerY - h * 0.14 };

      const p0 = { x: centerX + w * 0.16, y: centerY - h * 0.22 };
      const p1 = { x: centerX + w * 0.30, y: centerY + h * 0.18 };

      // Helper to cast soft penumbra shadows cast by the central Diamond Emitter
      function castShadow(x0: number, y0: number, x1: number, y1: number, length: number, alphaMultiplier: number = 1.0) {
        if (!ctx) return;
        const d0x = x0 - centerX, d0y = y0 - centerY;
        const d1x = x1 - centerX, d1y = y1 - centerY;
        const dist0 = Math.hypot(d0x, d0y) || 1;
        const dist1 = Math.hypot(d1x, d1y) || 1;

        const shadowP0 = { x: x0 + (d0x / dist0) * length, y: y0 + (d0y / dist0) * length };
        const shadowP1 = { x: x1 + (d1x / dist1) * length, y: y1 + (d1y / dist1) * length };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(shadowP1.x, shadowP1.y);
        ctx.lineTo(shadowP0.x, shadowP0.y);
        ctx.closePath();

        const shadowGrad = ctx.createLinearGradient((x0 + x1) / 2, (y0 + y1) / 2, (shadowP0.x + shadowP1.x) / 2, (shadowP0.y + shadowP1.y) / 2);
        shadowGrad.addColorStop(0, `rgba(5, 6, 9, ${0.85 * alphaMultiplier})`);
        shadowGrad.addColorStop(0.5, `rgba(5, 6, 9, ${0.55 * alphaMultiplier})`);
        shadowGrad.addColorStop(1, 'rgba(5, 6, 9, 0.0)');
        ctx.fillStyle = shadowGrad;
        ctx.fill();
        ctx.restore();
      }

      // --- 3. RADIANCE CASCADES: GLOBAL ILLUMINATION & LIGHT BLEEDING ---
      // A. Green Light Bleed onto Floor Grid
      const greenRad = ctx.createRadialGradient((g0.x + g1.x) / 2, (g0.y + g1.y) / 2, 10, (g0.x + g1.x) / 2, (g0.y + g1.y) / 2, w * 0.38);
      greenRad.addColorStop(0, 'rgba(34, 229, 119, 0.30)');
      greenRad.addColorStop(0.35, 'rgba(25, 180, 95, 0.12)');
      greenRad.addColorStop(0.7, 'rgba(15, 120, 60, 0.03)');
      greenRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = greenRad;
      ctx.fillRect(0, 0, w, h);

      // B. Purple/Magenta Light Bleed onto Floor Grid
      const purpleRad = ctx.createRadialGradient((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 10, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, w * 0.38);
      purpleRad.addColorStop(0, 'rgba(216, 70, 240, 0.28)');
      purpleRad.addColorStop(0.35, 'rgba(170, 45, 200, 0.11)');
      purpleRad.addColorStop(0.7, 'rgba(110, 20, 140, 0.03)');
      purpleRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = purpleRad;
      ctx.fillRect(0, 0, w, h);

      // C. Central Diamond Emitter Radiance (Radiates Warm White Light across the Grid)
      const diamondRad = ctx.createRadialGradient(centerX, centerY, diamondScale * 0.3, centerX, centerY, w * 0.45);
      diamondRad.addColorStop(0, 'rgba(255, 248, 235, 0.45)');
      diamondRad.addColorStop(0.25, 'rgba(255, 235, 210, 0.20)');
      diamondRad.addColorStop(0.6, 'rgba(200, 230, 255, 0.05)');
      diamondRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = diamondRad;
      ctx.fillRect(0, 0, w, h);

      // D. Cast Soft Penumbra Shadows behind the Fixed Neon Bars
      castShadow(g0.x, g0.y, g1.x, g1.y, w * 0.4, 1.0);
      castShadow(p0.x, p0.y, p1.x, p1.y, w * 0.4, 1.0);

      // --- 4. USER STROKES PARTICIPATING IN RADIANCE CASCADES ---
      // Update decay and participate in: 1) Radiance Light Bleed, 2) Shadow Casting, 3) Visual Tube
      for (let i = userStrokes.length - 1; i >= 0; i--) {
        const s = userStrokes[i];
        s.life -= 0.0035; // Fades out over ~4 seconds
        if (s.life <= 0) {
          userStrokes.splice(i, 1);
          continue;
        }

        const midX = (s.x0 + s.x1) * 0.5;
        const midY = (s.y0 + s.y1) * 0.5;
        const strokeLen = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);

        // A. RADIANCE CASCADES: Stroke bleeds colored light onto the grid floor!
        const bleedR = Math.max(strokeLen * 2.0, 70) * s.life;
        const bleedGrad = ctx.createRadialGradient(midX, midY, 4, midX, midY, bleedR);
        bleedGrad.addColorStop(0, `rgba(${s.rgb.r}, ${s.rgb.g}, ${s.rgb.b}, ${0.32 * s.life})`);
        bleedGrad.addColorStop(0.4, `rgba(${s.rgb.r}, ${s.rgb.g}, ${s.rgb.b}, ${0.12 * s.life})`);
        bleedGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bleedGrad;
        ctx.fillRect(0, 0, w, h);

        // B. RADIANCE CASCADES: Stroke acts as an occluder, casting soft penumbra shadow from Diamond light!
        castShadow(s.x0, s.y0, s.x1, s.y1, w * 0.35, s.life * 0.85);

        // C. Stroke Visual Emitter Core (Glowing neon tube with white-hot center)
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 5.0 * s.life;
        ctx.lineCap = 'round';
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 20 * s.life;
        ctx.globalAlpha = s.life;

        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();

        // White-hot core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0 * s.life;
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.restore();
      }

      // --- 5. RENDER FIXED NEON EMITTER BARS ---
      // A. Green Neon Bar
      ctx.save();
      ctx.strokeStyle = '#22e577';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#22e577';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(g1.x, g1.y);
      ctx.stroke();

      ctx.strokeStyle = '#e6fff0';
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();

      // B. Purple/Magenta Neon Bar
      ctx.save();
      ctx.strokeStyle = '#d846f0';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#d846f0';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.strokeStyle = '#fbf0ff';
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();

      // --- 6. RENDER CENTRAL 3D GLB DIAMOND EMITTER (From dflat-D9eRXupj.glb) ---
      const rotX = Math.sin(elapsed * 0.4) * 0.15 + (pointerY - 0.5) * 0.35;
      const rotY = elapsed * 0.45 + (pointerX - 0.5) * 0.75;

      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

      const numVerts = rawVerts.length / 3;
      const transformedVerts: { x: number; y: number; z: number; sx: number; sy: number }[] = [];

      for (let i = 0; i < numVerts; i++) {
        let x = rawVerts[i * 3] * diamondScale;
        let y = rawVerts[i * 3 + 1] * diamondScale;
        let z = rawVerts[i * 3 + 2] * diamondScale;

        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;
        let x2 = x * cosY + z1 * sinY;
        let z2 = -x * sinY + z1 * cosY;

        transformedVerts.push({
          x: x2, y: y1, z: z2,
          sx: centerX + x2,
          sy: centerY - y1, // Invert Y for canvas coordinate space
        });
      }

      interface Facet {
        p0: typeof transformedVerts[0];
        p1: typeof transformedVerts[0];
        p2: typeof transformedVerts[0];
        centerZ: number;
        normalZ: number;
      }

      const triangles: Facet[] = [];
      for (let t = 0; t < numTriangles; t++) {
        const i0 = rawIndices[t * 3];
        const i1 = rawIndices[t * 3 + 1];
        const i2 = rawIndices[t * 3 + 2];

        const p0 = transformedVerts[i0];
        const p1 = transformedVerts[i1];
        const p2 = transformedVerts[i2];

        const nz = (p1.sx - p0.sx) * (p2.sy - p0.sy) - (p1.sy - p0.sy) * (p2.sx - p0.sx);

        triangles.push({
          p0, p1, p2,
          centerZ: (p0.z + p1.z + p2.z) / 3,
          normalZ: nz,
        });
      }

      // Depth sorting
      triangles.sort((a, b) => a.centerZ - b.centerZ);

      // Render 3D Diamond Model Facets as an Intense Luminous Emitter
      ctx.save();

      // Outer diamond brilliant radiance aura
      const diamondAura = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, diamondScale * 1.65);
      diamondAura.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      diamondAura.addColorStop(0.3, 'rgba(220, 245, 255, 0.42)');
      diamondAura.addColorStop(0.7, 'rgba(100, 200, 255, 0.08)');
      diamondAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = diamondAura;
      ctx.beginPath();
      ctx.arc(centerX, centerY, diamondScale * 1.65, 0, Math.PI * 2);
      ctx.fill();

      // Render all facets of the dflat diamond model
      for (const tri of triangles) {
        ctx.beginPath();
        ctx.moveTo(tri.p0.sx, tri.p0.sy);
        ctx.lineTo(tri.p1.sx, tri.p1.sy);
        ctx.lineTo(tri.p2.sx, tri.p2.sy);
        ctx.closePath();

        const isFront = tri.normalZ < 0; // Screen-space facing

        if (isFront) {
          // Front-facing radiant facet: warm white emitter with diamond facet sparkle
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 18;
          ctx.fill();

          // Cut facet edge glints
          ctx.strokeStyle = 'rgba(180, 235, 255, 0.92)';
          ctx.lineWidth = 1.25;
          ctx.shadowBlur = 8;
          ctx.stroke();
        } else {
          // Back-facing facet: inner crystal refraction depth
          ctx.fillStyle = 'rgba(200, 238, 255, 0.38)';
          ctx.fill();

          ctx.strokeStyle = 'rgba(120, 195, 255, 0.28)';
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      }

      ctx.restore();

      // 7. Pointer Indicator when hovering
      if (pointerX > 0 && pointerY > 0 && !isPointerDown) {
        const px = pointerX * w;
        const py = pointerY * h;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  });
</script>

<div
  bind:this={heroContainer}
  class="relative w-full h-[520px] sm:h-[580px] md:h-[640px] bg-black overflow-hidden select-none flex items-center cursor-crosshair"
  role="region"
  aria-label="rakuyou's labyrinth radiance cascades diamond hero"
>
  <!-- Native Radiance Cascades Canvas with dflat-D9eRXupj.glb Diamond Emitter -->
  <canvas
    bind:this={canvasRef}
    class="absolute inset-0 w-full h-full block"
  ></canvas>

  <!-- Bottom subtle fade into dark page content -->
  <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10"></div>

  <!-- Noise Grain Overlay -->
  <div class="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-20 z-10"></div>

  <!-- Foreground Content: Positioned purely in the upper-left dark void, zero clutter, 100% crisp -->
  <div class="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 pointer-events-none">
    <div class="max-w-xl pb-12">
      <!-- Title: Upright, Elegant Serif strictly on ONE LINE -->
      <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-serif font-normal tracking-tight text-white whitespace-nowrap leading-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)]">
        rakuyou’s labyrinth
      </h1>

      <!-- One-line clean description, zero marketing fluff -->
      <p class="mt-4 text-sm sm:text-base text-zinc-300/90 font-light tracking-wide truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
        A personal notebook on graphics, radiance cascades & real-time optics.
      </p>

      <!-- Minimal draw light hint from vgpu radiance-cascades example -->
      <span class="mt-3 inline-block text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
        DRAW LIGHT / DRAG TO EMIT RADIANCE
      </span>
    </div>
  </div>
</div>
