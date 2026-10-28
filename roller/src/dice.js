// src/dice.js — THE die registry and everything derived from it.
//
// DIE_TYPES holds one entry per die, all the same shape. buildDie(type) turns an entry into the
// definition the solver, the readout and the renderer share: the rounded convex shape, mass and
// inertia, the result FEATURES (a face for most dice, a vertex for the d4) with their values, the
// glyphs printed on each face, and the die's rotation symmetry group. Adding a die is adding an
// entry; nothing downstream branches on a die's name.
//
// Sizes are circumradii in metres (the core polyhedron's corners before rounding); edgeRadius is
// the rounding of every edge and corner. A rounded die is the core polyhedron swept by a sphere
// of edgeRadius — flat faces exactly where the sharp die's faces are, round everywhere else.

import { SOLIDS, buildPolyhedron, massProperties, inradius } from './geometry.js';
import { DIE_MATERIALS, lookup } from './materials.js';
import {
  sub, scale, dot, length, normalize, lerp, perpendicular,
  mvec, minverse, frameOf, mmul, mtranspose, quatFromMat3,
} from './math.js';

export const DIE_TYPES = {
  d4: { sides: 4, solid: 'tetrahedron', circumradius: 0.0125, edgeRadius: 0.0008, readout: 'vertex', glyphUp: 'vertex', glyphSize: 0.62 },
  d6: { sides: 6, solid: 'cube', circumradius: 0.0139, edgeRadius: 0.0016, readout: 'face', glyphUp: 'edge', glyphSize: 0.95 },
  d8: { sides: 8, solid: 'octahedron', circumradius: 0.0110, edgeRadius: 0.0008, readout: 'face', glyphUp: 'vertex', glyphSize: 0.95 },
  d10: { sides: 10, solid: 'trapezohedron5', circumradius: 0.0110, edgeRadius: 0.0008, readout: 'face', glyphUp: 'vertex', glyphSize: 0.9, zeroForMax: true },
  d12: { sides: 12, solid: 'dodecahedron', circumradius: 0.0120, edgeRadius: 0.0008, readout: 'face', glyphUp: 'vertex', glyphSize: 0.85 },
  d20: { sides: 20, solid: 'icosahedron', circumradius: 0.0124, edgeRadius: 0.0008, readout: 'face', glyphUp: 'vertex', glyphSize: 0.95 },
};

// ---------------------------------------------------------------- glyph "up" rules
// Where the top of a face's numeral points, within the face.
const GLYPH_UP = {
  /** Toward the face's farthest corner (the kite's apex on a d10; ties go to the lowest index). */
  vertex: (poly, f) => {
    let best = -1, bestD = -1;
    for (const vi of f.verts) {
      const d = length(sub(poly.vertices[vi], f.centroid));
      if (d > bestD + 1e-12) { bestD = d; best = vi; }
    }
    return normalize(sub(poly.vertices[best], f.centroid));
  },
  /** Toward the middle of the face's first edge (square faces: the numeral sits parallel to an edge). */
  edge: (poly, f) => normalize(sub(lerp(poly.vertices[f.verts[0]], poly.vertices[f.verts[1]], 0.5), f.centroid)),
};

// ---------------------------------------------------------------- readout strategies
// Which features carry the result and how they are printed. One strategy per kind of reading.
const READOUTS = {
  /** The face that ends up on top shows the result; each face carries its own numeral. */
  face: {
    features: (poly) => poly.faces.map((f) => ({ dir: f.normal })),
    glyphs: (poly, fi, entry) => {
      const f = poly.faces[fi];
      return [{ feature: fi, at: f.centroid, up: GLYPH_UP[entry.glyphUp](poly, f), size: entry.glyphSize * faceInradius(poly, f) }];
    },
    featureUp: (poly, k, entry) => GLYPH_UP[entry.glyphUp](poly, poly.faces[k]),
  },
  /** The corner that ends up on top shows the result; each face prints every corner's number near that corner. */
  vertex: {
    features: (poly) => poly.vertices.map((p) => ({ dir: normalize(p) })),
    glyphs: (poly, fi, entry) => {
      const f = poly.faces[fi];
      return f.verts.map((vi) => ({
        feature: vi,
        at: lerp(f.centroid, poly.vertices[vi], 0.52),
        up: normalize(sub(poly.vertices[vi], f.centroid)),
        size: entry.glyphSize * faceInradius(poly, f),
      }));
    },
    featureUp: (poly, k) => perpendicular(normalize(poly.vertices[k])),
  },
};

/** The distance from a face's centroid to its nearest edge — how big a numeral the face can hold. */
function faceInradius(poly, f) {
  let best = Infinity;
  f.verts.forEach((a, k) => {
    const p = poly.vertices[a], q = poly.vertices[f.verts[(k + 1) % f.verts.length]];
    const e = normalize(sub(q, p));
    const d = sub(f.centroid, p);
    best = Math.min(best, length(sub(d, scale(e, dot(d, e)))));
  });
  return best;
}

/**
 * The value on each feature. Opposite features sum to sides + 1 (a fair die's convention); within
 * each opposite pair the upper member takes the odd value, so a d10's odd numbers ring one apex
 * and its even numbers the other. A die without opposite features (the d4) counts its features.
 */
