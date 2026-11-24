import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Edges, Grid, GizmoHelper, GizmoViewcube, Bounds, Environment, Lightformer } from '@react-three/drei'
import { PenTool, ArrowUpFromLine, CircleDot, Box as BoxIcon, Disc, Plus, Trash2, Scale, Scissors, Eye, CheckCircle2 } from 'lucide-react'
import { buildSolid, defaultModel, SKETCHES } from '../../lib/project/cad'
import { findIn } from '../../lib/project/engine'
import { NumInput, Seg, useToast } from '../../components/ui'
import { num } from '../../lib/format'

function Part({ geometry, section, color, wire }) {
  const clip = useMemo(() => (section ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)] : []), [section])
  return (
    <mesh geometry={geometry} scale={0.02} castShadow>
      <meshStandardMaterial color={color} metalness={0.25} roughness={0.45} side={THREE.DoubleSide} clippingPlanes={clip} wireframe={wire} />
      {!wire && <Edges threshold={20} color="#0b1220" scale={1} />}
    </mesh>
  )
}

const FEATURES = [
  ['sketch', PenTool, 'Esquisse 1'], ['extrude', ArrowUpFromLine, 'Extrusion'], ['fillet', CircleDot, 'Congé'],
  ['shell', BoxIcon, 'Coque'], ['holes', Disc, 'Perçages'],
]

