<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { Sparkles, Cpu, Layers } from '@lucide/svelte';

  let canvasContainer: HTMLDivElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let animationFrameId: number = 0;

  let gpuStatus = $state('Detecting GPU...');
  let fps = $state(60);
  let isHovered = $state(false);

  // Mouse state with smooth dampening (lerp)
  const targetMouse = { x: 0.5, y: 0.5 };
  const currentMouse = { x: 0.5, y: 0.5 };

  // GLSL Vertex Shader
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  // GLSL Fragment Shader: Volumetric Light, Caustics & Chromatic Dispersion
  const fragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    varying vec2 vUv;

    // Simplex-like noise & domain warping for organic caustics
    vec3 hash33(vec3 p) {
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yxz + 19.19);
      return -1.0 + 2.0 * fract((p.xxy + p.yxx) * p.zyx);
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)),
                         dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                     mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)),
                         dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
                 mix(mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)),
                         dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                     mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)),
                         dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
    }

    // Caustic function using overlapping sine waves and domain warping
    float causticPattern(vec2 uv, float time, float offset) {
      vec2 p = uv * 3.5;
      for (int i = 1; i < 5; i++) {
        float fi = float(i);
        p += vec2(
          sin(p.y * 1.5 + time * 0.4 + offset) * 0.4,
          cos(p.x * 1.5 + time * 0.35 + offset) * 0.4
        );
      }
      float c = sin(p.x + p.y) * cos(p.x - p.y);
      return abs(c);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
      vec2 st = gl_FragCoord.xy / uResolution.xy;

      // Mouse influence as a dynamic light refraction center
      vec2 m = (uMouse - 0.5) * 1.4;
      float distToMouse = length(uv - m);

      float t = uTime * 0.35;

      // Subtle volumetric light beam radiating from top-center towards mouse
      vec2 lightOrigin = vec2(0.0, 0.85) + m * 0.3;
      vec2 lightRay = uv - lightOrigin;
      float rayAngle = atan(lightRay.y, lightRay.x);
      float rayDist = length(lightRay);
      
      float beams = sin(rayAngle * 9.0 + t * 0.6) * 0.5 + 0.5;
      beams += sin(rayAngle * 17.0 - t * 0.4) * 0.25;
      beams *= exp(-rayDist * 1.4);

      // Chromatic Dispersion (Prism effect: R, G, B wavelength separation)
      float dispersion = 0.045 + (1.0 - smoothstep(0.0, 0.8, distToMouse)) * 0.06;
      
      float r = causticPattern(uv + vec2(dispersion * 0.9, 0.0), t, 0.0);
      float g = causticPattern(uv, t, 0.8);
      float b = causticPattern(uv - vec2(dispersion * 1.1, 0.0), t, 1.6);

      // Combine caustics with high contrast power
      r = pow(r, 4.0);
      g = pow(g, 4.0);
      b = pow(b, 4.0);

      // Color grading: Deep Indigo, Electric Cyan, Amethyst Violet, Solar Amber
      vec3 colR = vec3(0.95, 0.32, 0.55) * r * 1.4;
      vec3 colG = vec3(0.22, 0.85, 0.98) * g * 1.5;
      vec3 colB = vec3(0.58, 0.35, 1.00) * b * 1.8;

      vec3 finalColor = colR + colG + colB;

      // Add volumetric light beams with subtle amber/gold tint
      finalColor += vec3(0.9, 0.75, 1.0) * beams * 0.55;

      // Light core focus around cursor
      float core = exp(-distToMouse * 4.0) * 0.85;
      finalColor += vec3(0.6, 0.9, 1.0) * core;

      // Ambient background gradient (Dark obsidian space)
      vec3 bg = mix(
        vec3(0.035, 0.040, 0.065),
        vec3(0.015, 0.018, 0.028),
        st.y
      );

      finalColor = mix(bg, finalColor + bg, 0.75);

      // Bottom fade out into solid page background (#08090d)
      float bottomFade = smoothstep(0.0, 0.45, st.y);
      finalColor = mix(vec3(0.031, 0.035, 0.051), finalColor, bottomFade);

      // Subtle vignette
      float vignette = 1.0 - length(st - 0.5) * 0.6;
      finalColor *= clamp(vignette, 0.0, 1.0);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  onMount(() => {
    if (!canvasContainer) return;

    // Detect GPU & context
    try {
      const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const gpuName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Hardware Accelerated';
        gpuStatus = gpuName.includes('NVIDIA') ? 'RTX vGPU • GLSL' : gpuName.split('/')[0].slice(0, 24);
      } else {
        gpuStatus = 'Software Rasterizer';
      }
    } catch {
      gpuStatus = 'WebGL2 Active';
    }

    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    // Three.js setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    canvasContainer.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniformEffects: {},
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      },
      depthWrite: false,
      depthTest: false,
    } as any);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTime = lastTime;

    const clock = new THREE.Clock();

    const handleResize = () => {
      if (!canvasContainer || !renderer || !material) return;
      const w = canvasContainer.clientWidth;
      const h = canvasContainer.clientHeight;
      renderer.setSize(w, h);
      material.uniforms.uResolution.value.set(w, h);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasContainer) return;
      const rect = canvasContainer.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      targetMouse.x = Math.max(0, Math.min(1, x));
      targetMouse.y = Math.max(0, Math.min(1, y));
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Mouse lerp for silky smooth fluid inertia
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.055;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.055;

      if (material) {
        material.uniforms.uTime.value = clock.getElapsedTime();
        material.uniforms.uMouse.value.set(currentMouse.x, currentMouse.y);
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }

      // FPS tracking
      const now = performance.now();
      frameCount++;
      if (now - fpsTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - fpsTime));
        frameCount = 0;
        fpsTime = now;
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (renderer && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
      }
      geometry.dispose();
      if (material) material.dispose();
    };
  });
