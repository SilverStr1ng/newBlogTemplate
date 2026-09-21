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
    { hex: '#00e5ff', r: 0, g: 229, b: 255 },   // Electric Cyan
    { hex: '#ff3366', r: 255, g: 51, b: 102 },  // Neon Rose
    { hex: '#ffea00', r: 255, g: 234, b: 0 },   // Electric Yellow
    { hex: '#00ff66', r: 0, g: 255, b: 102 },   // Neon Green
    { hex: '#bf5af2', r: 191, g: 90, b: 242 },  // Neon Purple
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
        // Record smooth continuous light drag segments
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
          if (userStrokes.length > 40) userStrokes.shift();
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

    const startTime = performance.now();
    let lastFrameTime = startTime;
    let mazeTime = 0;
    let nextRebuild = 10 + Math.random() * 10;
    let rebuildStart = 0;
    let rebuildDuration = 1.5;
    let rebuilding = false;
    let expanded = false;

    // Persistent wall identities: change their poses, never replace the maze mid-frame.
    const walls = [
      { x: -0.38, y: -0.30, angle: 0, length: 0.24 },
      { x: -0.12, y: -0.34, angle: 0, length: 0.20 },
      { x: 0.18, y: -0.30, angle: 0, length: 0.26 },
      { x: 0.40, y: -0.16, angle: Math.PI / 2, length: 0.22 },
      { x: 0.34, y: 0.12, angle: Math.PI / 2, length: 0.22 },
      { x: 0.20, y: 0.32, angle: 0, length: 0.24 },
      { x: -0.10, y: 0.34, angle: 0, length: 0.20 },
      { x: -0.38, y: 0.22, angle: Math.PI / 2, length: 0.20 },
      { x: -0.24, y: 0.02, angle: Math.PI / 2, length: 0.20 },
      { x: 0.04, y: -0.18, angle: 0, length: 0.18 },
      { x: 0.22, y: 0.02, angle: Math.PI / 2, length: 0.18 },
      { x: -0.02, y: 0.18, angle: 0, length: 0.20 },
    ];
    let fromPoses = walls.map(() => 0);
    let toPoses = [...fromPoses];

    const resumeClock = () => { lastFrameTime = performance.now(); };
    document.addEventListener('visibilitychange', resumeClock);

    const render = () => {
      animId = requestAnimationFrame(render);
      const now = performance.now();
      const elapsed = (now - startTime) * 0.001;
      if (!document.hidden) mazeTime += (now - lastFrameTime) * 0.001;
      lastFrameTime = now;

      if (!rebuilding && mazeTime >= nextRebuild) {
        rebuilding = true;
        rebuildStart = mazeTime;
        rebuildDuration = 1 + Math.random();
        nextRebuild = rebuildStart + 10 + Math.random() * 10;
        expanded = !expanded;
        fromPoses = [...toPoses];
        toPoses = walls.map(() => expanded ? 0.65 + Math.random() * 0.35 : 0);
      }
      const progress = rebuilding ? Math.min(1, (mazeTime - rebuildStart) / rebuildDuration) : 1;
      // Quintic easing brings each mechanism to rest without a velocity snap.
      const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
      if (progress === 1) rebuilding = false;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Dark Architectural Floor Grid (from vgpu grid_albedo: 48px cell, 1px line width)
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

      // 2. Element Coordinates
      const centerX = w * 0.58;
      const centerY = h * 0.48;
      const diamondScale = Math.min(w, h) * 0.125;
      const mazeScale = Math.min(w * 0.88, h);
      const mazeSegments = walls.flatMap((wall, i) => {
        const pose = fromPoses[i] + (toPoses[i] - fromPoses[i]) * eased;
        let { x, y, angle, length } = wall;
        const motion = i % 4;
        if (motion === 0) x += pose * 0.10; // Sliding rail
        if (motion === 1) angle += pose * Math.PI / 2; // Rotary partition
        if (motion === 3) length *= 1 - pose * 0.65; // Telescoping wall
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const point = (offset: number) => ({
          x: centerX + (x + dx * offset) * mazeScale,
          y: centerY + (y + dy * offset) * mazeScale,
        });
        const half = length / 2;
        if (motion === 2) {
          // Two rigid leaves slide apart to open a passage.
          const gap = pose * 0.07;
          return [
            { a: point(-half - gap), b: point(-gap) },
            { a: point(gap), b: point(half + gap) },
          ];
        }
        return [{ a: point(-half), b: point(half) }];
      });

      // Fixed Neon Occluders/Emitters:
      // Green neon bar: positioned lower-left, away from the title area
      const g0 = { x: centerX - w * 0.28, y: centerY + h * 0.28 };
      const g1 = { x: centerX - w * 0.14, y: centerY - h * 0.02 };

      // Purple neon bar: positioned upper-right
      const p0 = { x: centerX + w * 0.16, y: centerY - h * 0.24 };
      const p1 = { x: centerX + w * 0.32, y: centerY + h * 0.16 };

      // Universal Physical Occlusion Shadow Generator (Projects penumbra shadow away from any light source!)
      function castOcclusionShadow(
        lightX: number, lightY: number,
        barX0: number, barY0: number,
        barX1: number, barY1: number,
        length: number,
        intensity: number
      ) {
        if (!ctx || intensity <= 0.01) return;
        const d0x = barX0 - lightX, d0y = barY0 - lightY;
        const d1x = barX1 - lightX, d1y = barY1 - lightY;
        const dist0 = Math.hypot(d0x, d0y) || 1;
        const dist1 = Math.hypot(d1x, d1y) || 1;

        const shadowP0 = { x: barX0 + (d0x / dist0) * length, y: barY0 + (d0y / dist0) * length };
        const shadowP1 = { x: barX1 + (d1x / dist1) * length, y: barY1 + (d1y / dist1) * length };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(barX0, barY0);
        ctx.lineTo(barX1, barY1);
        ctx.lineTo(shadowP1.x, shadowP1.y);
        ctx.lineTo(shadowP0.x, shadowP0.y);
        ctx.closePath();

        const shadowGrad = ctx.createLinearGradient(
          (barX0 + barX1) / 2, (barY0 + barY1) / 2,
          (shadowP0.x + shadowP1.x) / 2, (shadowP0.y + shadowP1.y) / 2
        );
        shadowGrad.addColorStop(0, `rgba(5, 6, 9, ${0.48 * intensity})`);
        shadowGrad.addColorStop(0.5, `rgba(5, 6, 9, ${0.22 * intensity})`);
        shadowGrad.addColorStop(1, 'rgba(5, 6, 9, 0.0)');
        ctx.fillStyle = shadowGrad;
        ctx.fill();
        ctx.restore();
      }

      // --- 3. RADIANCE CASCADES: MULTI-BOUNCE GLOBAL ILLUMINATION ---
      // A. Green Light Bleed onto Floor Grid
      const greenRad = ctx.createRadialGradient(
        (g0.x + g1.x) / 2, (g0.y + g1.y) / 2, 8,
        (g0.x + g1.x) / 2, (g0.y + g1.y) / 2, w * 0.36
      );
      greenRad.addColorStop(0, 'rgba(34, 229, 119, 0.28)');
      greenRad.addColorStop(0.35, 'rgba(25, 180, 95, 0.10)');
      greenRad.addColorStop(0.7, 'rgba(15, 120, 60, 0.025)');
      greenRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = greenRad;
      ctx.fillRect(0, 0, w, h);

      // B. Purple/Magenta Light Bleed onto Floor Grid
      const purpleRad = ctx.createRadialGradient(
        (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 8,
        (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, w * 0.36
      );
      purpleRad.addColorStop(0, 'rgba(191, 90, 242, 0.26)');
      purpleRad.addColorStop(0.35, 'rgba(150, 60, 200, 0.09)');
      purpleRad.addColorStop(0.7, 'rgba(100, 20, 140, 0.025)');
      purpleRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = purpleRad;
      ctx.fillRect(0, 0, w, h);

      // C. Central Diamond Emitter Radiance
      const diamondRad = ctx.createRadialGradient(centerX, centerY, diamondScale * 0.3, centerX, centerY, w * 0.44);
      diamondRad.addColorStop(0, 'rgba(255, 248, 235, 0.42)');
      diamondRad.addColorStop(0.25, 'rgba(255, 235, 210, 0.18)');
      diamondRad.addColorStop(0.6, 'rgba(200, 230, 255, 0.04)');
      diamondRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = diamondRad;
      ctx.fillRect(0, 0, w, h);

      // D. Shadows of Fixed Bars Cast by the Central Diamond
      castOcclusionShadow(centerX, centerY, g0.x, g0.y, g1.x, g1.y, w * 0.36, 1.0);
      castOcclusionShadow(centerX, centerY, p0.x, p0.y, p1.x, p1.y, w * 0.36, 1.0);
      const castMazeShadows = (x: number, y: number, intensity: number) => {
        for (const { a, b } of mazeSegments) {
          castOcclusionShadow(x, y, a.x, a.y, b.x, b.y, mazeScale * 0.65, intensity);
        }
      };
      castMazeShadows(centerX, centerY, 0.85);
      castMazeShadows((g0.x + g1.x) / 2, (g0.y + g1.y) / 2, 0.4);
      castMazeShadows((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0.4);

      // --- 4. USER DRAWN LIGHT STROKES: FULL MUTUAL RADIANCE CASCADES INTERACTION ---
      // User strokes illuminate the room AND cast shadows when hitting occluders!
      let userIlluminatedGreenGlow: { color: string; intensity: number } | null = null;
      let userIlluminatedPurpleGlow: { color: string; intensity: number } | null = null;

      for (let i = userStrokes.length - 1; i >= 0; i--) {
        const s = userStrokes[i];
        s.life -= 0.0035; // Fades out smoothly over ~4 seconds
        if (s.life <= 0) {
          userStrokes.splice(i, 1);
          continue;
        }

        const midX = (s.x0 + s.x1) * 0.5;
        const midY = (s.y0 + s.y1) * 0.5;
        const strokeLen = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);

        // A. Stroke bleeds colored light onto the grid floor in 360 degrees
        const bleedR = Math.max(strokeLen * 2.2, 85) * s.life;
        const bleedGrad = ctx.createRadialGradient(midX, midY, 2, midX, midY, bleedR);
        bleedGrad.addColorStop(0, `rgba(${s.rgb.r}, ${s.rgb.g}, ${s.rgb.b}, ${0.38 * s.life})`);
        bleedGrad.addColorStop(0.35, `rgba(${s.rgb.r}, ${s.rgb.g}, ${s.rgb.b}, ${0.15 * s.life})`);
        bleedGrad.addColorStop(0.7, `rgba(${s.rgb.r}, ${s.rgb.g}, ${s.rgb.b}, ${0.03 * s.life})`);
        bleedGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bleedGrad;
        ctx.fillRect(0, 0, w, h);
        castMazeShadows(midX, midY, s.life * 0.45);

        // B. Light bounce onto the Green Bar and Purple Bar:
        // User strokes illuminate the facing side of the neon bars!
        const distToGreen = Math.hypot(midX - (g0.x + g1.x) / 2, midY - (g0.y + g1.y) / 2);
        if (distToGreen < w * 0.35) {
          const bounceStrength = (1.0 - distToGreen / (w * 0.35)) * s.life;
          userIlluminatedGreenGlow = {
            color: s.color,
            intensity: Math.max(userIlluminatedGreenGlow?.intensity || 0, bounceStrength),
          };
        }

        const distToPurple = Math.hypot(midX - (p0.x + p1.x) / 2, midY - (p0.y + p1.y) / 2);
        if (distToPurple < w * 0.35) {
          const bounceStrength = (1.0 - distToPurple / (w * 0.35)) * s.life;
          userIlluminatedPurpleGlow = {
            color: s.color,
            intensity: Math.max(userIlluminatedPurpleGlow?.intensity || 0, bounceStrength),
          };
        }

        // C. Luminous Neon Emitter Tube (White-hot core + colored neon bloom)
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 5.5 * s.life;
        ctx.lineCap = 'round';
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 22 * s.life;
        ctx.globalAlpha = s.life;

        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();

        // White-hot inner core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2 * s.life;
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.restore();
      }

      // The visible walls and their shadows share the same interpolated endpoints.
      ctx.save();
      ctx.lineCap = 'butt';
      for (const { a, b } of mazeSegments) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#10191e';
        ctx.stroke();
        const edge = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        edge.addColorStop(0, 'rgba(94, 207, 170, 0.65)');
        edge.addColorStop(1, 'rgba(172, 143, 213, 0.65)');
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = edge;
        ctx.stroke();
      }
      ctx.restore();

      // --- 5. RENDER FIXED NEON EMITTER BARS (With Light Bounce from User Strokes!) ---
      // A. Green Neon Bar
      ctx.save();
      ctx.strokeStyle = '#22e577';
      ctx.lineWidth = 5.2;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#22e577';
      ctx.shadowBlur = 26;
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(g1.x, g1.y);
      ctx.stroke();

      ctx.strokeStyle = '#e6fff0';
      ctx.lineWidth = 2.4;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // If user drew a stroke near the green bar, render color bounce highlight on the bar!
      if (userIlluminatedGreenGlow && userIlluminatedGreenGlow.intensity > 0.05) {
        ctx.strokeStyle = userIlluminatedGreenGlow.color;
        ctx.lineWidth = 7.0;
        ctx.shadowColor = userIlluminatedGreenGlow.color;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = userIlluminatedGreenGlow.intensity * 0.6;
        ctx.stroke();
      }
      ctx.restore();

      // B. Purple Neon Bar
      ctx.save();
      ctx.strokeStyle = '#bf5af2';
      ctx.lineWidth = 5.2;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#bf5af2';
      ctx.shadowBlur = 26;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.strokeStyle = '#fbf0ff';
      ctx.lineWidth = 2.4;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // If user drew a stroke near the purple bar, render color bounce highlight on the bar!
      if (userIlluminatedPurpleGlow && userIlluminatedPurpleGlow.intensity > 0.05) {
        ctx.strokeStyle = userIlluminatedPurpleGlow.color;
        ctx.lineWidth = 7.0;
        ctx.shadowColor = userIlluminatedPurpleGlow.color;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = userIlluminatedPurpleGlow.intensity * 0.6;
        ctx.stroke();
      }
      ctx.restore();

      // --- 6. RENDER CENTRAL 3D GLB DIAMOND EMITTER (From dflat-D9eRXupj.glb) ---
      const rotX = Math.sin(elapsed * 0.4) * 0.14 + (pointerY - 0.5) * 0.32;
      const rotY = elapsed * 0.42 + (pointerX - 0.5) * 0.7;

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
          sy: centerY - y1,
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

      // Depth sorting (back-to-front)
      triangles.sort((a, b) => a.centerZ - b.centerZ);

      ctx.save();

      // Outer diamond brilliant radiance aura
      const diamondAura = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, diamondScale * 1.6);
      diamondAura.addColorStop(0, 'rgba(255, 255, 255, 0.90)');
      diamondAura.addColorStop(0.3, 'rgba(220, 245, 255, 0.42)');
      diamondAura.addColorStop(0.7, 'rgba(100, 200, 255, 0.08)');
      diamondAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = diamondAura;
      ctx.beginPath();
      ctx.arc(centerX, centerY, diamondScale * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Render 3D Diamond Model Facets
      for (const tri of triangles) {
        ctx.beginPath();
        ctx.moveTo(tri.p0.sx, tri.p0.sy);
        ctx.lineTo(tri.p1.sx, tri.p1.sy);
        ctx.lineTo(tri.p2.sx, tri.p2.sy);
        ctx.closePath();

        const isFront = tri.normalZ < 0;

        if (isFront) {
          // Front-facing radiant facet: warm white emitter with facet sparkle
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 18;
          ctx.fill();

          // Brilliant cut facet edge lines
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

      // 7. Subtle Hover Indicator
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
      document.removeEventListener('visibilitychange', resumeClock);
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
  <!-- Radiance Cascades Canvas with 3D Diamond Emitter & Mutual Occlusion -->
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
