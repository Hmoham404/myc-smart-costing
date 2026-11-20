import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Lightformer, ContactShadows, Html, Line, Bounds } from '@react-three/drei'
import { FINISHES } from '../lib/pieces'
import LOGO_DG from '../lib/logoDG.json'

const S = 0.01 // 1 mm = 0.01 unité 3D
const N = 120

// ---------- Contours 2D (mm, centrés) ----------
function outline(shape, L, W) {
  const a = L / 2, b = W / 2
  const pts = []
  const push = (x, y) => pts.push(new THREE.Vector2(x, y))
  const superellipse = (n) => {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t)
      push(a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n))
    }
  }
  switch (shape) {
    case 'round': case 'oval':
      for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; push(a * Math.cos(t), b * Math.sin(t)) }
      break
    case 'squircle': superellipse(4.2); break
    case 'pebble': superellipse(2.5); break
    case 'egg': {
      const raw = []
      for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; raw.push([Math.cos(t), Math.sin(t) * (0.8 + 0.2 * Math.cos(t))]) }
      const maxY = Math.max(...raw.map((p) => Math.abs(p[1])))
      raw.forEach(([x, y]) => push(a * x, (b * y) / maxY))
      break
    }
    case 'heart': {
      const raw = []
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2
        raw.push([16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)])
      }
      const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1])
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2
      const sx = L / (Math.max(...xs) - Math.min(...xs)), sy = W / (Math.max(...ys) - Math.min(...ys))
      raw.forEach(([x, y]) => push((x - cx) * sx, (y - cy) * sy))
      break
    }
    case 'tab': { // rectangle dont un bout est un demi-cercle (pièces 17700)
      const r = b, x0 = -a, x1 = a - r, rc = Math.min(6, b * 0.3)
      for (let i = 0; i <= 12; i++) { const t = Math.PI / 2 + (i / 12) * (Math.PI / 2); push(x0 + rc + rc * Math.cos(t), b - rc + rc * Math.sin(t)) }
      for (let i = 0; i <= 12; i++) { const t = Math.PI + (i / 12) * (Math.PI / 2); push(x0 + rc + rc * Math.cos(t), -b + rc + rc * Math.sin(t)) }
      for (let i = 0; i <= 48; i++) { const t = -Math.PI / 2 + (i / 48) * Math.PI; push(x1 + r * Math.cos(t), r * Math.sin(t)) }
      break
    }
    default: { // rrect / plate
      const r = Math.min(a, b) * (shape === 'plate' ? 0.08 : 0.22)
      const corner = (cx, cy, start) => { for (let i = 0; i <= 12; i++) { const t = start + (i / 12) * (Math.PI / 2); push(cx + r * Math.cos(t), cy + r * Math.sin(t)) } }
      corner(a - r, b - r, 0); corner(-a + r, b - r, Math.PI / 2); corner(-a + r, -b + r, Math.PI); corner(a - r, -b + r, -Math.PI / 2)
    }
  }
  return pts
}

// Forme tracée depuis la photo de l'échantillon (contours + creux), mise à l'échelle L × W
function tracedShapes(data, L, W) {
  const kx = L / data.width_mm, ky = W / data.height_mm
  const toPath = (pts, Cls) => new Cls(pts.map(([x, y]) => new THREE.Vector2(x * kx, y * ky)))
  return data.shapes.map((sh) => {
    const shape = toPath(sh.outer, THREE.Shape)
    sh.holes.forEach((h) => shape.holes.push(toPath(h, THREE.Path)))
    return shape
  })
}

function extrude(shape, L, W, h, bevel, segments = 6) {
  if (shape === 'logo_dg') {
    const b = Math.max(0.05, Math.min(0.3, h / 2 - 0.01))
    const geo = new THREE.ExtrudeGeometry(tracedShapes(LOGO_DG, L, W), {
      depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.6, bevelSegments: 3, curveSegments: 8,
    })
    geo.rotateX(-Math.PI / 2); geo.translate(0, b, 0); geo.computeVertexNormals()
    return geo
  }
  const b = Math.max(0.05, Math.min(bevel, h / 2 - 0.01, Math.min(L, W) / 2 - 0.5))
  const pts = outline(shape, Math.max(1, L - 2 * b), Math.max(1, W - 2 * b))
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: segments, curveSegments: 24,
  })
  geo.rotateX(-Math.PI / 2) // épaisseur selon l'axe vertical
  geo.translate(0, b, 0)
  geo.computeVertexNormals()
  return geo
}

export function surfaceArea(geo) {
  const pos = geo.attributes.position
  const idx = geo.index
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let area = 0
  const count = idx ? idx.count : pos.count
  for (let i = 0; i < count; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
    area += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2
  }
  return area
}

