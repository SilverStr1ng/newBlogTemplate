// Native WebGPU / WGSL. RGB = radiance; alpha = transmittance.
// 2D emission/opaque transport, not multibounce GI or diamond refraction.
const uniforms = `
struct Params {
  size: vec4f,
  cascade: vec4f, // spacing, direction tile side, interval start/end
  flags: vec4f, // shape count, last cascade, exposure, unused
};
@group(0) @binding(0) var<uniform> u: Params;
`;

export const FIELD = uniforms + `
struct Shape { endpoints: vec4f, material: vec4f };
@group(0) @binding(1) var<storage, read> shapes: array<Shape>;
@group(0) @binding(2) var output: texture_storage_2d<rgba16float, write>;
fn capsule(p: vec2f, s: Shape) -> f32 {
  let ba = s.endpoints.zw - s.endpoints.xy;
  let h = clamp(dot(p - s.endpoints.xy, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return length(p - s.endpoints.xy - h * ba) - s.material.w;
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= vec2u(u.size.xy))) { return; }
  let p = vec2f(id.xy) + 0.5;
  var dist = 10000.0; var emission = vec3f(0.0); var wall = false;
  for (var i = 0u; i < u32(u.flags.x); i++) {
    let s = shapes[i]; let d = capsule(p, s);
    if (d < dist) { dist = d; emission = s.material.rgb; }
    if (d <= 0.35 && dot(s.material.rgb, s.material.rgb) == 0.0) { wall = true; }
  }
  if (wall) { emission = vec3f(0.0); }
  textureStore(output, vec2i(id.xy), vec4f(dist, emission));
}
`;

const tracing = `
@group(0) @binding(1) var field: texture_2d<f32>;
fn texel(q: vec2i) -> vec4f {
  return textureLoad(field, clamp(q, vec2i(0), vec2i(u.size.xy) - 1), 0);
}
fn scene(p: vec2f) -> vec4f { return texel(vec2i(floor(p))); }
fn distanceAt(p: vec2f) -> f32 {
  // Interpolate distance, NOT material/emission across unrelated surfaces.
  let q = p - 0.5; let b = vec2i(floor(q)); let f = fract(q);
  return mix(mix(texel(b).r, texel(b+vec2i(1,0)).r, f.x),
             mix(texel(b+vec2i(0,1)).r, texel(b+vec2i(1,1)).r, f.x), f.y);
}
fn traceSegment(a: vec2f, b: vec2f) -> vec4f {
  let delta = b-a; let extent = length(delta);
  let direction = delta / max(extent, 0.00001);
  var t = 0.0;
  for (var step = 0u; step < 160u; step++) {
    if (t >= extent) { return vec4f(0.0, 0.0, 0.0, 1.0); }
    let p = a + direction*t;
    if (any(p < vec2f(0.0)) || any(p >= u.size.xy)) { return vec4f(0.0); }
    let d = distanceAt(p);
    if (d <= 0.35) { return vec4f(scene(p).gba * 3.0, 0.0); }
    // Bilinear interpolation of a sampled 1-Lipschitz SDF has a gradient bound
    // of sqrt(2). Step towards its 0.35 isosurface, rather than subtracting a
    // whole pixel each time (which stalled grazing rays and painted dark bands).
    t += max(0.05, (d-0.35)*0.70);
  }
  return vec4f(0.0); // conservative budget exhaustion, never untested light
}
`;

