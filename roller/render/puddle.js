// render/puddle.js — one liquid surface shared by all of a melting die's pieces.
// Gaussian volumes add before drawing: neighbouring lobes form a neck instead of overlapping
// closed shells. A contour-following mesh keeps the rounded rim smooth as the liquid moves.
export const PUDDLE = {
  rings: 20, segments: 96, level: Math.exp(-1), gather: 0.60, spread: 0.08,
  height: 0.16, floor: 0.00008,
};
const smooth = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export function poolLobes(seeds, progress) {
  const q = smooth(progress), weight = seeds.reduce((s, p) => s + p.radius * p.radius, 0);
  const cx = seeds.reduce((s, p) => s + p.x * p.radius * p.radius, 0) / weight;
  const cz = seeds.reduce((s, p) => s + p.z * p.radius * p.radius, 0) / weight;
  return seeds.map(p => ({
    x: cx + (p.x - cx) * (1 - PUDDLE.gather * q),
    z: cz + (p.z - cz) * (1 - PUDDLE.gather * q),
    radius: p.radius * (1 + PUDDLE.spread * q),
  }));
}

/** Density and its analytic derivatives: one smooth surface, including the neck between lobes. */
export function poolField(x, z, lobes) {
  let value = 0, dx = 0, dz = 0;
  for (const p of lobes) {
    const a = x - p.x, b = z - p.z, inv = 1 / (p.radius * p.radius);
    const v = Math.exp(-(a * a + b * b) * inv);
    value += v; dx -= 2 * a * inv * v; dz -= 2 * b * inv * v;
  }
  return { value, dx, dz };
}

/**
 * One closed pool, with reusable buffers. Its outline follows the summed liquid's isocontour;
 * radial rings bunch up toward its steep rim. A very thin connecting film beneath early lobes
 * keeps the pool continuous while the solid pieces feed it. The film is submerged as they merge.
 */
export function createPoolSurface(seeds, radius, { rings = PUDDLE.rings, segments = PUDDLE.segments } = {}) {
  if (!seeds.length || !Number.isFinite(radius) || radius <= 0 ||
      !Number.isInteger(rings) || rings < 4 || rings > 40 ||
      !Number.isInteger(segments) || segments < 16 || segments > 128 ||
      seeds.some(p => ![p.x, p.z, p.radius].every(Number.isFinite) || p.radius <= 0)) {
    throw Error('puddle: finite lobes, a positive radius, 4–40 rings and 16–128 segments are required');
  }
  const centres = poolLobes(seeds, 1), weight = seeds.reduce((s, p) => s + p.radius * p.radius, 0);
  const cx = seeds.reduce((s, p) => s + p.x * p.radius * p.radius, 0) / weight;
  const cz = seeds.reduce((s, p) => s + p.z * p.radius * p.radius, 0) / weight;
  const reach = Math.max(...seeds.map(p => Math.hypot(p.x - cx, p.z - cz))) +
    Math.max(...centres.map(p => p.radius)) * Math.sqrt(Math.log(seeds.length / PUDDLE.level)) + radius * .02;
  const position = new Float32Array(6 * rings * segments * 3), normal = new Float32Array(position.length);
  const points = Array.from({ length: (rings + 1) * segments }, () => ({ x: 0, y: 0, z: 0, n: [0, 1, 0] }));
  const directions = Array.from({ length: segments }, (_, k) => [Math.cos(2 * Math.PI * k / segments), Math.sin(2 * Math.PI * k / segments)]);
  let count = 0, lobes = null, height = 0;
  const density = (r, dir) => poolField(cx + r * dir[0], cz + r * dir[1], lobes).value;
  const outline = dir => {
    let hi = reach, lo = 0;
    // Search inward for the outer crossing; early lobes can still have a thin valley between them.
    for (let k = 1; k <= 24; k++) {
      lo = reach * (1 - k / 24);
      if (density(lo, dir) >= PUDDLE.level) break;
      hi = lo;
    }
    if (hi === 0) return radius * .12;
    for (let k = 0; k < 13; k++) {
      const mid = (lo + hi) / 2;
      if (density(mid, dir) >= PUDDLE.level) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const vertex = (p, bottom) => {
    const at = 3 * count++;
    position[at] = p.x; position[at + 1] = bottom ? PUDDLE.floor : p.y; position[at + 2] = p.z;
    normal[at] = bottom ? 0 : p.n[0]; normal[at + 1] = bottom ? -1 : p.n[1]; normal[at + 2] = bottom ? 0 : p.n[2];
  };
  return {
    position, normal, get count() { return count; }, get lobes() { return lobes; },
    write(progress) {
      lobes = poolLobes(seeds, progress);
      height = radius * PUDDLE.height * smooth(progress / .28) / (1 + .6 * smooth(progress));
      count = 0;
      directions.forEach((dir, k) => {
        const rim = outline(dir);
        for (let j = 0; j <= rings; j++) {
          const share = Math.sin(j / rings * Math.PI / 2), r = rim * share;
          const p = points[j * segments + k];
          p.x = cx + r * dir[0]; p.z = cz + r * dir[1];
          const f = poolField(p.x, p.z, lobes), h = Math.sqrt(Math.max(0, Math.log(f.value / PUDDLE.level)));
          const film = .03 * (1 - share * share);
          p.y = PUDDLE.floor + height * (j === rings ? 0 : Math.max(h, film));
          let nx, ny, nz;
          if (h > film || j === rings) { nx = -height * f.dx; ny = j === rings ? 0 : 2 * f.value * h; nz = -height * f.dz; }
          else { nx = 2 * height * .03 * r * dir[0] / (rim * rim); ny = 1; nz = 2 * height * .03 * r * dir[1] / (rim * rim); }
          const length = Math.hypot(nx, ny, nz);
          p.n = length > 1e-12 ? [nx / length, ny / length, nz / length] : [0, 1, 0];
        }
      });
      for (let k = 0; k < segments; k++) {
        const next = (k + 1) % segments;
        for (let j = 0; j < rings; j++) {
          const a = points[j * segments + k], b = points[j * segments + next];
          const c = points[(j + 1) * segments + next], d = points[(j + 1) * segments + k];
          vertex(a, false); vertex(c, false); vertex(d, false);
          if (j) { vertex(a, false); vertex(b, false); vertex(c, false); }
        }
        vertex(points[0], true); vertex(points[rings * segments + k], true); vertex(points[rings * segments + next], true);
      }
      return count;
    },
    samples() {
      const all = [], middles = [];
      for (let i = 0; i < count; i += 7) {
        const at = 3 * i, p = [position[at], position[at + 2]];
        all.push(p);
        if (position[at + 1] > PUDDLE.floor + .2 * height) middles.push(p);
      }
      return { points: all, middles };
    },
  };
}