</script>

<div
  class="relative w-full h-[540px] md:h-[620px] overflow-hidden select-none"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  role="region"
  aria-label="Interactive Light Shader Hero"
>
  <!-- Three.js Canvas Container -->
  <div bind:this={canvasContainer} class="absolute inset-0 w-full h-full pointer-events-none"></div>

  <!-- Noise Grain Overlay -->
  <div class="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-40"></div>

  <!-- Hero Content Overlay -->
  <div class="relative z-10 max-w-5xl mx-auto h-full flex flex-col justify-between px-6 py-12 md:py-16">
    <!-- Top System Status Badges -->
    <div class="flex items-center justify-between text-xs font-mono text-slate-400">
      <div class="flex items-center gap-2 bg-slate-900/70 border border-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
        <span class="text-slate-200 font-medium">DISPERSION CORE</span>
        <span class="text-slate-600">|</span>
        <span class="text-slate-400">{gpuStatus}</span>
      </div>

      <div class="hidden sm:flex items-center gap-4 bg-slate-900/60 border border-slate-800/60 backdrop-blur-md px-3 py-1.5 rounded-full">
        <span class="flex items-center gap-1.5 text-slate-400">
          <Layers class="w-3.5 h-3.5 text-sky-400" />
          <span>RAYMARCHING</span>
        </span>
        <span class="text-slate-600">•</span>
        <span class="text-emerald-400 font-mono">{fps} FPS</span>
      </div>
    </div>

    <!-- Main Title & Vision -->
    <div class="max-w-2xl my-auto">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-sky-500/10 border border-sky-500/30 text-sky-300 mb-6 backdrop-blur-sm">
        <Sparkles class="w-3.5 h-3.5" />
        <span>LIGHT, SHADERS & VISUAL COMPUTING</span>
      </div>

      <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.12]">
        Exploring the optics of <br />
        <span class="bg-gradient-to-r from-sky-300 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
          interactive light & code
        </span>
      </h1>

      <p class="mt-5 text-base sm:text-lg text-slate-300/90 leading-relaxed font-normal max-w-xl">
        受物理光学、色散棱镜与计算图形学启发的思考工坊。记录 GPU 渲染、WGSL / GLSL 着色器探索、以及现代前端系统工程的实战案例。
      </p>

      <!-- Quick Nav Buttons -->
      <div class="mt-8 flex flex-wrap items-center gap-3">
        <a
          href="#articles"
          class="px-5 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-semibold text-sm hover:bg-sky-400 transition-all duration-200 shadow-[0_0_20px_rgba(56,189,248,0.3)] flex items-center gap-2 cursor-pointer"
        >
          浏览文章
          <span class="text-xs">↓</span>
        </a>
        <a
          href="/cases"
          class="px-5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 hover:border-slate-500 text-slate-200 font-medium text-sm backdrop-blur-sm transition-all duration-200 flex items-center gap-2 cursor-pointer"
        >
          查看案例库
          <span class="text-xs">→</span>
        </a>
      </div>
    </div>

    <!-- Bottom Hint -->
    <div class="flex items-center justify-between text-xs text-slate-500 font-mono pt-4 border-t border-slate-800/40">
      <span>MOVE CURSOR TO REFRACT LIGHT FIELD</span>
      <span class="hidden sm:inline">ASTRO 5 + SVELTE 5 + MDX</span>
    </div>
  </div>
</div>