/** Onglet Conception 3D (modeleur paramétrique type SolidWorks) */
export default function Design3D({ data, setData, lib }) {
  const [toast, setToast] = useToast()
  const comps = data.components || []
  const [cid, setCid] = useState(comps[0]?.id)
  const [feat, setFeat] = useState('sketch')
  const [section, setSection] = useState(false)
  const [wire, setWire] = useState(false)
  useEffect(() => { if (!comps.find((c) => c.id === cid)) setCid(comps[0]?.id) }, [comps, cid])
  const comp = comps.find((c) => c.id === cid)
  const model = (data.models || {})[cid] || defaultModel()
  const setModel = (patch) => setData((d) => ({ ...d, models: { ...(d.models || {}), [cid]: { ...((d.models || {})[cid] || defaultModel()), ...patch } } }))
  const setPart = (k, v) => setModel({ [k]: { ...model[k], ...v } })

  const solid = useMemo(() => { try { return buildSolid(model) } catch (e) { return { error: e.message } } }, [model])
  const mat = findIn(lib.materials, comp?.material)
  const density = Number(mat?.density) || 0
  const mass = solid.volume ? (solid.volume / 1000) * density : 0

  const applyWeight = () => {
    setData((d) => ({ ...d, components: d.components.map((c) => (c.id === cid ? { ...c, netWeight: +mass.toFixed(2) } : c)) }))
    setToast(`Poids net de « ${comp.name} » mis à jour : ${num(mass, 2)} g — chiffrage et CBN recalculés ✔`)
  }

  if (!comps.length) return <div className="card empty">Ajoutez d'abord une pièce dans l'onglet Définition.</div>

  return (
    <>
      {toast}
      <div className="cad">
        {/* Arbre de création */}
        <div className="card cad-tree">
          <div className="field"><label>Pièce</label>
            <select value={cid} onChange={(e) => setCid(e.target.value)}>{comps.map((c) => <option key={c.id} value={c.id}>{c.name} {c.reference ? `· ${c.reference}` : ''}</option>)}</select>
          </div>
          <div className="sb-section" style={{ color: 'var(--muted)', padding: '14px 0 6px' }}>Arbre de création</div>
          {FEATURES.map(([k, I, label]) => {
            const off = (k === 'shell' && !model.shell?.enabled) || (k === 'fillet' && !(model.fillet?.r > 0)) || (k === 'holes' && !(model.holes || []).length)
            return (
              <button key={k} className={`cad-feat ${feat === k ? 'on' : ''} ${off ? 'off' : ''}`} onClick={() => setFeat(k)}>
                <I size={15} /> {label}{k === 'holes' && model.holes?.length ? ` (${model.holes.length})` : ''}
              </button>
            )
          })}
          <div className="sb-section" style={{ color: 'var(--muted)', padding: '14px 0 6px' }}>Paramètres</div>
          {feat === 'sketch' && (
            <div className="grid">
              <div className="field"><label>Forme</label><select value={model.sketch.shape} onChange={(e) => setPart('sketch', { shape: e.target.value })}>{Object.entries(SKETCHES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="field"><label>{['circle', 'polygon'].includes(model.sketch.shape) ? 'Diamètre (mm)' : 'Longueur (mm)'}</label><NumInput value={model.sketch.L} onChange={(v) => setPart('sketch', { L: v })} /></div>
              {!['circle', 'polygon'].includes(model.sketch.shape) && <div className="field"><label>Largeur (mm)</label><NumInput value={model.sketch.W} onChange={(v) => setPart('sketch', { W: v })} /></div>}
              {model.sketch.shape === 'rrect' && <div className="field"><label>Rayon des coins (mm)</label><NumInput value={model.sketch.radius} onChange={(v) => setPart('sketch', { radius: v })} /></div>}
              {model.sketch.shape === 'polygon' && <div className="field"><label>Nombre de côtés</label><NumInput value={model.sketch.sides} onChange={(v) => setPart('sketch', { sides: Math.max(3, Math.round(v)) })} /></div>}
            </div>
          )}
          {feat === 'extrude' && <div className="field"><label>Hauteur d'extrusion (mm)</label><NumInput value={model.extrude.H} onChange={(v) => setPart('extrude', { H: v })} /></div>}
          {feat === 'fillet' && <div className="field"><label>Rayon de congé sur les arêtes (mm)</label><NumInput value={model.fillet?.r || 0} onChange={(v) => setPart('fillet', { r: v })} /></div>}
          {feat === 'shell' && (
            <div className="grid">
              <label className="check"><input type="checkbox" checked={!!model.shell?.enabled} onChange={(e) => setPart('shell', { enabled: e.target.checked })} /> Pièce évidée (coque)</label>
              <div className="field"><label>Épaisseur de paroi (mm)</label><NumInput value={model.shell?.thickness || 1} onChange={(v) => setPart('shell', { thickness: v })} /></div>
              <div className="field"><label>Face ouverte</label><Seg value={model.shell?.open || 'bottom'} onChange={(v) => setPart('shell', { open: v })} options={[['bottom', 'Dessous'], ['top', 'Dessus']]} /></div>
            </div>
          )}
          {feat === 'holes' && (
            <div className="grid">
              {(model.holes || []).map((h, i) => (
                <div key={i} className="hole-row">
                  <div className="field"><label>X</label><NumInput value={h.x} onChange={(v) => setModel({ holes: model.holes.map((x, j) => (j === i ? { ...x, x: v } : x)) })} /></div>
                  <div className="field"><label>Y</label><NumInput value={h.y} onChange={(v) => setModel({ holes: model.holes.map((x, j) => (j === i ? { ...x, y: v } : x)) })} /></div>
                  <div className="field"><label>Ø</label><NumInput value={h.d} onChange={(v) => setModel({ holes: model.holes.map((x, j) => (j === i ? { ...x, d: v } : x)) })} /></div>
                  <div className="field"><label>Prof.</label><NumInput value={h.depth || 0} onChange={(v) => setModel({ holes: model.holes.map((x, j) => (j === i ? { ...x, depth: v } : x)) })} /></div>
                  <button className="btn btn-danger" style={{ padding: '4px 6px', alignSelf: 'end' }} onClick={() => setModel({ holes: model.holes.filter((_, j) => j !== i) })}><Trash2 size={12} /></button>
                </div>
              ))}
              <button className="btn btn-light" onClick={() => setModel({ holes: [...(model.holes || []), { x: 0, y: 0, d: 5, depth: 0 }] })}><Plus size={13} /> Perçage</button>
              <div className="card-sub">Coordonnées depuis le centre (mm). Profondeur 0 = traversant.</div>
            </div>
          )}
        </div>

        {/* Zone graphique */}
        <div className="card cad-view">
          <div className="cad-toolbar">
            <b>{comp?.name}</b><span className="card-sub">{comp?.material || 'matière non définie'}</span>
            <span className="spacer" />
            <button className={`btn ${section ? 'btn-soft' : 'btn-light'}`} onClick={() => setSection(!section)}><Scissors size={14} /> Coupe</button>
            <button className={`btn ${wire ? 'btn-soft' : 'btn-light'}`} onClick={() => setWire(!wire)}><Eye size={14} /> Filaire</button>
          </div>
          <div className="cad-canvas">
            {solid.error ? <div className="empty">Géométrie invalide : {solid.error}</div> : (
              <Canvas shadows camera={{ position: [1.6, 1.3, 2], fov: 35 }} gl={{ localClippingEnabled: true, antialias: true }}>
                <color attach="background" args={['#dde3ea']} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[3, 5, 3]} intensity={1.3} castShadow />
                <Environment resolution={128}><Lightformer intensity={1.2} position={[0, 4, 4]} scale={[8, 8, 1]} /><Lightformer intensity={0.6} position={[-4, 2, -3]} scale={[8, 2, 1]} /></Environment>
                <Bounds fit clip observe margin={1.4}>
                  <Part geometry={solid.geometry} section={section} wire={wire} color="#9fb3c8" />
                </Bounds>
                <Grid position={[0, -0.001, 0]} args={[10, 10]} cellSize={0.1} sectionSize={0.5} cellColor="#b6c2cf" sectionColor="#8a99aa" fadeDistance={8} infiniteGrid />
                <OrbitControls makeDefault enableDamping />
                <GizmoHelper alignment="top-right" margin={[70, 70]}><GizmoViewcube color="#f1f5f9" textColor="#0f172a" strokeColor="#64748b" /></GizmoHelper>
              </Canvas>
            )}
          </div>
          {solid.warnings?.map((w) => <div key={w} className="alert warning" style={{ margin: 10 }}><div>{w}</div></div>)}
        </div>

        {/* Propriétés de masse */}
        <div className="card cad-props">
          <div className="card-title"><Scale size={16} /> Propriétés de masse</div>
          <table className="t">
            <tbody>
              <tr><td>Volume</td><td className="num"><b>{num((solid.volume || 0) / 1000, 3)} cm³</b></td></tr>
              <tr><td>Surface</td><td className="num">{num((solid.area || 0) / 100, 1)} cm²</td></tr>
              <tr><td>Encombrement</td><td className="num">{solid.bbox ? `${num(solid.bbox.x, 1)} × ${num(solid.bbox.z, 1)} × ${num(solid.bbox.y, 1)} mm` : '—'}</td></tr>
              <tr><td>Densité ({comp?.material || '—'})</td><td className="num">{density ? `${num(density, 2)} g/cm³` : <span className="card-sub">à renseigner dans la bibliothèque</span>}</td></tr>
              <tr><td><b>Masse</b></td><td className="num"><b>{density ? `${num(mass, 2)} g` : '—'}</b></td></tr>
              <tr><td>Poids net actuel de la pièce</td><td className="num">{num(comp?.netWeight || 0, 2)} g</td></tr>
            </tbody>
          </table>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={!density || !mass} onClick={applyWeight}>
            <CheckCircle2 size={15} /> Utiliser cette masse comme poids net
          </button>
          <div className="card-sub" style={{ marginTop: 8 }}>Le poids net alimente le chiffrage (matière) et le CBN (kg à commander) du projet.</div>
        </div>
      </div>
    </>
  )
}