/** Construit les parties de la pièce (mm) */
function buildParts(p) {
  const { shape, style, L, W, H } = p
  if (style === 'compact') {
    const hb = H * 0.58, hl = H * 0.42 - 0.4
    const bevel = Math.min(H * 0.18, 3)
    return [
      { key: 'base', geo: extrude(shape, L, W, hb, bevel), y: 0 },
      { key: 'lid', geo: extrude(shape, L, W, hl, bevel * 1.2, 8), y: hb + 0.4, lid: true },
    ]
  }
  if (style === 'domed') return [{ key: 'body', geo: extrude(shape, L, W, H, H * 0.42, 12), y: 0 }]
  return [{ key: 'body', geo: extrude(shape, L, W, H, Math.min(H * 0.3, 1.5), 4), y: 0 }]
}

function Dim({ from, to, label, color }) {
  const mid = from.map((v, i) => (v + to[i]) / 2)
  return (
    <group>
      <Line points={[from, to]} color={color} lineWidth={1.5} dashed={false} />
      <Html position={mid} center zIndexRange={[10, 0]}>
        <div className="dim-label notranslate" translate="no">{label}</div>
      </Html>
    </group>
  )
}

function Model({ piece, finish, exploded, showDims, onStats, dimColor }) {
  const parts = useMemo(() => buildParts(piece), [piece])
  useEffect(() => {
    const area = parts.reduce((s, pt) => s + surfaceArea(pt.geo), 0)
    onStats?.({ area })
    return () => parts.forEach((pt) => pt.geo.dispose())
  }, [parts, onStats])
  const f = FINISHES[finish] || FINISHES.silver
  const { L, W, H } = piece
  const off = 6 // décalage des cotes (mm)
  return (
    <group scale={S}>
      {parts.map((pt) => (
        <mesh key={pt.key} geometry={pt.geo} position={[0, pt.y + (pt.lid && exploded ? H * 1.4 + 10 : 0), 0]} castShadow receiveShadow>
          <meshPhysicalMaterial color={f.color} metalness={f.metal} roughness={f.rough} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={1.3} />
        </mesh>
      ))}
      {showDims && (
        <>
          <Dim from={[-L / 2, 0, W / 2 + off]} to={[L / 2, 0, W / 2 + off]} label={`${piece.shape === 'round' ? 'Ø ' : ''}${fmt(L)} mm`} color={dimColor} />
          {piece.shape !== 'round' && <Dim from={[L / 2 + off, 0, -W / 2]} to={[L / 2 + off, 0, W / 2]} label={`${fmt(W)} mm`} color={dimColor} />}
          <Dim from={[-L / 2 - off, 0, W / 2]} to={[-L / 2 - off, H, W / 2]} label={`H ${fmt(H)} mm`} color={dimColor} />
        </>
      )}
    </group>
  )
}
const fmt = (v) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 })

export default function Piece3D({ piece, finish, exploded = false, showDims = true, autoRotate = false, onStats, dark = false }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [1.1, 0.9, 1.4], fov: 35 }} gl={{ preserveDrawingBuffer: true, antialias: true }}>
      <color attach="background" args={[dark ? '#0f172a' : '#f3f5f9']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
      <Environment resolution={256}>
        <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 4, -6]} scale={[10, 10, 1]} />
        <Lightformer intensity={1.6} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[20, 0.6, 1]} />
        <Lightformer intensity={1.6} rotation-y={-Math.PI / 2} position={[5, 1, 1]} scale={[20, 0.6, 1]} />
        <Lightformer intensity={1.4} rotation-y={Math.PI} position={[0, 1, 6]} scale={[14, 4, 1]} color="#eef3ff" />
        <Lightformer intensity={0.9} rotation-x={-Math.PI / 2} position={[0, -4, 0]} scale={[16, 16, 1]} color="#f4f6fa" />
        <Lightformer form="ring" intensity={2} position={[3, 4, 3]} scale={2.5} />
        <Lightformer intensity={0.8} position={[0, 0, -8]} scale={[20, 6, 1]} color="#dfe6f0" />
      </Environment>
      <Bounds fit clip observe margin={1.35}>
        <Model piece={piece} finish={finish} exploded={exploded} showDims={showDims} onStats={onStats} dimColor={dark ? '#86b6ef' : '#1c5cab'} />
      </Bounds>
      <ContactShadows position={[0, -0.001, 0]} opacity={dark ? 0.6 : 0.35} scale={4} blur={2.4} far={1} />
      <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} enableDamping minDistance={0.3} maxDistance={8} />
    </Canvas>
  )
}
