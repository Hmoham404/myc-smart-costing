// =====================================================================
//  Modeleur paramétrique (type SolidWorks, simplifié) :
//  Esquisse → Extrusion → Congé → Coque → Perçages, avec booléens réels (CSG).
//  Unités : mm. Sortie : géométrie + volume (mm³), surface (mm²), boîte englobante.
// =====================================================================
import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'

export const SKETCHES = { rrect: 'Rectangle arrondi', rect: 'Rectangle', circle: 'Cercle', ellipse: 'Ellipse', polygon: 'Polygone' }

export const defaultModel = () => ({
  sketch: { shape: 'rrect', L: 60, W: 40, radius: 6, sides: 6 },
  extrude: { H: 15 },
  fillet: { r: 1.5 },
  shell: { enabled: true, thickness: 1.5, open: 'bottom' },
  holes: [],
})

function sketchShape(sk, inset = 0) {
  const L = Math.max(1, sk.L - 2 * inset), W = Math.max(1, (sk.shape === 'circle' ? sk.L : sk.W) - 2 * inset)
  const a = L / 2, b = W / 2
  const s = new THREE.Shape()
  if (sk.shape === 'circle' || sk.shape === 'ellipse') {
    s.absellipse(0, 0, a, sk.shape === 'circle' ? a : b, 0, Math.PI * 2, false, 0)
  } else if (sk.shape === 'polygon') {
    const n = Math.max(3, Math.round(sk.sides || 6))
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2 + Math.PI / n; const x = a * Math.cos(t), y = a * Math.sin(t); i ? s.lineTo(x, y) : s.moveTo(x, y) }
    s.closePath()
  } else {
    const r = sk.shape === 'rect' ? 0 : Math.max(0, Math.min((sk.radius || 0) - inset, a - 0.01, b - 0.01))
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); if (r) s.absarc(a - r, -b + r, r, -Math.PI / 2, 0, false)
    s.lineTo(a, b - r); if (r) s.absarc(a - r, b - r, r, 0, Math.PI / 2, false)
    s.lineTo(-a + r, b); if (r) s.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI, false)
    s.lineTo(-a, -b + r); if (r) s.absarc(-a + r, -b + r, r, Math.PI, Math.PI * 1.5, false)
  }
  return s
}

/** Extrusion verticale (axe Y) de h mm à partir de y0, avec congé r sur les arêtes */
function extrudeY(sk, h, y0, inset = 0, r = 0) {
  const fil = Math.max(0, Math.min(r, h / 2 - 0.01, (Math.min(sk.L, sk.shape === 'circle' ? sk.L : sk.W) / 2) - inset - 0.5))
  const geo = new THREE.ExtrudeGeometry(sketchShape(sk, inset + fil), {
    depth: Math.max(0.01, h - 2 * fil), bevelEnabled: fil > 0, bevelThickness: fil, bevelSize: fil, bevelSegments: fil > 0 ? 4 : 0, curveSegments: 32,
  })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, y0 + fil, 0)
  return geo
}

export function volumeOf(geo) {
  const p = geo.attributes.position, idx = geo.index
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let v = 0
  const count = idx ? idx.count : p.count
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i); b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1); c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2)
    v += a.dot(b.clone().cross(c)) / 6
  }
  return Math.abs(v)
}
export function areaOf(geo) {
  const p = geo.attributes.position, idx = geo.index
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let s = 0
  const count = idx ? idx.count : p.count
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i); b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1); c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2)
    s += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2
  }
  return s
}

/** Construit le solide final du modèle */
export function buildSolid(m) {
  const sk = m.sketch, H = Math.max(0.5, m.extrude?.H || 1)
  const ev = new Evaluator()
  ev.attributes = ['position', 'normal']
  let solid = new Brush(extrudeY(sk, H, 0, 0, m.fillet?.r || 0))
  solid.updateMatrixWorld()
  const warnings = []

  // Coque : on retire l'intérieur (décalé de l'épaisseur), face ouverte en bas ou en haut
  if (m.shell?.enabled) {
    const t = Math.max(0.2, m.shell.thickness || 1)
    if (2 * t >= Math.min(sk.L, sk.shape === 'circle' ? sk.L : sk.W) || t >= H) warnings.push('Épaisseur de coque trop grande pour la pièce.')
    else {
      const innerH = H - t + 0.5
      const y0 = m.shell.open === 'top' ? t : -0.5
      const inner = new Brush(extrudeY(sk, innerH, y0, t, Math.max(0, (m.fillet?.r || 0) - t)))
      inner.updateMatrixWorld()
      solid = ev.evaluate(solid, inner, SUBTRACTION)
    }
  }
  // Perçages : cylindres verticaux traversants (ou profondeur donnée depuis le haut)
  for (const h of m.holes || []) {
    const d = Math.max(0.2, h.d || 1)
    const depth = h.depth > 0 ? Math.min(h.depth, H) : H + 2
    const cyl = new Brush(new THREE.CylinderGeometry(d / 2, d / 2, depth, 32))
    cyl.position.set(h.x || 0, H - depth / 2 + (h.depth > 0 ? 0.01 : 1), -(h.y || 0))
    cyl.updateMatrixWorld()
    solid = ev.evaluate(solid, cyl, SUBTRACTION)
  }
  const geo = solid.geometry
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  return {
    geometry: geo,
    volume: volumeOf(geo), // mm³
    area: areaOf(geo), // mm²
    bbox: { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z },
    warnings,
  }
}
