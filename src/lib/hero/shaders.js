// Native WebGPU / WGSL. RGB is emitted radiance; alpha in the cascade is transmittance.
// This is a single-pass, 2D radiance-cascade solution, NOT a multi-bounce or refractive solver.
const uniforms = `
struct Params {
  size: vec4f, // field width/height, output width/height
  cascade: vec4f, // probe spacing, direction tile side, interval start/end
  flags: vec4f, // shape count, is last cascade, exposure, unused
};
@group(0) @binding(0) var<uniform> u: Params;
`;

export const FIELD = uniforms + `
struct Shape { endpoints: vec4f, material: vec4f }; // material.rgb, radius
@group(0) @binding(1) var<storage, read> shapes: array<Shape>;
@group(0) @binding(2) var output: texture_storage_2d<rgba16float, write>;
fn capsule(p: vec2f, s: Shape) -> f32 {
  let a = s.endpoints.xy; let b = s.endpoints.zw;
  let ba = b - a;
  let h = clamp(dot(p - a, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return length(p - a - h * ba) - s.material.w;
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= vec2u(u.size.xy))) { return; }
  let p = vec2f(id.xy) + 0.5;
  var dist = 10000.0; var emission = vec3f(0.0); var wall = false;
  for (var i = 0u; i < u32(u.flags.x); i++) {
    let s = shapes[i]; let d = capsule(p, s);
    if (d < dist) { dist = d; emission = s.material.rgb; }
    if (d <= 0.65 && dot(s.material.rgb, s.material.rgb) == 0.0) { wall = true; }
  }
  // A light painted on a wall cannot punch a hole in the occluder.
  if (wall) { emission = vec3f(0.0); }
  textureStore(output, vec2i(id.xy), vec4f(dist, emission));
}
`;

const tracing = `
@group(0) @binding(1) var field: texture_2d<f32>;
fn scene(p: vec2f) -> vec4f {
  let pixel = clamp(vec2i(floor(p)), vec2i(0), vec2i(u.size.xy) - 1);
  return textureLoad(field, pixel, 0);
}
fn trace(origin: vec2f, direction: vec2f, start: f32, end: f32) -> vec4f {
  var t = start;
  for (var step = 0u; step < 96u; step++) {
    if (t >= end) { return vec4f(0.0, 0.0, 0.0, 1.0); }
    let p = origin + direction * t;
    if (any(p < vec2f(0.0)) || any(p >= u.size.xy)) { return vec4f(0.0); }
    let hit = scene(p);
    if (hit.r <= 0.75) { return vec4f(hit.gba * 3.0, 0.0); }
    // The field is sampled at texel centers. Subtract a pixel-diagonal guard
    // instead of trusting the sampled distance and stepping through thin walls.
    t += max(0.25, hit.r - 0.8);
  }
  // Budget exhaustion is conservatively opaque, never an untested transparent ray.
  return vec4f(0.0);
}
`;

export const CASCADE = uniforms + tracing + `
@group(0) @binding(2) var higher: texture_2d<f32>;
@group(0) @binding(3) var output: texture_storage_2d<rgba16float, write>;
fn upperTexel(probe: vec2i, direction: i32, counts: vec2i, side: i32) -> vec4f {
  if (any(probe < vec2i(0)) || any(probe >= counts)) { return vec4f(0.0); }
  let tile = vec2i(direction % side, direction / side);
  return textureLoad(higher, tile * counts + probe, 0);
}
fn upper(origin: vec2f, direction: i32) -> vec4f {
  let spacing = u.cascade.x * 2.0;
  let side = i32(u.cascade.y) * 2;
  let counts = vec2i(u.size.xy / spacing);
  let coord = origin / spacing - 0.5;
  let base = vec2i(floor(coord)); let f = fract(coord);
  let a = mix(upperTexel(base, direction, counts, side), upperTexel(base + vec2i(1,0), direction, counts, side), f.x);
  let b = mix(upperTexel(base + vec2i(0,1), direction, counts, side), upperTexel(base + vec2i(1,1), direction, counts, side), f.x);
  return mix(a, b, f.y);
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= vec2u(u.size.xy))) { return; }
  let counts = vec2u(u.size.xy / u.cascade.x);
  let probe = id.xy % counts;
  let tile = id.xy / counts;
  let side = u32(u.cascade.y);
  let directionIndex = tile.x + tile.y * side;
  let angle = (f32(directionIndex) + 0.5) * 6.28318530718 / f32(side * side);
  let origin = (vec2f(probe) + 0.5) * u.cascade.x;
  let near = trace(origin, vec2f(cos(angle), sin(angle)), u.cascade.z, u.cascade.w);
  var result = near;
  if (u.flags.y < 0.5 && near.a > 0.0) {
    var far = vec4f(0.0);
    for (var child = 0; child < 4; child++) { far += upper(origin, i32(directionIndex) * 4 + child); }
    far *= 0.25;
    result = vec4f(near.rgb + near.a * far.rgb, near.a * far.a);
  }
  textureStore(output, vec2i(id.xy), result);
}
`;

export const COMPOSITE = uniforms + tracing + `
@group(0) @binding(2) var radiance: texture_2d<f32>;
@vertex fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = array<vec2f, 3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  return vec4f(p[i], 0.0, 1.0);
}
fn probeLight(probe: vec2i) -> vec3f {
  let counts = vec2i(u.size.xy / 2.0);
  let q = clamp(probe, vec2i(0), counts - 1);
  return (textureLoad(radiance, q, 0).rgb
    + textureLoad(radiance, q + vec2i(counts.x,0), 0).rgb
    + textureLoad(radiance, q + vec2i(0,counts.y), 0).rgb
    + textureLoad(radiance, q + counts, 0).rgb) * 0.25;
}
fn lightAt(p: vec2f) -> vec3f {
  let coord = p / 2.0 - 0.5; let base = vec2i(floor(coord)); let f = fract(coord);
  var total = vec3f(0.0); var weight = 0.0;
  for (var y = 0; y < 2; y++) {
    for (var x = 0; x < 2; x++) {
      let q = base + vec2i(x,y);
      let origin = (vec2f(q) + 0.5) * 2.0;
      let delta = origin - p; let distance = length(delta);
      let w = select(1.0-f.x, f.x, x == 1) * select(1.0-f.y, f.y, y == 1);
      // Visibility-aware upsampling avoids blending a lit probe through a nearby wall.
      let visible = trace(p, delta / max(distance, 0.0001), 0.0, distance).a;
      total += probeLight(q) * w * visible; weight += w * visible;
    }
  }
  return total / max(weight, 0.0001);
}
@fragment fn fragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let p = position.xy * u.size.xy / u.size.zw;
  let hit = scene(p);
  var linear = vec3f(0.0007, 0.0010, 0.0016);
  if (hit.r <= 0.75) {
    linear += hit.gba * 1.4;
  } else {
    linear += lightAt(p) * 0.5;
  }
  let mapped = vec3f(1.0) - exp(-linear * u.flags.z);
  return vec4f(pow(mapped, vec3f(1.0 / 2.2)), 1.0);
}
`;
