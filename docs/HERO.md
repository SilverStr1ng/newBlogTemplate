# Living labyrinth hero

The homepage still mounts `LightHero` with `client:load`. The original diamond-model
JSON, article list, routes, assets, dependencies and lockfile are unchanged.

## What actually renders

The previous component called `getContext('2d')`, drew radial gradients and projected
shadow polygons, and labelled that work "radiance cascades". This implementation
has two explicitly different backends:

- **WebGPU:** an analytic capsule distance/emission field, five direction-first
  radiance cascades, far-to-near radiance/transmittance merging, then a
  visibility-aware full-screen reconstruction. Walls, the central emissive core,
  both coloured emitters and up to 64 painted segments enter the same GPU field.
- **2D fallback:** visibility-clipped radial lights composited independently.
  This is an approximation, not RC, and the UI says so. To bound CPU work, only
  the three built-in sources and five latest painted segments illuminate the
  fallback scene; all live painted segments retain their visible strokes.

This is **2D emitted-light transport with opaque occlusion**, not a multi-bounce
GI, caustics, spectral dispersion or refractive diamond solver. The supplied
faceted 3D model is projected on a separate Canvas foreground over a small 2D
emissive core. Finite probes, ray steps and spatial interpolation can still
introduce bias/softness; this is not a physically exact renderer.

## Modules

| File | Responsibility |
| --- | --- |
| `scene.js` | Curated geometry, deterministic timing, normalized bounded strokes, resolution policy. |
| `shaders.js` | Distance/emission field, interval tracing, cascade merge and reconstruction WGSL. |
| `gpu.js` | Device/pipelines, separate uniforms per pass, texture/buffer ownership and teardown. |
| `painter.js` | Supplied diamond mesh, wall detail, light strokes and non-RC fallback. |
| `controller.js` | Pointer capture, accessibility preferences, visibility, scheduling and lifecycle. |
| `LightHero.svelte` | Responsive copy, accessible HTML controls, backend and layout status. |

There is no new runtime dependency and no imported vgpu package. The GPU backend
uses the browser's native WebGPU API. Using two canvases intentionally avoids
requesting an incompatible 2D context on a canvas already initialized for WebGPU.

## Choreography and tuning

`SETTINGS` in `scene.js` defines a **12-second stable hold**, **1.8-second morph**,
**4-second post-interaction hold**, **4.5-second stroke lifetime**, and **64-segment
limit**. Durations use elapsed seconds, not frame counts. Background/offscreen
time is excluded rather than caught up on return.

Four layouts cycle in a fixed order. Sixteen permanent segments retain spatial
reference; only two of four gates move during each transition. Gate interpolation
is staggered and eased, angles use the shortest arc, and the diamond chamber
remains clear through the tested intermediate poses. Some gate/scaffold overlap
is intentional, forming closed barriers; this is a visual light labyrinth, not
a generated maze with guaranteed navigable start/end routes.

Drawing freezes the exact current pose, including an unfinished morph. Releasing,
cancelling or losing pointer capture starts the observation hold. Pause freezes
geometry and stroke fading. Reduced motion disables autoplay and fading; explicit
Next changes layouts without animation. Changing reduced motion mid-transition
does not trap the controls. Reset preserves pause/accessibility preferences.

Touch scrolls normally until the explicit touch-drawing mode is enabled. Keyboard
users can place a light, change layout, pause and reset through real buttons.

## Work and resource bounds

The distance field is capped at **512 x 320**, with dimensions divisible by 32.
All five cascade atlases have the same dimensions. Canvas output is capped at
DPR 1.5 and approximately 1.6 million pixels. The source/storage limit is checked
before submission; ray marching uses a finite budget and treats budget exhaustion
as occluded rather than leaking untested radiance.

A stable scene reuses its last GPU output rather than rebuilding the field for a
countdown update. Moving/fading scenes use a nominal 30 Hz timer; direct input may
wake earlier. No frame-rate or battery improvement is claimed without hardware
measurement. There is no temporal accumulation across moving walls.

Hidden documents and offscreen heroes stop scheduling. Observers, event listeners,
timeouts, animation frames, textures, buffers and the device are released on
unmount. GPU initialization cancellation, compilation failure and device loss
activate or retain a working fallback.

## Validation

Run the dependency-free logic and mocked GPU lifecycle tests:

```sh
node --test tests/hero*.test.mjs
```

For the actual Astro/Svelte application:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev --background
# pnpm dev stop / status / logs
```

The `Hero checks` pull-request workflow runs the unit tests and production build.
It does **not** validate shaders on real hardware.

At authoring time, 22 Node tests passed. A Chromium in-memory module harness also
exercised the Canvas fallback, controls and layout at 320, 390, 768 and 1536 CSS
pixels without page exceptions or horizontal overflow. That harness used a small
mesh fixture, not Svelte compilation or the complete site's original model.

The restricted editing container could not download the existing dependencies or
obtain a WebGPU adapter. Therefore the full production build, Svelte hydration,
actual WGSL compilation and GPU visual output must be checked separately. A mock
compilation-error test is only an error-handling test, not shader validation.

Before merging, verify the PR's production-build result and preview the site in a
WebGPU-capable browser. Confirm that the status says `WEBGPU · 5 CASCADES` rather
than silently accepting a fallback. Inspect all four layouts, moving gates,
painted lights behind walls, narrow viewports, pointer cancellation, tab/offscreen
resume, reduced motion, and client navigation/unmount. Test device loss/fallback
as a separate case. Compare GPU timings on target hardware before tuning quality.
