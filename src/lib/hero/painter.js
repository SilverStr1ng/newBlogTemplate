import { distanceToSegment } from './scene.js';

/** Canvas foreground and explicitly approximate, non-RC fallback. */
function path(ctx, s) { ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); }
const cssColor = (rgb, alpha = 1) => `rgba(${rgb.map((v) => Math.round(v * 255)).join(',')},${alpha})`;

// Visibility polygon used ONLY by the Canvas fallback. Each source is masked before
// additive composition, so one source's shadow never erases another source's light.
export function visibilityPolygon(x, y, walls, width, height) {
  const edges = [...walls,
    { x0: 0, y0: 0, x1: width, y1: 0 }, { x0: width, y0: 0, x1: width, y1: height },
    { x0: width, y0: height, x1: 0, y1: height }, { x0: 0, y0: height, x1: 0, y1: 0 }];
  const angles = Array.from({ length: 64 }, (_, i) => i * Math.PI / 32);
  for (const s of edges) for (const [px, py] of [[s.x0, s.y0], [s.x1, s.y1]]) {
    const a = Math.atan2(py - y, px - x); angles.push(a - .0001, a, a + .0001);
  }
  return angles.sort((a, b) => a - b).map((angle) => {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let nearest = Math.hypot(width, height) * 2;
    for (const s of edges) {
      const ex = s.x1 - s.x0, ey = s.y1 - s.y0;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-8) continue;
      const ax = s.x0 - x, ay = s.y0 - y;
      const t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
      if (t > .01 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
    }
    return { x: x + dx * nearest, y: y + dy * nearest };
  });
}

export function createPainter(canvas, diamond) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const vertices = diamond.vertices;
  const projected = Array.from({ length: vertices.length / 3 }, () => ({ x: 0, y: 0, z: 0 }));
  const facets = Array.from({ length: diamond.indices.length / 3 }, (_, i) => ({ indices: diamond.indices.slice(i * 3, i * 3 + 3), z: 0 }));
  let width = 1, height = 1;
  return {
    resize(w, h, dpr = 1) {
      width = Math.max(1, w); height = Math.max(1, h);
      const ratio = Math.min(dpr || 1, 1.5, Math.sqrt(1_600_000 / (width * height)));
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    },
    render(scene, fallback, pointer = { x: .5, y: .5 }) {
      const { view, walls, lights } = scene;
      ctx.clearRect(0, 0, width, height);
      if (fallback) {
        ctx.fillStyle = '#06090e'; ctx.fillRect(0, 0, width, height);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // Keep fallback bounded on low-end devices: three built-ins plus five recent sources.
        for (const light of [...lights.slice(0, 3), ...lights.slice(3).slice(-5)]) {
          const x = (light.x0 + light.x1) / 2, y = (light.y0 + light.y1) / 2;
          if (walls.some((wall) => distanceToSegment(x, y, wall) <= wall.radius)) continue;
          const polygon = visibilityPolygon(x, y, walls, width, height);
          ctx.save(); ctx.beginPath();
          polygon.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
          ctx.closePath(); ctx.clip();
          const radius = Math.max(64, view.scale * .72);
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, cssColor(light.color, .24));
          gradient.addColorStop(.35, cssColor(light.color, .08));
          gradient.addColorStop(1, cssColor(light.color, 0));
          ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
          ctx.restore();
        }
        ctx.restore();
      }
      // Restrained architectural detail. Walls are not rainbow-emitting objects.
      ctx.save(); ctx.lineCap = 'round';
      for (const light of lights) {
        path(ctx, light); ctx.lineWidth = light.radius * 2;
        ctx.strokeStyle = cssColor(light.color, .85); ctx.shadowColor = cssColor(light.color); ctx.shadowBlur = 9; ctx.stroke();
        ctx.lineWidth = Math.max(1, light.radius * .55); ctx.shadowBlur = 0; ctx.strokeStyle = cssColor(light.color.map((v) => Math.min(1, v * 1.4))); ctx.stroke();
      }
      for (const wall of walls) {
        path(ctx, wall); ctx.lineWidth = wall.radius * 2; ctx.strokeStyle = '#0c131d'; ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = wall.moving ? 'rgba(138,199,197,.66)' : 'rgba(154,181,202,.28)'; ctx.stroke();
      }
      ctx.restore();

      // Preserve the supplied GLB-derived faceted model, with less white clipping.
      const rx = -.24 + (pointer.y - .5) * .20, ry = .58 + (pointer.x - .5) * .35;
      const sx = Math.sin(rx), cx = Math.cos(rx), sy = Math.sin(ry), cy = Math.cos(ry);
      const scale = view.scale * .13;
      projected.forEach((p, i) => {
        const x = vertices[i * 3], y = vertices[i * 3 + 1] - .12, z = vertices[i * 3 + 2];
        const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
        p.x = view.cx + (x * cy + z1 * sy) * scale;
        p.y = view.cy - y1 * scale; p.z = -x * sy + z1 * cy;
      });
      for (const f of facets) f.z = f.indices.reduce((sum, i) => sum + projected[i].z, 0) / 3;
      facets.sort((a, b) => a.z - b.z);
      ctx.save(); ctx.lineJoin = 'round';
      for (const face of facets) {
        const [a, b, c] = face.indices.map((i) => projected[i]);
        const front = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
        const brightness = Math.max(0, Math.min(1, face.z + .45));
        ctx.fillStyle = front ? `rgba(149,208,230,${.18 + brightness * .38})` : 'rgba(80,132,160,.045)';
        ctx.fill(); ctx.lineWidth = front ? .85 : .55;
        ctx.strokeStyle = front ? `rgba(205,244,255,${.35 + brightness * .45})` : 'rgba(126,182,204,.14)'; ctx.stroke();
      }
      ctx.restore();
    },
    destroy() { ctx.clearRect(0, 0, width, height); canvas.width = canvas.height = 1; },
  };
}
