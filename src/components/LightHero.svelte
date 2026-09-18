<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let canvasContainer: HTMLDivElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let animationFrameId: number = 0;

  // Smooth mouse coordinates (lerp)
  const targetMouse = { x: 0.5, y: 0.5 };
  const currentMouse = { x: 0.5, y: 0.5 };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  // Optical Light Prism Shader: Incident White Ray -> Glass Triangle -> Spectral Dispersion (Rainbow Fan)
  const fragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    varying vec2 vUv;

    // Equilateral triangle distance function
    float sdTriangleIsosceles(in vec2 p, in vec2 q) {
      p.x = abs(p.x);
      vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
      vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
      float k = sign(q.y);
      float d = min(dot(a, a), dot(b, b));
      float s = max(k * (p.x * q.y - p.y * q.x), k * (p.y - q.y));
      return sqrt(d) * sign(s);
    }

    // Gaussian beam intensity along a 2D line segment
    float beamSegment(vec2 p, vec2 a, vec2 b, float thickness) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float d = length(pa - ba * h);
      return exp(-d * d / (thickness * thickness));
    }

    // Convert wavelength (normalized 0.0 - 1.0, approx 400nm to 700nm) to RGB spectral color
    vec3 spectralColor(float t) {
      // Smooth approximation of visible spectrum (violet -> blue -> cyan -> green -> yellow -> red)
      float r = smoothstep(0.5, 0.8, t) + (1.0 - smoothstep(0.0, 0.25, t)) * 0.4;
      float g = sin(clamp(t * 3.1415, 0.0, 3.1415));
      float b = 1.0 - smoothstep(0.2, 0.65, t);
      // Boost vividness and balance
      vec3 c = vec3(r, g * 0.95, b);
      c += vec3(0.15, 0.25, 0.4) * (1.0 - abs(t - 0.3) * 3.0);
      return max(c, vec3(0.0));
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
      vec2 st = gl_FragCoord.xy / uResolution.xy;

      // Mouse interactive tilt and position
      vec2 m = (uMouse - 0.5) * 0.8;
      float time = uTime * 0.5;

      // Prism geometry (Equilateral glass prism centered slightly to the left)
      vec2 prismCenter = vec2(-0.18, -0.02);
      vec2 pTri = uv - prismCenter;
      // Invert Y for triangle apex pointing up
      pTri.y = -pTri.y;
      float prismDist = sdTriangleIsosceles(pTri + vec2(0.0, 0.16), vec2(0.32, 0.48));

      // Light Origin (Left side, controlled by mouse Y)
      vec2 incidentStart = vec2(-0.85, 0.22 + m.y * 0.45);
      vec2 incidentHit = prismCenter + vec2(-0.15, 0.02 + m.y * 0.08);

      // 1. Incident White Beam
      float incident = beamSegment(uv, incidentStart, incidentHit, 0.016);
      incident += beamSegment(uv, incidentStart, incidentHit, 0.06) * 0.4;
      vec3 col = vec3(0.95, 0.98, 1.0) * incident * 2.2;

      // 2. Internal Refraction inside Prism
      vec2 internalExit = prismCenter + vec2(0.14, -0.05 + m.y * 0.04);
      if (prismDist < 0.0) {
        float internalBeam = beamSegment(uv, incidentHit, internalExit, 0.022);
        internalBeam += beamSegment(uv, incidentHit, internalExit, 0.07) * 0.5;
        col += vec3(0.9, 0.95, 1.0) * internalBeam * 1.8;

        // Glass volume subtle caustics/glow
        col += vec3(0.2, 0.4, 0.7) * (1.0 - smoothstep(-0.15, 0.0, prismDist)) * 0.25;
      }

      // 3. Prism Glass Edges & Internal Reflection
      float edge = 1.0 - smoothstep(0.0, 0.014, abs(prismDist));
      col += vec3(0.6, 0.8, 1.0) * edge * 0.85;

      // Weak Fresnel Reflection Beam off the entry face
      vec2 reflectDir = normalize(incidentHit - incidentStart);
      reflectDir.y = -reflectDir.y * 0.85;
      vec2 reflectEnd = incidentHit + reflectDir * 0.5;
      float reflection = beamSegment(uv, incidentHit, reflectEnd, 0.015);
      col += vec3(0.7, 0.85, 1.0) * reflection * 0.25;

      // 4. Dispersion: Fan of Spectral Beams (Rainbow Rays) exiting the right face
      const int SAMPLES = 18;
      for (int i = 0; i < SAMPLES; i++) {
        float f = float(i) / float(SAMPLES - 1);
        // Dispersion angle spreading based on wavelength
        float fanAngle = -0.18 + f * 0.48 + m.y * 0.2;
        vec2 dir = vec2(cos(fanAngle), sin(fanAngle));
        vec2 rayEnd = internalExit + dir * 1.4;

        // Spectral color for this wavelength
        vec3 rayColor = spectralColor(1.0 - f);

        // Core thin beam + volumetric glow
        float ray = beamSegment(uv, internalExit, rayEnd, 0.012 + f * 0.008);
        float rayGlow = beamSegment(uv, internalExit, rayEnd, 0.055 + f * 0.02) * 0.35;

        // Distance attenuation from exit
        float distFactor = clamp(uv.x - internalExit.x, 0.0, 1.0);
        col += rayColor * (ray * 1.6 + rayGlow) * (0.8 + distFactor * 0.4);
      }

      // Subtle ambient particle dust in the beam
      float dust = sin(uv.x * 40.0 + time) * cos(uv.y * 40.0 - time);
      col += vec3(0.8, 0.9, 1.0) * max(0.0, dust) * 0.04 * step(internalExit.x, uv.x);

      // Deep obsidian space background
      vec3 bg = vec3(0.031, 0.035, 0.051);
      col = max(col, bg);

      // Bottom fade out into solid page background (#08090d)
      float bottomFade = smoothstep(0.0, 0.35, st.y);
      col = mix(bg, col, bottomFade);

      // Top subtle fade
      float topFade = smoothstep(1.0, 0.85, st.y);
      col = mix(bg, col, topFade);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  onMount(() => {
    if (!canvasContainer) return;

    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    canvasContainer.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      },
      depthWrite: false,
      depthTest: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

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

      // Smooth lerp
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05;

      if (material) {
        material.uniforms.uTime.value = clock.getElapsedTime();
        material.uniforms.uMouse.value.set(currentMouse.x, currentMouse.y);
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
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
  class="relative w-full h-[320px] md:h-[380px] overflow-hidden select-none border-b border-slate-900"
  role="region"
  aria-label="Optical Prism Banner"
>
  <!-- Three.js Prism Canvas -->
  <div bind:this={canvasContainer} class="absolute inset-0 w-full h-full pointer-events-none"></div>

  <!-- Noise Grain -->
  <div class="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-30"></div>

  <!-- Minimal restrained overlay -->
  <div class="relative z-10 max-w-4xl mx-auto h-full flex flex-col justify-end px-4 pb-8 pointer-events-none">
    <div class="space-y-1">
      <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
        vGPU<span class="text-slate-500">::</span>Light
      </h1>
      <p class="text-xs sm:text-sm font-mono text-slate-400">
        Optics, shaders & real-time graphics.
      </p>
    </div>
  </div>
</div>
