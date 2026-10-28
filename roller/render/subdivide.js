// render/subdivide.js — a triangle soup split finer, so a shader that bends it (Melt's slump, render/exit-shader.js)
// bends it smoothly: a die's flat faces are a few big triangles, and a bend only moves vertices. Plain arrays and no
// three.js, so node tests it.
//
//   for (const soup of subdividePasses(mesh, maxEdge)) …   // one pass a step: every edge longer than maxEdge halved
//   const fine = subdivide(mesh, maxEdge)                    // all of them at once
//
// mesh is { position, normal, uv, color } (flat arrays, a triangle soup, as render/die-mesh.js builds it). A pass
// halves every edge longer than maxEdge and splits each triangle by how many of its edges were halved (0 to 3), so an
// edge two triangles share is halved in both, at the very same point: the surface stays closed — no crack opens where a
// bend moves a midpoint one triangle has and its neighbour lacks. Every attribute is carried to the midpoint; a
// normal is renormalised.

/** The soup split finer, every edge at most maxEdge long. */
export function subdivide(mesh, maxEdge) {
  let out = mesh;
  for (const soup of subdividePasses(mesh, maxEdge)) out = soup;
  return out;
}

/** subdivide's passes, one at a time (Melt splits the die over the frames it trembles). */
export function* subdividePasses(mesh, maxEdge, maxPasses = 8) {
  if (!(maxEdge > 0)) throw new Error('subdivide: maxEdge must be a positive length, got ' + maxEdge);
  let soup = toSoup(mesh);
  for (let pass = 0; pass < maxPasses; pass++) {
    const next = splitOnce(soup, maxEdge * maxEdge);
    if (!next) return;
    soup = next;
    yield soup;
  }
  throw new Error('subdivide: still had edges over ' + maxEdge + ' after ' + maxPasses + ' passes');
}

function toSoup(mesh) {
  const n = mesh.position.length / 3;
  return {
    position: Float32Array.from(mesh.position), normal: Float32Array.from(mesh.normal),
    uv: Float32Array.from(mesh.uv), color: Float32Array.from(mesh.color || new Array(3 * n).fill(1)),
  };
}

/** One pass, or null when no edge is longer than the limit (√ of `limit2`). */
function splitOnce(soup, limit2) {
  const { position: P, normal: N, uv: T, color: C } = soup;
  const count = P.length / 9;
  const out = { position: [], normal: [], uv: [], color: [] };
  let split = false;
  const get = (i) => ({ p: [P[3 * i], P[3 * i + 1], P[3 * i + 2]], n: [N[3 * i], N[3 * i + 1], N[3 * i + 2]], t: [T[2 * i], T[2 * i + 1]], c: [C[3 * i], C[3 * i + 1], C[3 * i + 2]] });
  const long = (a, b) => (a.p[0] - b.p[0]) ** 2 + (a.p[1] - b.p[1]) ** 2 + (a.p[2] - b.p[2]) ** 2 > limit2;
  const put = (...vs) => {
    for (const v of vs) { out.position.push(...v.p); out.normal.push(...v.n); out.uv.push(...v.t); out.color.push(...v.c); }
  };
  for (let t = 0; t < count; t++) {
    const v = [get(3 * t), get(3 * t + 1), get(3 * t + 2)];
    // m[k]: the midpoint of edge k (v[k] → v[k+1]), where that edge is long.
    const m = [0, 1, 2].map((k) => (long(v[k], v[(k + 1) % 3]) ? mid(v[k], v[(k + 1) % 3]) : null));
    const n = m.filter(Boolean).length;
    if (n) split = true;
    if (n === 0) { put(v[0], v[1], v[2]); continue; }
    if (n === 3) { put(v[0], m[0], m[2], m[0], v[1], m[1], m[2], m[1], v[2], m[0], m[1], m[2]); continue; }
    // Turn the triangle so its split edges come first, keeping its winding.
    let r = 0;
    if (n === 1) r = m.findIndex(Boolean);
    else r = m.findIndex((x, k) => x && m[(k + 1) % 3]);
    const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3], mab = m[r], mbc = m[(r + 1) % 3];
    if (n === 1) { put(a, mab, c, mab, b, c); continue; }
    // Two edges split (a→b and b→c): the corner at b, then the rest as two triangles.
    put(mab, b, mbc, a, mab, mbc, a, mbc, c);
  }
  if (!split) return null;
  return { position: Float32Array.from(out.position), normal: Float32Array.from(out.normal), uv: Float32Array.from(out.uv), color: Float32Array.from(out.color) };
}

/** The midpoint of an edge, every attribute halfway; the same bits whichever way round the edge is read. */
function mid(a, b) {
  const half = (x, y) => x.map((xi, i) => (xi + y[i]) * 0.5);
  const n = half(a.n, b.n), l = Math.hypot(n[0], n[1], n[2]) || 1;
  return { p: half(a.p, b.p), n: [n[0] / l, n[1] / l, n[2] / l], t: half(a.t, b.t), c: half(a.c, b.c) };
}
