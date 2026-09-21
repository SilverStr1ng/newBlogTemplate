# Living labyrinth hero

The homepage uses `LightHero` with `client:load`. Blog routes, content, diamond
asset, runtime dependencies and the application lockfile are unchanged.

## Presentation

The visible description, draw hint, article CTA, preset/countdown/backend readout
and text-button group have been removed. Only the title and existing eyebrow
remain. A small icon-only pause control preserves control over autoplay. Touch
screens also get an icon-only drawing toggle so ordinary swipes still scroll.
Keyboard-only place/next/reset controls are revealed **only while focused**.
There is no visible telemetry. Inspect `.hero.dataset.backend` for `webgpu`, `2d`
or `unavailable`; the fallback must not be mistaken for radiance cascades.

Navigation links for Posts/Cases are zinc-200 when inactive and white when active
or hovered. At narrow widths the GitHub wordmark becomes its existing arrow link,
with its accessible name preserved, to avoid squeezing the other navigation.

## Scene and timing

The 24-segment fixed scaffold combines a broken chamfered inner chamber, staggered
outer galleries and diagonal passages. Six gates translate, rotate or retract;
only three move per transition. Four curated states cycle, with a 12-second hold,
1.8-second morph and 4-second post-drawing observation window. All intermediate
poses retain a clear diamond chamber. It is an optical scene, not a guaranteed
walkable generated maze. Walls are opaque geometry, not decorative light strokes.

Drawing freezes the current morph. Pause freezes geometry and stroke aging.
Reduced motion disables autoplay and fades; explicit Next changes state without
animation. Touch scrolling is preserved until touch drawing is explicitly enabled.
Strokes last 4.5 seconds with a maximum of 64 segments; input is in normalized CSS
coordinates. A 128-shape storage limit covers 30 walls plus all built-in/user lights.

## Rendering and shadow refinement

`scene.js` owns geometry/time, `shaders.js` the WGSL, `gpu.js` device/resources,
`painter.js` the original diamond/foreground and 2D fallback, `controller.js` input
and lifecycle. This is native WebGPU, with no imported vgpu package.

The field is a sampled capsule distance/emission texture, followed by five
radiance/transmittance cascades and reconstruction. It models **2D emitted light
with opaque occlusion**, not multibounce GI, refraction, dispersion or caustics.
The 3D diamond is an overlaid mesh with a separate 2D emissive core.

The original merge averaged upstream radiance and multiplied it by a single
centre ray. The revised merge traces to the actual upstream interval starts,
composes **each of four angular children at each spatial neighbour before
averaging**, and clamps boundary probes. This is a forked/bilinear-fix approach
intended to reduce ringing and unrelated light leaking between probe locations.
Reference: Osborne & Sannikov, “Radiance cascades: a novel high-resolution formal
solution for multidimensional non-LTE radiative transfer”, Appendix A,
https://doi.org/10.1093/rasti/rzae062 .

Distance is bilinearly reconstructed separately from emission/material. A bounded
160-step tracer uses the sampled field's gradient bound rather than repeatedly
subtracting a full pixel (which could exhaust grazing rays and create dark bands).
Final lighting uses a compact positive 3x3 quadratic reconstruction weighted by
probe visibility. It does not blur the whole canvas or average black walls into
nearby light. Exposure/floor brightness are restrained rather than hiding defects
under more bloom. Sampling remains approximate; do not claim exact transport.

## Work bounds

Field/cascade textures remain capped at 512 x 320, divisible by 32; display output
is capped at DPR 1.5 and about 1.6 million pixels. Forked merging costs more rays
than the old merge. Stable frames are cached; only one GPU frame is in flight and
new inputs coalesce to the latest scene. Resize discards stale queued geometry.
No hardware FPS/battery improvement is claimed without measurement.

Hidden/offscreen scheduling, pointer cancellation, reduced motion and cleanup are
owned by the existing controller. GPU initialization/compilation/device failure
uses the non-RC Canvas fallback. All resources are released on unmount.

## Validation

```sh
node --test tests/hero*.test.mjs
pnpm install --frozen-lockfile
pnpm build
```

`Hero checks` additionally installs pinned Playwright 1.63.0 **outside the runtime
project**, opens the built Astro/Svelte site, checks five viewport widths, all
four keyboard-selectable layouts, pause/drawing, and executes an opaque-barrier
pixel fixture through the actual WGSL pipelines. Screenshots and JSON results
are retained as `hero-browser-results` workflow artifacts. Browser validation
uses Chromium/SwiftShader: real shader compilation and software execution, **not
physical GPU testing or a hardware performance benchmark**. A successful CI run,
not the existence of these scripts, is the evidence that those checks passed.

For local browser validation after building:

```sh
npm install --prefix /tmp/hero-browser playwright@1.63.0
node /tmp/hero-browser/node_modules/playwright/cli.js install --with-deps chromium
HERO_BROWSER_DEPS=/tmp/hero-browser node tests/hero-browser.mjs
```

The editing container blocks localhost browser navigation and cannot resolve the
repository/dependency hosts. Local Node tests can run; full-site and shader checks
therefore run in the authorized repository's CI instead. Target-device visual
review/performance measurement remains separate from the software smoke tests.
