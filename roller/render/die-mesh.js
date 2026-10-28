// render/die-mesh.js — the visual die: a rounded mesh built from the SAME core shape the physics
// uses, and a numeral atlas painted on a canvas.
//
// The mesh is the core polyhedron swept by a sphere of the die's edge radius, built exactly:
//   faces    the core faces pushed out along their normals — flat, carrying the numerals
//   edges    cylindrical strips between two faces, normals swept from one face to the other
//   corners  spherical patches between the faces meeting at a vertex
// Every vertex normal is the true surface normal of the rounded solid, so the shading is smooth
// and the silhouette is the physics silhouette.
//
// The atlas has one square cell per face plus a blank cell for the rounded parts. A face's UVs map
// its plane onto its cell, so a numeral drawn in the cell lands on the face, square to its edges as
// on a real die. (Turning a numeral freely to face the camera was tried and dropped: it broke that
// alignment — owner 2026-10-24. The printing choice in src/roll.js reads it best instead.)

import * as THREE from 'three';

const EDGE_SEGMENTS = 5;
const CORNER_RINGS = 3;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => mul(a, 1 / Math.sqrt(dot(a, a)));

/** The unit vector a fraction t of the way along the great arc from unit a to unit b. */
function arc(a, b, t) {
  const c = Math.min(1, Math.max(-1, dot(a, b)));
  const theta = Math.acos(c);
  if (theta < 1e-9) return a;
  const s = Math.sin(theta);
  return norm(add(mul(a, Math.sin((1 - t) * theta) / s), mul(b, Math.sin(t * theta) / s)));
}

/**
 * The atlas layout of a die: cell per face, a blank cell last, and each face's 2D frame
 * (origin at its centroid, `v` along its first glyph's up, `u` to the right of it seen from
 * outside, `span` the half-width of the square the cell covers).
 */
export function atlasLayout(die, cellPx = 256) {
  const faces = die.core.faces;
  const cells = faces.length + 1;
  const cols = Math.ceil(Math.sqrt(cells)), rows = Math.ceil(cells / cols);
  const frames = faces.map((f, fi) => {
    const v = die.glyphs[fi][0].up;
    const u = cross(v, f.normal);
    const span = 1.04 * Math.max(...f.verts.map((vi) => Math.sqrt(dot(sub(die.core.vertices[vi], f.centroid), sub(die.core.vertices[vi], f.centroid)))));
    return { u, v, span, origin: f.centroid, normal: f.normal };
  });
  return { cols, rows, cellPx, width: cols * cellPx, height: rows * cellPx, frames, blank: faces.length };
}

/** The UV of mesh point p on face fi. */
function faceUV(layout, fi, p) {
  const fr = layout.frames[fi];
  const d = sub(p, fr.origin);
  const x = dot(d, fr.u), y = dot(d, fr.v);
  const col = fi % layout.cols, row = Math.floor(fi / layout.cols);
  return [
    (col + 0.5 + x / (2 * fr.span)) / layout.cols,
    1 - (row + 0.5 - y / (2 * fr.span)) / layout.rows,
  ];
}

/** The UV of the atlas's blank cell: no numeral (the rounded parts, and a shattered die's broken faces). */
export function blankUV(layout) {
  const c = layout.blank, col = c % layout.cols, row = Math.floor(c / layout.cols);
  return [(col + 0.5) / layout.cols, 1 - (row + 0.5) / layout.rows];
}

/**
 * The rounded die geometry (non-indexed). userData.faceRanges[fi] = [first vertex, count] of the
 * flat face fi; userData.layout is the atlas layout the UVs were built for.
 */
