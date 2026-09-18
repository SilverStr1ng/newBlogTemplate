<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { Play, Pause, RotateCcw, Sliders } from '@lucide/svelte';

  interface Props {
    mode?: 'dispersion' | 'caustics' | 'refraction';
    caption?: string;
  }

  let { mode = 'dispersion', caption = 'Interactive GLSL Shader Experiment' }: Props = $props();

  let canvasBox: HTMLDivElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let animId: number = 0;

  let isPlaying = $state(true);
  let intensity = $state(1.2);
  let timeVal = 0;

  const vShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fShader = `
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
      float d = length(p);
      float angle = atan(p.y, p.x);

      // Multi-layer spectral wave
      float wave = sin(d * 14.0 - uTime * 2.5) * 0.5 + 0.5;
      wave += cos(angle * 6.0 + uTime) * 0.25;

      // Chromatic separation
      vec3 col;
      col.r = sin(wave * 3.1415 + 0.0) * uIntensity;
      col.g = sin(wave * 3.1415 + 1.2) * uIntensity;
      col.b = sin(wave * 3.1415 + 2.4) * uIntensity;

      col *= exp(-d * 2.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  onMount(() => {
    if (!canvasBox) return;
    const w = canvasBox.clientWidth;
    const h = canvasBox.clientHeight;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasBox.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    material = new THREE.ShaderMaterial({
      vertexShader: vShader,
      fragmentShader: fShader,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(w, h) },
        uIntensity: { value: intensity },
      },
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (isPlaying) {
        timeVal += 0.016;
      }
      if (material) {
        material.uniforms.uTime.value = timeVal;
        material.uniforms.uIntensity.value = intensity;
      }
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    animate();

    const handleResize = () => {
      if (!canvasBox || !renderer || !material) return;
      const nw = canvasBox.clientWidth;
      const nh = canvasBox.clientHeight;
      renderer.setSize(nw, nh);
      material.uniforms.uRes.value.set(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
      }
      mesh.geometry.dispose();
      if (material) material.dispose();
    };
  });
</script>

<div class="my-8 rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-2xl">
  <!-- Interactive Canvas Viewport -->
  <div bind:this={canvasBox} class="w-full h-64 md:h-72 bg-black relative"></div>

  <!-- Controls Bar -->
  <div class="px-5 py-3 border-t border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
    <div class="flex items-center gap-3">
      <button
        onclick={() => (isPlaying = !isPlaying)}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
      >
        {#if isPlaying}
          <Pause class="w-3.5 h-3.5 text-amber-400" />
          <span>PAUSE</span>
        {:else}
          <Play class="w-3.5 h-3.5 text-emerald-400" />
          <span>PLAY</span>
        {/if}
      </button>

      <button
        onclick={() => (timeVal = 0)}
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span>RESET</span>
      </button>
    </div>

    <!-- Intensity Slider -->
    <div class="flex items-center gap-2 text-slate-400">
      <Sliders class="w-3.5 h-3.5 text-sky-400" />
      <span>INTENSITY:</span>
      <input
        type="range"
        min="0.5"
        max="2.5"
        step="0.1"
        bind:value={intensity}
        class="w-24 accent-sky-400 cursor-pointer"
      />
      <span class="w-8 text-right text-slate-300">{intensity.toFixed(1)}</span>
    </div>
  </div>

  <!-- Caption -->
  <div class="px-5 py-2 text-[11px] font-mono text-slate-500 bg-slate-950/90 border-t border-slate-900">
    FIG. 1.0 — {caption.toUpperCase()}
  </div>
</div>
