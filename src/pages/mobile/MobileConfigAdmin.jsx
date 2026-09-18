import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import MobileTopBar from '../../components/mobile/MobileTopBar'

function useList(getAll) {
  const [data, setData] = useState([])
  const reload = () => getAll().then(r => setData(r.data || [])).catch(() => {})
  useEffect(() => { reload() }, [])
  return [data, reload]
}

export default function MobileConfigAdmin() {
  const { toast, ToastContainer } = useToast()

  // General Config
  const [cfg, setCfg] = useState({ nombre_negocio: '', nit: '', telefono: '', ciudad: '', direccion: '', slogan: '' })
  const [saving, setSaving] = useState(false)

  // Sub-sections
  const [activeSection, setActiveSection] = useState(null) // 'general' | 'mesas' | 'cats' | 'vends' | 'mps'

  // Data
  const [mesas, reloadMesas] = useList(api.getMesas)
  const [cats, reloadCats]   = useList(api.getCategorias)
  const [vends, reloadVends] = useList(api.getVendedores)
  const [mps, reloadMps]     = useList(api.getMetodosPago)

  useEffect(() => {
    api.getConfig().then(r => {
      const d = r.data || {}
      setCfg({ nombre_negocio: d.nombre_negocio || '', nit: d.nit || '', telefono: d.telefono || '', ciudad: d.ciudad || '', direccion: d.direccion || '', slogan: d.slogan || '' })
    }).catch(() => {})
  }, [])

  async function guardarConfig() {
    setSaving(true)
    try {
      await api.updateConfig(cfg)
      toast('Configuración guardada', 'success')
      setActiveSection(null)
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  // Delete helpers
  async function del(type, id, reloadFunc) {
    if (!window.confirm('¿Eliminar este elemento?')) return
    try {
      if (type === 'mesa') await api.deleteMesa(id)
      if (type === 'cat') await api.deleteCategoria(id)
      if (type === 'vend') await api.deleteVendedor(id)
      if (type === 'mp') await api.deleteMetodoPago(id)
      reloadFunc()
      toast('Eliminado correctamente', 'success')
    } catch (e) { toast(e.message, 'error') }
  }

  const sections = [
    { id: 'general', title: 'Ajustes Generales', icon: '⚙️', desc: 'Nombre, NIT, teléfono' },
    { id: 'mesas', title: 'Mesas / Zonas', icon: '🪑', desc: `${mesas.length} mesas activas` },
    { id: 'cats', title: 'Categorías', icon: '📋', desc: `${cats.length} categorías` },
    { id: 'vends', title: 'Personal', icon: '👥', desc: `${vends.length} empleados` },
    { id: 'mps', title: 'Métodos de Pago', icon: '💳', desc: `${mps.length} métodos` },
  ]

  return (
    <>
      <ToastContainer />
      <MobileTopBar title="Configuración" />

      <div className="mobile-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map(s => (
            <div 
              key={s.id} 
              style={{ background: 'white', padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}
              onClick={() => setActiveSection(s.id)}
            >
              <div style={{ width: 44, height: 44, background: '#f8fafc', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{s.desc}</div>
              </div>
              <div style={{ color: '#cbd5e1' }}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Sheets for Sub-sections */}
      {activeSection && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
        }}>
          <div style={{ 
            background: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: '20px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{sections.find(s => s.id === activeSection)?.title}</h3>
              <button className="mobile-icon-btn" style={{ background: '#f1f5f9', borderRadius: '50%' }} onClick={() => setActiveSection(null)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* General */}
            {activeSection === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nombre del Negocio</label>
                  <input className="input" style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }} value={cfg.nombre_negocio} onChange={e => setCfg({...cfg, nombre_negocio: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>NIT / RUT</label>
                  <input className="input" style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }} value={cfg.nit} onChange={e => setCfg({...cfg, nit: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Teléfono</label>
                  <input className="input" style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }} value={cfg.telefono} onChange={e => setCfg({...cfg, telefono: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Dirección</label>
                  <input className="input" style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }} value={cfg.direccion} onChange={e => setCfg({...cfg, direccion: e.target.value})} />
                </div>
                <button className="btn btn-primary" style={{ padding: 16, borderRadius: 12, fontWeight: 700, marginTop: 12 }} onClick={guardarConfig} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Ajustes'}
                </button>
              </div>
            )}

            {/* Generic List Renderer for the rest */}
            {['mesas', 'cats', 'vends', 'mps'].includes(activeSection) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 8 }}>
                  Para crear o editar en detalle, por favor usa la versión de escritorio. Aquí puedes ver y eliminar elementos.
                </div>
                
                {activeSection === 'mesas' && mesas.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <span style={{ fontWeight: 600 }}>{m.nombre}</span>
                    <button className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }} onClick={() => del('mesa', m.id, reloadMesas)}>Borrar</button>
                  </div>
                ))}

                {activeSection === 'cats' && cats.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <span style={{ fontWeight: 600 }}>{c.icono} {c.nombre}</span>
                    <button className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }} onClick={() => del('cat', c.id, reloadCats)}>Borrar</button>
                  </div>
                ))}

                {activeSection === 'vends' && vends.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{v.nombre}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{v.rol}</div>
                    </div>
                    <button className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }} onClick={() => del('vend', v.id, reloadVends)}>Borrar</button>
                  </div>
                ))}

                {activeSection === 'mps' && mps.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <span style={{ fontWeight: 600 }}>{m.nombre}</span>
                    <button className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }} onClick={() => del('mp', m.id, reloadMps)}>Borrar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