export const CASCADE = uniforms + tracing + `
@group(0) @binding(2) var higher: texture_2d<f32>;
@group(0) @binding(3) var output: texture_storage_2d<rgba16float, write>;
fn upperTexel(probe: vec2i, direction: i32, counts: vec2i, side: i32) -> vec4f {
  let tile = vec2i(direction % side, direction / side);
  return textureLoad(higher, tile * counts + probe, 0);
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= vec2u(u.size.xy))) { return; }
  let counts = vec2u(u.size.xy / u.cascade.x);
  let probe = id.xy % counts; let tile = id.xy / counts;
  let side = u32(u.cascade.y);
  let directionIndex = tile.x + tile.y * side;
  let origin = (vec2f(probe)+0.5)*u.cascade.x;
  var result = vec4f(0.0);
  if (u.flags.y > 0.5) {
    let angle = (f32(directionIndex)+0.5)*6.28318530718/f32(side*side);
    let dir = vec2f(cos(angle), sin(angle));
    result = traceSegment(origin+dir*u.cascade.z, origin+dir*u.cascade.w);
  } else {
    let upperSpacing = u.cascade.x*2.0;
    let upperSide = i32(side)*2;
    let upperCounts = vec2i(u.size.xy / upperSpacing);
    let coord = origin/upperSpacing-0.5;
    let base = vec2i(floor(coord)); let f = fract(coord);
    // Forked/bilinear-fix merge: connect to the ACTUAL upstream interval start.
    // Compose each child and each spatial neighbour BEFORE averaging. Averaging
    // far light first and multiplying by one centre ray caused rings/light leaks.
    for (var child = 0; child < 4; child++) {
      let index = i32(directionIndex)*4+child;
      let angle = (f32(index)+0.5)*6.28318530718/f32(upperSide*upperSide);
      let dir = vec2f(cos(angle), sin(angle));
      for (var y = 0; y < 2; y++) {
        for (var x = 0; x < 2; x++) {
          let q = clamp(base+vec2i(x,y), vec2i(0), upperCounts-1);
          let upperOrigin = (vec2f(q)+0.5)*upperSpacing;
          let weight = select(1.0-f.x, f.x, x==1)*select(1.0-f.y, f.y, y==1)*0.25;
          let near = traceSegment(origin+dir*u.cascade.z, upperOrigin+dir*u.cascade.w);
          let far = upperTexel(q, index, upperCounts, upperSide);
          result += vec4f(near.rgb+near.a*far.rgb, near.a*far.a)*weight;
        }
      }
    }
  }
  textureStore(output, vec2i(id.xy), result);
}
`;

export const COMPOSITE = uniforms + tracing + `
@group(0) @binding(2) var radiance: texture_2d<f32>;
@vertex fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = array<vec2f,3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  return vec4f(p[i],0.0,1.0);
}
fn probeLight(q: vec2i) -> vec3f {
  let counts = vec2i(u.size.xy/2.0);
  return (textureLoad(radiance,q,0).rgb
    + textureLoad(radiance,q+vec2i(counts.x,0),0).rgb
    + textureLoad(radiance,q+vec2i(0,counts.y),0).rgb
    + textureLoad(radiance,q+counts,0).rgb)*0.25;
}
fn kernel(d: f32) -> f32 {
  // Compact quadratic B-spline: continuous, normalized, no negative lobes.
  let x = abs(d);
  if (x < 0.5) { return 0.75-x*x; }
  return 0.5*pow(max(0.0,1.5-x),2.0);
}
fn lightAt(p: vec2f) -> vec3f {
  let coord = p/2.0-0.5; let base = vec2i(floor(coord+0.5));
  let counts = vec2i(u.size.xy/2.0);
  var total = vec3f(0.0); var weight = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let q = base+vec2i(x,y);
      if (any(q < vec2i(0)) || any(q >= counts)) { continue; }
      let origin = (vec2f(q)+0.5)*2.0;
      let w = kernel(coord.x-f32(q.x))*kernel(coord.y-f32(q.y));
      // Reconstruct light only from reachable probes. Not a fullscreen blur:
      // walls/emissive lines keep their edges, and black occluders don't smear.
      let visible = traceSegment(p,origin).a;
      total += probeLight(q)*w*visible; weight += w*visible;
    }
  }
  return total/max(weight,0.00001);
}
@fragment fn fragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let p = position.xy*u.size.xy/u.size.zw;
  let d = distanceAt(p);
  var linear = vec3f(0.0005,0.0008,0.0013);
  if (d <= 0.35) { linear += scene(p).gba*1.4; }
  else { linear += lightAt(p)*0.42; }
  let mapped = vec3f(1.0)-exp(-linear*u.flags.z);
  return vec4f(pow(mapped,vec3f(1.0/2.2)),1.0);
}
`;