function assignValues(features, sides) {
  const n = features.length;
  const opposite = features.map((f, i) => features.findIndex((g, j) => j !== i && dot(f.dir, g.dir) < -1 + 1e-9));
  const values = new Array(n).fill(0);
  if (opposite.every((j) => j < 0)) {
    features.forEach((_, i) => { values[i] = i + 1; });
    return values;
  }
  if (opposite.some((j) => j < 0)) throw new Error('assignValues: some features have an opposite and some do not');
  const above = (a, b) => {
    const da = features[a].dir, db = features[b].dir;
    for (const k of ['y', 'x', 'z']) { if (Math.abs(da[k] - db[k]) > 1e-9) return da[k] > db[k]; }
    return a < b;
  };
  const pairs = [];
  features.forEach((_, i) => { const j = opposite[i]; if (i < j) pairs.push(above(i, j) ? [i, j] : [j, i]); });
  // Order the pairs by their upper member: highest first, then around the vertical axis.
  pairs.sort(([a], [b]) => {
    const da = features[a].dir, db = features[b].dir;
    if (Math.abs(da.y - db.y) > 1e-9) return db.y - da.y;
    if (Math.abs(da.x - db.x) > 1e-9) return db.x - da.x;
    return db.z - da.z;
  });
  pairs.forEach(([top, bottom], i) => { values[top] = 2 * i + 1; values[bottom] = sides - 2 * i; });
  return values;
}

/**
 * The rotation symmetry group: every rotation that maps the die onto itself, each with the
 * permutation it applies to the features (perm[k] = the feature that feature k lands on).
 */
function symmetryGroup(poly, features) {
  const dirs = features.map((f) => f.dir);
  const d0 = dirs[0];
  const i1 = dirs.findIndex((d) => Math.abs(dot(d, d0)) < 0.99);
  const d1 = dirs[i1];
  const angle = dot(d0, d1);
  const base = mtranspose(frameOf(d0, d1));
  const eps = 1e-7 * Math.max(...poly.vertices.map(length));
  const found = [];
  dirs.forEach((a, i) => dirs.forEach((b, j) => {
    if (i === j || Math.abs(dot(a, b) - angle) > 1e-9) return;
    const m = mmul(frameOf(a, b), base);
    const mapsVertices = poly.vertices.every((p) => {
      const r = mvec(m, p);
      return poly.vertices.some((q) => length(sub(r, q)) < eps);
    });
    if (!mapsVertices) return;
    const perm = dirs.map((d) => {
      const r = mvec(m, d);
      return dirs.findIndex((e) => dot(r, e) > 1 - 1e-9);
    });
    found.push({ m, q: quatFromMat3(m), perm });
  }));
  return found;
}

const cache = new Map();

/**
 * The full definition of a die type. Options override the registry entry for this build
 * (material, circumradius, edgeRadius); definitions are cached per type and options.
 */
export function buildDie(type, options = {}) {
  const entry0 = lookup(DIE_TYPES, type, 'die type');
  const key = type + JSON.stringify(options);
  if (cache.has(key)) return cache.get(key);
  const entry = { ...entry0, ...options };
  const material = { ...lookup(DIE_MATERIALS, entry.material || 'resin', 'die material'), ...(entry.materialOverrides || {}) };

  // The sharp die at its nominal size: mass, features and glyphs are measured on it.
  const nominal = buildPolyhedron(SOLIDS[entry.solid](), entry.circumradius);
  // The core the sphere sweeps: shrunk so its faces sit edgeRadius inside the nominal faces.
  const r0 = inradius(nominal);
  if (!(entry.edgeRadius >= 0 && entry.edgeRadius < r0 * 0.5)) throw new Error('buildDie ' + type + ': edgeRadius ' + entry.edgeRadius + ' out of range');
  const shrink = (r0 - entry.edgeRadius) / r0;
  const core = {
    vertices: nominal.vertices.map((p) => scale(p, shrink)),
    faces: nominal.faces.map((f) => ({ ...f, offset: f.offset * shrink, centroid: scale(f.centroid, shrink) })),
    edges: nominal.edges,
    vertexFaces: nominal.vertexFaces,
  };

  const mp = massProperties(nominal, material.density);
  const readout = READOUTS[entry.readout];
  if (!readout) throw new Error('buildDie ' + type + ': unknown readout "' + entry.readout + '"');
  const features = readout.features(core);
  if (features.length !== entry.sides) throw new Error('buildDie ' + type + ': the ' + entry.solid + ' gives ' + features.length + ' ' + entry.readout + ' features for a ' + entry.sides + '-sided die');
  const values = assignValues(features, entry.sides);
  features.forEach((f, k) => {
    f.value = values[k];
    f.up = readout.featureUp(core, k, entry);
  });
  const featureOfValue = new Map(features.map((f, k) => [f.value, k]));
  if (featureOfValue.size !== entry.sides) throw new Error('buildDie ' + type + ': values are not 1..' + entry.sides);
  const symmetries = symmetryGroup(core, features);
  // The turn that turns nothing: a die printed as it lies (a drop's resting dice keep it, src/roll.js ▸ finish).
  const identity = symmetries.find((s) => s.perm.every((p, k) => p === k));
  if (!identity) throw new Error('buildDie ' + type + ': the symmetry group has no identity');

  const die = {
    type,
    sides: entry.sides,
    entry,
    material,
    core,
    margin: entry.edgeRadius,
    boundingRadius: Math.max(...core.vertices.map(length)) + entry.edgeRadius,
    mass: mp.mass,
    inertia: mp.inertia,
    invInertia: minverse(mp.inertia),
    features,
    featureOfValue,
    glyphs: core.faces.map((_, fi) => readout.glyphs(core, fi, entry)),
    symmetries,
    identity,
    text: (value) => (entry.zeroForMax && value === entry.sides ? '0' : String(value)),
  };
  cache.set(key, Object.freeze(die));
  return die;
}

/** The die types in registry order. */
export const dieTypes = () => Object.keys(DIE_TYPES);

