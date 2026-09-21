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

    // =========================================================================
    // LIVING OPTICAL APPARATUS: KINEMATIC APERTURES, RAILS, ROTATORS & BAFFLES
    // =========================================================================
    interface ElementPose {
      x: number;
      y: number;
      angle: number;
      length: number;
      gap: number;
    }

    interface OpticalElement {
      id: string;
      name: string;
      type: 'SLIDE' | 'ROTATE' | 'IRIS_SPLIT' | 'TELESCOPE';
      rail?: [number, number, number, number]; // [x0, y0, x1, y1] for linear guide slot
      pivot?: [number, number];                // [px, py] for precision rotary bearing
      poses: ElementPose[];                    // 4 curated architectural states
    }

    const PRESET_NAMES = [
      'RADIAL COLLIMATOR // CROSS-BEAM APERTURES',
      'ORTHOGONAL MATRIX // REFLECTIVE CASSETTES',
      'DIAGONAL WAVEGUIDE // PRISMATIC DEFLECTORS',
      'ASYMMETRIC CAVITY // POLARIZED RESONATOR',
    ];

    // 16 precision optical components spanning the 4 kinematic mechanisms:
    // - SLIDE (滑动): 4 linear rail sliders with visible mechanical guide tracks
    // - ROTATE (旋转): 6 rotary galvos / shutters on precision pivot bearings
    // - IRIS_SPLIT (开合): 3 dual-leaf parting aperture gates
    // - TELESCOPE (伸缩): 3 variable-length collimating baffles
    const opticalApparatus: OpticalElement[] = [
      // 1. Inner North Iris Gate (开合/IRIS)
      {
        id: 'iris_north',
        name: 'Inner North Aperture Gate',
        type: 'IRIS_SPLIT',
        poses: [
          { x: 0, y: -0.16, angle: 0, length: 0.10, gap: 0.08 },
          { x: 0, y: -0.16, angle: 0, length: 0.10, gap: 0.005 },
          { x: 0, y: -0.16, angle: 0, length: 0.10, gap: 0.045 },
          { x: 0, y: -0.16, angle: 0, length: 0.10, gap: 0.095 },
        ],
      },
      // 2. Inner South Iris Gate (开合/IRIS)
      {
        id: 'iris_south',
        name: 'Inner South Aperture Gate',
        type: 'IRIS_SPLIT',
        poses: [
          { x: 0, y: 0.16, angle: 0, length: 0.10, gap: 0.08 },
          { x: 0, y: 0.16, angle: 0, length: 0.10, gap: 0.005 },
          { x: 0, y: 0.16, angle: 0, length: 0.10, gap: 0.01 },
          { x: 0, y: 0.16, angle: 0, length: 0.10, gap: 0.005 },
        ],
      },
      // 3. Inner East Rotary Shutter (旋转/ROTATE)
      {
        id: 'rot_east',
        name: 'Inner East Shutter Blade',
        type: 'ROTATE',
        pivot: [0.17, 0.0],
        poses: [
          { x: 0.17, y: 0.0, angle: 0, length: 0.16, gap: 0 },
          { x: 0.17, y: 0.0, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: 0.17, y: 0.0, angle: Math.PI / 4, length: 0.16, gap: 0 },
          { x: 0.17, y: 0.0, angle: Math.PI / 2, length: 0.16, gap: 0 },
        ],
      },
      // 4. Inner West Rotary Shutter (旋转/ROTATE)
      {
        id: 'rot_west',
        name: 'Inner West Shutter Blade',
        type: 'ROTATE',
        pivot: [-0.17, 0.0],
        poses: [
          { x: -0.17, y: 0.0, angle: 0, length: 0.16, gap: 0 },
          { x: -0.17, y: 0.0, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: -0.17, y: 0.0, angle: -Math.PI / 4, length: 0.16, gap: 0 },
          { x: -0.17, y: 0.0, angle: 0, length: 0.16, gap: 0 },
        ],
      },
      // 5. Upper-Left Linear Rail Slider (滑动/SLIDE)
      {
        id: 'slide_ul',
        name: 'Upper-Left Rail Barrier',
        type: 'SLIDE',
        rail: [-0.34, -0.26, -0.14, -0.26],
        poses: [
          { x: -0.32, y: -0.26, angle: 0, length: 0.16, gap: 0 },
          { x: -0.16, y: -0.26, angle: 0, length: 0.16, gap: 0 },
          { x: -0.24, y: -0.26, angle: 0, length: 0.16, gap: 0 },
          { x: -0.34, y: -0.26, angle: 0, length: 0.16, gap: 0 },
        ],
      },
      // 6. Upper-Right Linear Rail Slider (滑动/SLIDE)
      {
        id: 'slide_ur',
        name: 'Upper-Right Rail Barrier',
        type: 'SLIDE',
        rail: [0.28, -0.32, 0.28, -0.12],
        poses: [
          { x: 0.28, y: -0.28, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: 0.28, y: -0.14, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: 0.28, y: -0.22, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: 0.28, y: -0.14, angle: Math.PI / 2, length: 0.16, gap: 0 },
        ],
      },
      // 7. Lower-Right Linear Rail Slider (滑动/SLIDE)
      {
        id: 'slide_lr',
        name: 'Lower-Right Rail Barrier',
        type: 'SLIDE',
        rail: [0.14, 0.26, 0.34, 0.26],
        poses: [
          { x: 0.32, y: 0.26, angle: 0, length: 0.16, gap: 0 },
          { x: 0.16, y: 0.26, angle: 0, length: 0.16, gap: 0 },
          { x: 0.24, y: 0.26, angle: 0, length: 0.16, gap: 0 },
          { x: 0.20, y: 0.26, angle: 0, length: 0.16, gap: 0 },
        ],
      },
      // 8. Lower-Left Linear Rail Slider (滑动/SLIDE)
      {
        id: 'slide_ll',
        name: 'Lower-Left Rail Barrier',
        type: 'SLIDE',
        rail: [-0.28, 0.12, -0.28, 0.32],
        poses: [
          { x: -0.28, y: 0.28, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: -0.28, y: 0.14, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: -0.28, y: 0.20, angle: Math.PI / 2, length: 0.16, gap: 0 },
          { x: -0.28, y: 0.30, angle: Math.PI / 2, length: 0.16, gap: 0 },
        ],
      },
      // 9. North-West Galvo Deflector (旋转/ROTATE)
      {
        id: 'galvo_nw',
        name: 'North-West Rotary Galvo',
        type: 'ROTATE',
        pivot: [-0.22, -0.17],
        poses: [
          { x: -0.22, y: -0.17, angle: 0, length: 0.14, gap: 0 },
          { x: -0.22, y: -0.17, angle: Math.PI / 2, length: 0.14, gap: 0 },
          { x: -0.22, y: -0.17, angle: Math.PI / 4, length: 0.14, gap: 0 },
          { x: -0.22, y: -0.17, angle: -Math.PI / 4, length: 0.14, gap: 0 },
        ],
      },
      // 10. North-East Galvo Deflector (旋转/ROTATE)
      {
        id: 'galvo_ne',
        name: 'North-East Rotary Galvo',
        type: 'ROTATE',
        pivot: [0.22, -0.17],
        poses: [
          { x: 0.22, y: -0.17, angle: 0, length: 0.14, gap: 0 },
          { x: 0.22, y: -0.17, angle: Math.PI / 2, length: 0.14, gap: 0 },
          { x: 0.22, y: -0.17, angle: -Math.PI / 4, length: 0.14, gap: 0 },
          { x: 0.22, y: -0.17, angle: Math.PI / 4, length: 0.14, gap: 0 },
        ],
      },
      // 11. South-East Galvo Deflector (旋转/ROTATE)
      {
        id: 'galvo_se',
        name: 'South-East Rotary Galvo',
        type: 'ROTATE',
        pivot: [0.22, 0.17],
        poses: [
          { x: 0.22, y: 0.17, angle: 0, length: 0.14, gap: 0 },
          { x: 0.22, y: 0.17, angle: Math.PI / 2, length: 0.14, gap: 0 },
          { x: 0.22, y: 0.17, angle: Math.PI / 4, length: 0.14, gap: 0 },
          { x: 0.22, y: 0.17, angle: -Math.PI / 4, length: 0.14, gap: 0 },
        ],
      },
      // 12. South-West Galvo Deflector (旋转/ROTATE)
      {
        id: 'galvo_sw',
        name: 'South-West Rotary Galvo',
        type: 'ROTATE',
        pivot: [-0.22, 0.17],
        poses: [
          { x: -0.22, y: 0.17, angle: 0, length: 0.14, gap: 0 },
          { x: -0.22, y: 0.17, angle: Math.PI / 2, length: 0.14, gap: 0 },
          { x: -0.22, y: 0.17, angle: -Math.PI / 4, length: 0.14, gap: 0 },
          { x: -0.22, y: 0.17, angle: Math.PI / 4, length: 0.14, gap: 0 },
        ],
      },
      // 13. Outer North Telescoping Baffle (伸缩/TELESCOPE)
      {
        id: 'tele_north',
        name: 'Outer North Telescoping Baffle',
        type: 'TELESCOPE',
        poses: [
          { x: 0.0, y: -0.36, angle: 0, length: 0.14, gap: 0 },
          { x: 0.0, y: -0.36, angle: 0, length: 0.36, gap: 0 },
          { x: 0.0, y: -0.36, angle: 0, length: 0.22, gap: 0 },
          { x: 0.0, y: -0.36, angle: 0, length: 0.16, gap: 0 },
        ],
      },
      // 14. Outer South Telescoping Baffle (伸缩/TELESCOPE)
      {
        id: 'tele_south',
        name: 'Outer South Telescoping Baffle',
        type: 'TELESCOPE',
        poses: [
          { x: 0.0, y: 0.36, angle: 0, length: 0.14, gap: 0 },
          { x: 0.0, y: 0.36, angle: 0, length: 0.36, gap: 0 },
          { x: 0.0, y: 0.36, angle: 0, length: 0.26, gap: 0 },
          { x: 0.0, y: 0.36, angle: 0, length: 0.34, gap: 0 },
        ],
      },
      // 15. Outer West Iris Portal (开合/IRIS)
      {
        id: 'iris_west',
        name: 'Outer West Portal Iris',
        type: 'IRIS_SPLIT',
        poses: [
          { x: -0.38, y: 0.0, angle: Math.PI / 2, length: 0.12, gap: 0.06 },
          { x: -0.38, y: 0.0, angle: Math.PI / 2, length: 0.12, gap: 0.16 },
          { x: -0.38, y: 0.0, angle: Math.PI / 2, length: 0.12, gap: 0.02 },
          { x: -0.38, y: 0.0, angle: Math.PI / 2, length: 0.12, gap: 0.18 },
        ],
      },
      // 16. Outer East Telescoping Baffle (伸缩/TELESCOPE)
      {
        id: 'tele_east',
        name: 'Outer East Telescoping Baffle',
        type: 'TELESCOPE',
        poses: [
          { x: 0.38, y: 0.0, angle: Math.PI / 2, length: 0.12, gap: 0 },
          { x: 0.38, y: 0.0, angle: Math.PI / 2, length: 0.32, gap: 0 },
          { x: 0.38, y: 0.0, angle: Math.PI / 2, length: 0.20, gap: 0 },
          { x: 0.38, y: 0.0, angle: Math.PI / 2, length: 0.20, gap: 0 },
        ],
      },
    ];

    const startTime = performance.now();
    let lastFrameTime = startTime;
    let mazeTime = 0;

    // Presets & Timing state:
    // Stays stable for 10~20s, then enters a 1~2s smooth mechanical reorganization,
    // settling into a completely new light field for the next 10~20s.
    let currPreset = 0;
    let targetPreset = 0;
    let reorganizing = false;
    let reorgStart = 0;
    let reorgDuration = 1.5;
    let nextReorgTime = 12 + Math.random() * 6; // First stable duration: 12~18s

    const resumeClock = () => { lastFrameTime = performance.now(); };
    document.addEventListener('visibilitychange', resumeClock);

    const render = () => {
      animId = requestAnimationFrame(render);
      const now = performance.now();
      const elapsed = (now - startTime) * 0.001;
      if (!document.hidden) {
        // Clamp frame delta to avoid jump on tab return
        mazeTime += Math.min(0.08, (now - lastFrameTime) * 0.001);
      }
      lastFrameTime = now;

      // -----------------------------------------------------------------------
      // STATE MACHINE: 10~20s Stable Hold -> 1~2s Reorganization -> 10~20s Stable Hold
      // -----------------------------------------------------------------------
      if (!reorganizing && mazeTime >= nextReorgTime) {
        reorganizing = true;
        reorgStart = mazeTime;
        reorgDuration = 1.3 + Math.random() * 0.5; // Reorganization lasts 1.3s ~ 1.8s (strictly 1~2s)
        currPreset = targetPreset;
        // Select a different preset to create a genuinely novel optical configuration
        targetPreset = (currPreset + 1 + Math.floor(Math.random() * (PRESET_NAMES.length - 1))) % PRESET_NAMES.length;
        // After reorg finishes, stay completely stable for 10~20s so user can observe new light field
        nextReorgTime = reorgStart + reorgDuration + 10 + Math.random() * 10;
      }

      let progress = 1;
      let eased = 1;
      if (reorganizing) {
        progress = Math.min(1, (mazeTime - reorgStart) / reorgDuration);
        // Quintic smoothstep easing: smooth zero-acceleration start & gentle mechanical arrival
        // S_5(t) = t^3 * (t * (6t - 15) + 10)
        eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
        if (progress >= 1) {
          reorganizing = false;
          currPreset = targetPreset;
        }
      }

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Dark Architectural Floor Grid
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
      ctx.restore();

      // 2. Element Coordinates & Apparatus Kinematic Solvers
      const centerX = w * 0.58;
      const centerY = h * 0.48;
      const diamondScale = Math.min(w, h) * 0.125;
      const mazeScale = Math.min(w * 0.88, h);

      // Render Mechanical Guide Rails on the floor before walls
      for (const el of opticalApparatus) {
        if (el.rail) {
          const r0x = centerX + el.rail[0] * mazeScale;
          const r0y = centerY + el.rail[1] * mazeScale;
          const r1x = centerX + el.rail[2] * mazeScale;
          const r1y = centerY + el.rail[3] * mazeScale;

          ctx.save();
          // Rail slot track
          ctx.beginPath();
          ctx.moveTo(r0x, r0y);
          ctx.lineTo(r1x, r1y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 3;
          ctx.stroke();

          // High-precision millimeter indicator track
          ctx.beginPath();
          ctx.moveTo(r0x, r0y);
          ctx.lineTo(r1x, r1y);
          ctx.strokeStyle = reorganizing ? 'rgba(56, 189, 248, 0.28)' : 'rgba(56, 189, 248, 0.12)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();

          // Limit stops
          const rAngle = Math.atan2(r1y - r0y, r1x - r0x);
          const px = -Math.sin(rAngle) * 4;
          const py = Math.cos(rAngle) * 4;
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(r0x - px, r0y - py);
          ctx.lineTo(r0x + px, r0y + py);
          ctx.moveTo(r1x - px, r1y - py);
          ctx.lineTo(r1x + px, r1y + py);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Interpolate each element's pose between current and target state
      interface Segment {
        a: { x: number; y: number };
        b: { x: number; y: number };
        type: string;
      }
      const apparatusSegments: Segment[] = [];

      for (const el of opticalApparatus) {
        const pA = el.poses[currPreset];
        const pB = el.poses[targetPreset];

        // Shortest arc interpolation for angles
        let dAngle = pB.angle - pA.angle;
        while (dAngle > Math.PI) dAngle -= Math.PI * 2;
        while (dAngle < -Math.PI) dAngle += Math.PI * 2;

        const curX = pA.x + (pB.x - pA.x) * eased;
        const curY = pA.y + (pB.y - pA.y) * eased;
        const curAngle = pA.angle + dAngle * eased;
        const curLength = pA.length + (pB.length - pA.length) * eased;
        const curGap = pA.gap + (pB.gap - pA.gap) * eased;

        const dx = Math.cos(curAngle);
        const dy = Math.sin(curAngle);
        const toScreen = (off: number) => ({
          x: centerX + (curX + dx * off) * mazeScale,
          y: centerY + (curY + dy * off) * mazeScale,
        });

        if (el.type === 'IRIS_SPLIT') {
          // Dual leaves sliding apart symmetrically (开合)
          const leafLen = curLength;
          apparatusSegments.push(
            { a: toScreen(-curGap - leafLen), b: toScreen(-curGap), type: el.type },
            { a: toScreen(curGap), b: toScreen(curGap + leafLen), type: el.type }
          );
        } else {
          // SLIDE (滑动), ROTATE (旋转), TELESCOPE (伸缩)
          const half = curLength / 2;
          apparatusSegments.push({ a: toScreen(-half), b: toScreen(half), type: el.type });
        }
      }

      // Fixed Neon Occluders/Emitters:
      // Green neon bar: positioned lower-left
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

        // Soft penumbra divergence
        const penumbraSpread = 1.06;
        const shadowP0 = {
          x: barX0 + (d0x / dist0) * length * penumbraSpread,
          y: barY0 + (d0y / dist0) * length * penumbraSpread
        };
        const shadowP1 = {
          x: barX1 + (d1x / dist1) * length * penumbraSpread,
          y: barY1 + (d1y / dist1) * length * penumbraSpread
        };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(barX0, barY0);
        ctx.lineTo(barX1, barY1);
        ctx.lineTo(shadowP1.x, shadowP1.y);
        ctx.lineTo(shadowP0.x, shadowP0.y);
        ctx.closePath();

        const midBarX = (barX0 + barX1) * 0.5;
        const midBarY = (barY0 + barY1) * 0.5;
        const midShadowX = (shadowP0.x + shadowP1.x) * 0.5;
        const midShadowY = (shadowP0.y + shadowP1.y) * 0.5;

        const shadowGrad = ctx.createLinearGradient(midBarX, midBarY, midShadowX, midShadowY);
        shadowGrad.addColorStop(0, `rgba(5, 6, 9, ${0.52 * intensity})`);
        shadowGrad.addColorStop(0.45, `rgba(5, 6, 9, ${0.24 * intensity})`);
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

      // Cast dynamic occlusion shadows from moving apparatus components
      const castApparatusShadows = (x: number, y: number, intensity: number) => {
        for (const { a, b } of apparatusSegments) {
          castOcclusionShadow(x, y, a.x, a.y, b.x, b.y, mazeScale * 0.65, intensity);
        }
      };

      // Diamond light casts primary shadow channels through the living apparatus
      castApparatusShadows(centerX, centerY, 0.88);
      // Secondary bounce shadows from fixed neon bars
      castApparatusShadows((g0.x + g1.x) / 2, (g0.y + g1.y) / 2, 0.35);
      castApparatusShadows((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0.35);

      // --- 4. USER DRAWN LIGHT STROKES: FULL MUTUAL RADIANCE CASCADES INTERACTION ---
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
        castApparatusShadows(midX, midY, s.life * 0.45);

        // B. Light bounce onto the Green Bar and Purple Bar:
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

      // --- 5. RENDER LIVING OPTICAL APPARATUS: WALLS, BEARINGS, DICHROIC RIM LIGHTING ---
      ctx.save();
      ctx.lineCap = 'round';

      for (const { a, b } of apparatusSegments) {
        // A. Heavy Anodized Titanium Wall Armor
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = 6.5;
        ctx.strokeStyle = '#090e15';
        ctx.stroke();

        // B. Metallic Core Plate
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#182433';
        ctx.stroke();

        // C. Illuminated Specular Rim facing Central Radiant Diamond
        const segDx = b.x - a.x;
        const segDy = b.y - a.y;
        const segLen = Math.hypot(segDx, segDy) || 1;
        const nx = -segDy / segLen;
        const ny = segDx / segLen;
        const midSegX = (a.x + b.x) * 0.5;
        const midSegY = (a.y + b.y) * 0.5;

        // Normal facing vector test against diamond light
        const toDiamondX = centerX - midSegX;
        const toDiamondY = centerY - midSegY;
        const dotDiamond = nx * toDiamondX + ny * toDiamondY;
        const facingSign = dotDiamond >= 0 ? 1 : -1;

        const rimOffX = nx * facingSign * 1.8;
        const rimOffY = ny * facingSign * 1.8;

        ctx.beginPath();
        ctx.moveTo(a.x + rimOffX, a.y + rimOffY);
        ctx.lineTo(b.x + rimOffX, b.y + rimOffY);
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = 'rgba(255, 248, 230, 0.75)';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.stroke();

        // D. Top Micro Dichroic Laser-Etched Coating (Cyan -> Purple -> Emerald)
        const edgeGrad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        edgeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
        edgeGrad.addColorStop(0.5, 'rgba(192, 132, 252, 0.85)');
        edgeGrad.addColorStop(1, 'rgba(52, 211, 153, 0.85)');
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = edgeGrad;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      ctx.restore();

      // Render Pivot Bearings with Kinematic Energy Actuators
      for (const el of opticalApparatus) {
        if (el.pivot) {
          const pvx = centerX + el.pivot[0] * mazeScale;
          const pvy = centerY + el.pivot[1] * mazeScale;

          ctx.save();
          // Outer bearing collar
          ctx.beginPath();
          ctx.arc(pvx, pvy, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#080d12';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Center jewel / LED actuator
          ctx.beginPath();
          ctx.arc(pvx, pvy, 2, 0, Math.PI * 2);
          if (reorganizing) {
            const pulse = 0.5 + 0.5 * Math.sin(mazeTime * 18);
            ctx.fillStyle = `rgba(56, 189, 248, ${0.7 + 0.3 * pulse})`;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
          } else {
            ctx.fillStyle = 'rgba(220, 245, 255, 0.5)';
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.restore();
        }
      }

      // --- 6. RENDER FIXED NEON EMITTER BARS ---
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

      // Color bounce highlight from user strokes
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

      // Color bounce highlight from user strokes
      if (userIlluminatedPurpleGlow && userIlluminatedPurpleGlow.intensity > 0.05) {
        ctx.strokeStyle = userIlluminatedPurpleGlow.color;
        ctx.lineWidth = 7.0;
        ctx.shadowColor = userIlluminatedPurpleGlow.color;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = userIlluminatedPurpleGlow.intensity * 0.6;
        ctx.stroke();
      }
      ctx.restore();

      // --- 7. RENDER CENTRAL 3D GLB DIAMOND EMITTER (From dflat-D9eRXupj.glb) ---
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

      // --- 8. TELEMETRY & LIVING OPTICAL APPARATUS HUD READOUT ---
      ctx.save();
      const hudX = w - 28;
      const hudY = h - 22;
      ctx.textAlign = 'right';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

      if (reorganizing) {
        const pct = Math.floor(progress * 100);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.fillText(`● RECONFIGURING [${pct}%] // KINEMATIC MORPH`, hudX, hudY - 14);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.shadowBlur = 0;
        ctx.fillText(`TARGET: ${PRESET_NAMES[targetPreset]}`, hudX, hudY);
      } else {
        const remainingSec = Math.max(0, nextReorgTime - mazeTime).toFixed(1);
        ctx.fillStyle = 'rgba(34, 229, 119, 0.9)';
        ctx.shadowColor = '#22e577';
        ctx.shadowBlur = 6;
        ctx.fillText(`● APPARATUS STABLE // NEXT MORPH IN ${remainingSec}s`, hudX, hudY - 14);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.shadowBlur = 0;
        ctx.fillText(`ACTIVE: ${PRESET_NAMES[currPreset]}`, hudX, hudY);
      }
      ctx.restore();

      // 9. Subtle Hover Indicator
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
