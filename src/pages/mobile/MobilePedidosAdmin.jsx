import { useState, useEffect, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { api, fmt, today } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import MobileTopBar from '../../components/mobile/MobileTopBar'

const EST_MAP = {
  pendiente:   { label: 'Pendiente',      cls: 'badge-gray'   },
  liquidado:   { label: 'Liquidado',      cls: 'badge-purple' },
  cancelado:   { label: 'Cancelado',      cls: 'badge-red'    },
}
const TIPO_LABEL = { mesa: 'Mesa', domicilio: 'Domicilio', venta_interna: 'Interna', credito: 'Crédito' }

export default function MobilePedidosAdmin() {
  const { toast, ToastContainer } = useToast()
  const [pedidos, setPedidos]         = useState([])
  const [loading, setLoading]         = useState(true)
  
  // Detalle / Liquidación (BottomSheet State)
  const [selPedido, setSelPedido]     = useState(null)
  const [metodosPago, setMetodosPago] = useState([])
  const [liqMPs, setLiqMPs]           = useState([{ mp: '', monto: '' }])
  const [liqCliente, setLiqCliente]   = useState('')
  const [liqObs, setLiqObs]           = useState('')
  const [liquidando, setLiquidando]   = useState(false)
  const [guardando, setGuardando]     = useState(false)
  
  // Edición
  const [itemsEdit, setItemsEdit]     = useState([])
  const [obsEdit, setObsEdit]         = useState('')
  const [prodResults, setProdResults] = useState([])
  const prodSearchRef = useRef(null)

  // Filtros Básicos
  const [fTexto, setFTexto] = useState('')
  const [fFiltroActivo, setFFiltroActivo] = useState(false) // toggle filtros avanzados

  async function cargarPedidos() {
    setLoading(true)
    try {
      const res = await api.getPedidos({ orden: 'desc' }) // cargar todo rápido o filtrar por default
      setPedidos(res.data || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    cargarPedidos()
    api.getMetodosPago().then(r => setMetodosPago(r.data || [])).catch(() => {})
  }, [])

  function verDetalle(ped) {
    const items = typeof ped.items === 'string' ? JSON.parse(ped.items || '[]') : (ped.items || [])
    setSelPedido(ped)
    setItemsEdit(items.map(it => ({ ...it })))
    setObsEdit(ped.observaciones || '')
    setLiqCliente(ped.nombre_cliente || '')
    setLiqObs(ped.observaciones || '')
    setLiqMPs([{ mp: '', monto: '' }])
  }

  function calcTotal() {
    return itemsEdit.reduce((s, it) => s + (parseFloat(it.precio_unitario) || 0) * (parseInt(it.cantidad) || 1), 0)
  }

  async function liquidar() {
    const mpsSel = liqMPs.filter(m => m.mp)
    if (!mpsSel.length) return toast('Selecciona método de pago', 'error')
    setLiquidando(true)
    const total = calcTotal()
    try {
      let mpsConTipo = mpsSel.map(m => {
        const mp = metodosPago.find(x => x.nombre === m.mp) || {}
        return { nombre: m.mp, tipo: mp.tipo || 'efectivo', monto: parseFloat(m.monto) || 0 }
      })
      const res = await api.crearVenta({
        pedido_id: selPedido.id,
        cliente_nombre: liqCliente,
        observaciones: liqObs,
        metodos_pago: mpsConTipo,
        total,
      })
      
      await api.cambiarEstado(selPedido.id, 'liquidado')
      toast(`Liquidado. (Folio: ${res.data?.folio || ''})`, 'success', 4000)
      setSelPedido(null)
      cargarPedidos()
    } catch (e) { toast(e.message, 'error') }
    finally { setLiquidando(false) }
  }

  const txtLow = fTexto.toLowerCase().trim()
  const pedidosFiltrados = pedidos.filter(p => {
    if (!txtLow) return true
    const n = String(p.numero_pedido || '').toLowerCase()
    const c = String(p.nombre_cliente || '').toLowerCase()
    return n.includes(txtLow) || c.includes(txtLow)
  })

  return (
    <>
      <ToastContainer />
      <MobileTopBar title="Órdenes" rightAction={
        <button className="mobile-icon-btn" onClick={() => cargarPedidos()}>
           <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      } />
      
      <div className="mobile-container">
        <input 
          className="input" 
          style={{ width: '100%', marginBottom: 16, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} 
          placeholder="Buscar # orden o cliente..."
          value={fTexto}
          onChange={e => setFTexto(e.target.value)}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pedidosFiltrados.map(p => {
              const d = new Date(p.created_at)
              const items = typeof p.items === 'string' ? JSON.parse(p.items || '[]') : (p.items || [])
              const totalItems = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0)
              
              return (
                <div key={p.id} onClick={() => verDetalle(p)} style={{ 
                  background: 'white', padding: 16, borderRadius: 12, 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9',
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 16, color: '#0f172a' }}>#{p.numero_pedido}</strong>
                      <span className={`badge ${EST_MAP[p.estado]?.cls || 'badge-gray'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                        {EST_MAP[p.estado]?.label}
                      </span>
                    </div>
                    <strong style={{ fontSize: 16, color: '#3b82f6' }}>{fmt(p.total)}</strong>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                    <span>{TIPO_LABEL[p.tipo_pedido]} • {p.mesa_nombre || 'Bar'}</span>
                    <span>{d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    {p.nombre_cliente ? `Cliente: ${p.nombre_cliente} • ` : ''}{totalItems} productos
                  </div>
                </div>
              )
            })}
            
            {pedidosFiltrados.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay órdenes</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sheet - Detalle y Liquidación */}
      {selPedido && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
        }} onClick={() => setSelPedido(null)}>
          
          <div style={{ 
            background: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: '24px 20px', maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 16
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Orden #{selPedido.numero_pedido}</h2>
                <span style={{ fontSize: 13, color: '#64748b' }}>{selPedido.mesa_nombre || TIPO_LABEL[selPedido.tipo_pedido]}</span>
              </div>
              <button className="mobile-icon-btn" style={{ background: '#f1f5f9', borderRadius: '50%' }} onClick={() => setSelPedido(null)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            {selPedido.estado === 'liquidado' ? (
              <div style={{ background: '#dcfce7', color: '#166534', padding: 16, borderRadius: 12, textAlign: 'center' }}>
                <strong>Venta Liquidada ✅</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>TOTAL A PAGAR</label>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a' }}>{fmt(calcTotal())}</div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>MÉTODO DE PAGO</label>
                  <select 
                    className="input" 
                    style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 16, background: '#f8fafc' }}
                    value={liqMPs[0].mp}
                    onChange={e => setLiqMPs([{ mp: e.target.value, monto: calcTotal() }])}
                  >
                    <option value="">Seleccione...</option>
                    {metodosPago.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                  </select>
                </div>

                <button 
                  className="btn" 
                  style={{ width: '100%', padding: 16, borderRadius: 12, background: '#3b82f6', color: 'white', fontWeight: 700, fontSize: 16, marginTop: 8 }}
                  onClick={liquidar}
                  disabled={liquidando || !liqMPs[0].mp}
                >
                  {liquidando ? 'Procesando...' : 'Liquidar Pedido'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