export function buildDieGeometry(die, cellPx = 256) {
  const { vertices: V, faces: F, edges: E, vertexFaces: VF } = die.core;
  const r = die.margin;
  const layout = atlasLayout(die, cellPx);
  const pos = [], nrm = [], uv = [], faceRanges = [];
  const blank = blankUV(layout);

  /** One triangle, wound counter-clockwise seen from outside (flipped if needed). */
  function tri(p, n, t) {
    const g = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    const order = dot(g, add(add(n[0], n[1]), n[2])) < 0 ? [0, 2, 1] : [0, 1, 2];
    for (const k of order) {
      pos.push(p[k].x, p[k].y, p[k].z);
      nrm.push(n[k].x, n[k].y, n[k].z);
      uv.push(t[k][0], t[k][1]);
    }
  }

  // Flat faces, fanned from the centroid.
  F.forEach((f, fi) => {
    const start = pos.length / 3;
    const off = mul(f.normal, r);
    const c = add(f.centroid, off);
    const ring = f.verts.map((vi) => add(V[vi], off));
    ring.forEach((p, k) => {
      const q = ring[(k + 1) % ring.length];
      const pts = [c, p, q];
      tri(pts, [f.normal, f.normal, f.normal], pts.map((x) => faceUV(layout, fi, x)));
    });
    faceRanges[fi] = [start, pos.length / 3 - start];
  });

  // Edge strips.
  for (const e of E) {
    const n1 = F[e.faces[0]].normal, n2 = F[e.faces[1]].normal;
    for (let j = 0; j < EDGE_SEGMENTS; j++) {
      const d0 = arc(n1, n2, j / EDGE_SEGMENTS), d1 = arc(n1, n2, (j + 1) / EDGE_SEGMENTS);
      const a0 = add(V[e.a], mul(d0, r)), a1 = add(V[e.a], mul(d1, r));
      const b0 = add(V[e.b], mul(d0, r)), b1 = add(V[e.b], mul(d1, r));
      tri([a0, b0, b1], [d0, d0, d1], [blank, blank, blank]);
      tri([a0, b1, a1], [d0, d1, d1], [blank, blank, blank]);
    }
  }

  // Corner patches: each sector between two neighbouring face normals, in rings from the centre.
  VF.forEach((ring, vi) => {
    const N = ring.map((fi) => F[fi].normal);
    const C = norm(N.reduce((s, n) => add(s, n), { x: 0, y: 0, z: 0 }));
    const at = (d) => add(V[vi], mul(d, r));
    N.forEach((ni, i) => {
      const nj = N[(i + 1) % N.length];
      for (let j = 0; j < EDGE_SEGMENTS; j++) {
        const b0 = arc(ni, nj, j / EDGE_SEGMENTS), b1 = arc(ni, nj, (j + 1) / EDGE_SEGMENTS);
        for (let s = 0; s < CORNER_RINGS; s++) {
          const p00 = arc(C, b0, s / CORNER_RINGS), p01 = arc(C, b1, s / CORNER_RINGS);
          const p10 = arc(C, b0, (s + 1) / CORNER_RINGS), p11 = arc(C, b1, (s + 1) / CORNER_RINGS);
          if (s === 0) tri([at(C), at(p10), at(p11)], [C, p10, p11], [blank, blank, blank]);
          else {
            tri([at(p00), at(p10), at(p11)], [p00, p10, p11], [blank, blank, blank]);
            tri([at(p00), at(p11), at(p01)], [p00, p11, p01], [blank, blank, blank]);
          }
        }
      }
    });
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  g.userData = { faceRanges, layout };
  g.computeBoundingSphere();
  return g;
}

/** Multiplies the colour of every vertex outside `keepFaces` by `factor` (1 restores). */
export function setDim(geometry, keepFaces, factor) {
  const { faceRanges } = geometry.userData;
  const col = geometry.attributes.color;
  col.array.fill(factor);
  for (const fi of keepFaces) {
    const [start, count] = faceRanges[fi];
    col.array.fill(1, start * 3, (start + count) * 3);
  }
  col.needsUpdate = true;
}

/** Digit height as a fraction of a numeral's slot (the classic font's look before fonts were choosable). */
const DIGIT_HEIGHT = 0.7;

/**
 * Loads a vendored numeral font (an entry of NUMERAL_FONTS with a `file`) so a canvas can paint in
 * it; resolves at once for a system font stack. A font that fails to load is refused loudly.
 */
const loaded = new Map();        // face → its load (a promise)
const loadedFaces = new Set();   // the faces the document has: ready to paint in
export function loadNumeralFont(font) {
  if (!font.file) return Promise.resolve();
  if (!loaded.has(font.face)) {
    const url = new URL('../' + font.file, import.meta.url);
    const face = new FontFace(font.face, 'url(' + url.href + ')', { weight: font.weights || 'normal' });
    loaded.set(font.face, face.load().then((f) => { document.fonts.add(f); loadedFaces.add(font.face); }).catch((e) => {
      loaded.delete(font.face);
      throw new Error('loadNumeralFont: ' + font.face + ' (' + url.href + ') did not load: ' + e.message);
    }));
  }
  return loaded.get(font.face);
}

/**
 * True when a canvas paints in the font now: a system stack always, a vendored face once loadNumeralFont has loaded
 * it. Painted sooner, a vendored font's mask comes out in its fallback (DiceView repaints it once the face arrives).
 */
export function numeralFontLoaded(font) {
  return !font.file || loadedFaces.has(font.face);
}

/**
 * The numeral MASK of a die: white numerals on black in the atlas layout. It carries no colour —
 * the material mixes the ink colour in through it, keeps the ink opaque on see-through finishes,
 * and engraves it through the bump map (render/finishes.js). font is a NUMERAL_FONTS entry (loaded
 * first, if it has a file). Every font is sized so its digit 8 stands the same height, and each
 * numeral is centred on its measured ink, so fonts with different metrics sit alike on the face.
 */
export function paintGlyphMask(die, layout, font) {
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = font.weight + ' 100px ' + font.family;
  const m8 = ctx.measureText('8');
  const per100 = (m8.actualBoundingBoxAscent + m8.actualBoundingBoxDescent) / 100;   // digit height per px of font size
  if (!(per100 > 0)) throw new Error('paintGlyphMask: the font ' + font.family + ' measured no digit height');
  die.glyphs.forEach((glyphs, fi) => {
    const fr = layout.frames[fi];
    const col = fi % layout.cols, row = Math.floor(fi / layout.cols);
    for (const g of glyphs) {
      const d = sub(g.at, fr.origin);
      const x = dot(d, fr.u), y = dot(d, fr.v);
      const px = (col + 0.5 + x / (2 * fr.span)) * layout.cellPx;
      const py = (row + 0.5 - y / (2 * fr.span)) * layout.cellPx;
      const angle = Math.atan2(dot(g.up, fr.u), dot(g.up, fr.v));
      const size = (g.size / (2 * fr.span)) * layout.cellPx;
      const text = die.text(die.features[g.feature].value);
      const ambiguous = die.sides >= 9 && (text === '6' || text === '9');
      const h = size * DIGIT_HEIGHT * font.size;   // the digits' ink height on this face
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.font = font.weight + ' ' + (h / per100).toFixed(1) + 'px ' + font.family;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const ink = ctx.measureText(text);
      ctx.fillText(text, 0, (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2);
      if (ambiguous) ctx.fillRect(-h * 0.31, h * 0.6, h * 0.62, h * 0.1);   // the bar under a 6 or a 9
      ctx.restore();
    }
  });
  const mask = new THREE.CanvasTexture(canvas);
  mask.colorSpace = THREE.NoColorSpace;   // data, not colour
  mask.anisotropy = 8;
  return mask;
}

/** The faces that print a given feature's value (one face for most dice, three for a d4 corner). */
export const facesShowing = (die, feature) =>
  die.glyphs.map((gs, fi) => (gs.some((g) => g.feature === feature) ? fi : -1)).filter((fi) => fi >= 0);
