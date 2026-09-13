import { useState, useEffect, useRef } from 'react'
import { api, fmt, fmtF, today } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const EST_MAP = {
  pendiente:   { label: 'Pendiente',      cls: 'badge-gray'   },
  preparacion: { label: 'En preparación', cls: 'badge-yellow' },
  listo:       { label: 'Listo',          cls: 'badge-blue'   },
  entregado:   { label: 'Entregado',      cls: 'badge-green'  },
  cancelado:   { label: 'Cancelado',      cls: 'badge-red'    },
}
const TIPO_LABEL = { mesa: 'Mesa', domicilio: 'Domicilio', venta_interna: 'Interna', credito: 'Crédito' }

export default function PedidosAdmin() {
  const { toast, ToastContainer } = useToast()
  const [pedidos, setPedidos]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [selPedido, setSelPedido]     = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [metodosPago, setMetodosPago] = useState([])
  const [liqMPs, setLiqMPs]           = useState([{ mp: '', monto: '' }])
  const [liqCliente, setLiqCliente]   = useState('')
  const [liqObs, setLiqObs]           = useState('')
  const [liqPagaCon, setLiqPagaCon]   = useState(0)
  const [guardando, setGuardando]     = useState(false)
  const [liquidando, setLiquidando]   = useState(false)
  const prodSearchRef = useRef(null)
  const [prodResults, setProdResults] = useState([])
  const [itemsEdit, setItemsEdit]     = useState([])
  const [obsEdit, setObsEdit]         = useState('')

  // FILTROS
  const [fFecha, setFFecha]   = useState(today())
  const [fMesero, setFMesero] = useState('')
  const [fTipo, setFTipo]     = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fOrden, setFOrden]   = useState('desc')

  async function cargarPedidos(params = {}) {
    setLoading(true)
    try {
      const p = { fecha: fFecha, orden: fOrden, ...params }
      if (fMesero) p.vendedor_nombre = fMesero
      if (fTipo)   p.tipo_pedido = fTipo
      if (fEstado) p.estado = fEstado
      const res = await api.getPedidos(p)
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
    const t = items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0)
    setLiqPagaCon(t)
    setLiqMPs([{ mp: '', monto: '' }])
  }

  function calcTotal() {
    return itemsEdit.reduce((s, it) => s + (parseFloat(it.precio_unitario) || 0) * (parseInt(it.cantidad) || 1), 0)
  }

  async function buscarProducto(q) {
    if (!q.trim()) { setProdResults([]); return }
    try {
      const res = await api.getProductos({ q, activo: 1 })
      setProdResults(res.data || [])
    } catch (e) {}
  }

  function agregarProducto(prod) {
    setItemsEdit(prev => {
      const ex = prev.find(it => it.producto_id == prod.id)
      if (ex) return prev.map(it => it.producto_id == prod.id ? { ...it, cantidad: it.cantidad + 1 } : it)
      return [...prev, { producto_id: prod.id, nombre_producto: prod.nombre, precio_unitario: prod.precio_venta, precio_costo: prod.precio_costo, cantidad: 1, nota: '' }]
    })
    setProdResults([])
    if (prodSearchRef.current) prodSearchRef.current.value = ''
  }

  function updItem(idx, field, val) {
    setItemsEdit(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  function quitarItem(idx) {
    setItemsEdit(prev => prev.filter((_, i) => i !== idx))
  }

  async function actualizarPedido() {
    if (!selPedido) return
    setGuardando(true)
    try {
      await api.updatePedido(selPedido.id, {
        observaciones: obsEdit,
        items: itemsEdit.map(it => ({
          producto_id: it.producto_id || null,
          nombre_producto: it.nombre_producto,
          precio_unitario: parseFloat(it.precio_unitario) || 0,
          precio_costo: parseFloat(it.precio_costo) || 0,
          cantidad: parseInt(it.cantidad) || 1,
          nota: it.nota || null,
        }))
      })
      toast('Pedido actualizado')
      cargarPedidos()
    } catch (e) { toast(e.message, 'error') }
    finally { setGuardando(false) }
  }

  async function cambiarEstado(id, estado) {
    try {
      await api.cambiarEstado(id, estado)
      toast('Estado actualizado')
      cargarPedidos()
    } catch (e) { toast(e.message, 'error') }
  }

  async function liquidar() {
    const mpsSel = liqMPs.filter(m => m.mp)
    if (!mpsSel.length) return toast('Selecciona al menos un método de pago', 'error')
    setLiquidando(true)
    const total = calcTotal()
    try {
      const mpsConTipo = mpsSel.map(m => {
        const mp = metodosPago.find(x => x.nombre === m.mp) || {}
        return { nombre: m.mp, tipo: mp.tipo || 'efectivo', monto: parseFloat(m.monto) || total }
      })
      const res = await api.crearVenta({
        pedido_id: selPedido.id,
        cliente_nombre: liqCliente,
        observaciones: liqObs,
        metodos_pago: mpsConTipo,
        total,
      })
      toast(`Venta ${res.data.folio} registrada ✓`, 'success', 4000)
      setSelPedido(null)
      cargarPedidos()
    } catch (e) { toast(e.message, 'error') }
    finally { setLiquidando(false) }
  }

  function generarComandas() {
    const sel = pedidos.filter(p => selectedIds.includes(p.id))
    if (!sel.length) return toast('Selecciona al menos un pedido', 'error')
    const txt = sel.map(p => {
      const items = typeof p.items === 'string' ? JSON.parse(p.items || '[]') : (p.items || [])
      return [
        '================================',
        '       COMANDA DE COCINA',
        '================================',
        `Pedido : #${p.numero_pedido}`,
        `Cliente: ${p.nombre_cliente || '—'}`,
        `Tipo   : ${TIPO_LABEL[p.tipo_pedido]}${p.mesa_nombre ? ' · ' + p.mesa_nombre : ''}`,
        `Hora   : ${new Date(p.created_at).toLocaleTimeString('es-CO')}`,
        '--------------------------------',
        ...items.map(it => `  ${String(it.cantidad).padStart(2)}x  ${it.nombre_producto}`),
        p.observaciones ? `\nOBS: ${p.observaciones}` : '',
        '================================\n'
      ].filter(Boolean).join('\n')
    }).join('\n')
    const w = window.open('', '_blank', 'width=400,height=600')
    w.document.write(`<pre style="font-family:monospace;font-size:13px;padding:20px">${txt}</pre>`)
    w.print()
  }

  const faltante = liqPagaCon - calcTotal()

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h2>Pedidos</h2>
          <p>Gestión de órdenes activas y liquidación.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => cargarPedidos()}>
            <svg style={{ width: 14, height: 14, fill: 'currentColor' }} viewBox="0 0 16 16"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
            Actualizar Data
          </button>
          <button className="btn btn-dark" onClick={generarComandas} disabled={!selectedIds.length}>
            {selectedIds.length > 1 ? `Generar ${selectedIds.length} comandas` : 'Generar comanda'}
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-grid stats-4">
        {[
          { label: 'Pedidos abiertos', value: pedidos.filter(p => ['pendiente','preparacion','listo'].includes(p.estado)).length, sub: 'Activos hoy' },
          { label: 'Total hoy', value: fmt(pedidos.filter(p => p.estado === 'entregado').reduce((s,p) => s + parseFloat(p.total||0), 0)), sub: 'Ventas del día' },
          { label: 'Ticket promedio', value: (() => { const e = pedidos.filter(p=>p.estado==='entregado'); return e.length ? fmt(e.reduce((s,p)=>s+parseFloat(p.total||0),0)/e.length) : '$0' })(), sub: 'Por pedido' },
          { label: 'Total pedidos', value: pedidos.length, sub: 'En el filtro' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div className="filters-bar">
        <div className="filter-group">
          <label className="filter-label">Fecha</label>
          <input className="filter-input" type="date" value={fFecha} onChange={e => setFFecha(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label">Tipo</label>
          <select className="filter-input" value={fTipo} onChange={e => setFTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="mesa">Mesa</option>
            <option value="domicilio">Domicilio</option>
            <option value="venta_interna">Interna</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Estado</label>
          <select className="filter-input" value={fEstado} onChange={e => setFEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="preparacion">En preparación</option>
            <option value="listo">Listo</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Ordenar</label>
          <select className="filter-input" value={fOrden} onChange={e => setFOrden(e.target.value)}>
            <option value="desc">Más reciente</option>
            <option value="asc">Más antiguo</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => cargarPedidos()}>Buscar</button>
        <button className="btn btn-ghost" onClick={() => { setFFecha(today()); setFTipo(''); setFEstado(''); setFOrden('desc'); cargarPedidos({ fecha: today() }) }}>Limpiar</button>
      </div>

      <div style={{ width: '100%' }}>
        {/* TABLA */}
        <div className="card">
          <div className="card-header">
            <div><h3>Órdenes</h3><p>{pedidos.length} resultado{pedidos.length !== 1 ? 's' : ''}</p></div>
            <button className="btn btn-ghost btn-sm" onClick={() => { window.print() }}>Imprimir seleccionados</button>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? pedidos.map(p => p.id) : [])} />
                    </th>
                    <th>Pedido</th><th>Hora</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Total</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map(p => {
                    const e = EST_MAP[p.estado] || EST_MAP.pendiente
                    return (
                      <tr key={p.id} onClick={() => verDetalle(p)} style={{ cursor: 'pointer' }}>
                        <td onClick={ev => ev.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={ev => setSelectedIds(prev => ev.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} />
                        </td>
                        <td><strong>#{p.numero_pedido}</strong></td>
                        <td style={{ color: 'var(--text3)', fontSize: 12 }}>{new Date(p.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{p.nombre_cliente || '—'}</td>
                        <td><span className="badge badge-gray">{TIPO_LABEL[p.tipo_pedido]}{p.mesa_nombre ? ' · ' + p.mesa_nombre : ''}</span></td>
                        <td onClick={ev => ev.stopPropagation()}>
                          <select value={p.estado} onChange={ev => cambiarEstado(p.id, ev.target.value)}
                            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 7px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                            {Object.entries(EST_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td><strong>{fmt(p.total)}</strong></td>
                        <td><button className="btn btn-ghost btn-xs" onClick={ev => { ev.stopPropagation(); verDetalle(p) }}>Ver</button></td>
                      </tr>
                    )
                  })}
                  {!pedidos.length && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: 28, color: 'var(--text3)', fontSize: 13 }}>Sin pedidos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* DETALLE + LIQUIDACIÓN (MODAL) */}
      {selPedido && (
        <div className="modal-overlay" onClick={() => setSelPedido(null)}>
          <div className="modal-box" style={{ maxWidth: 800, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="detail-header-title">Detalle del pedido</div>
                <div className="detail-header-sub">#{selPedido.numero_pedido} · {selPedido.nombre_cliente || '—'}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelPedido(null)}>✕ Cerrar</button>
            </div>

            <div className="detail-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* INFO */}
              <div className="detail-section">
                <div className="detail-section-label">Información</div>
                {[
                  ['Pedido', `#${selPedido.numero_pedido}`],
                  ['Estado', <span className={`badge ${EST_MAP[selPedido.estado]?.cls}`}>{EST_MAP[selPedido.estado]?.label}</span>],
                  ['Cliente', selPedido.nombre_cliente || '—'],
                  ['Tipo', `${TIPO_LABEL[selPedido.tipo_pedido]}${selPedido.mesa_nombre ? ' · ' + selPedido.mesa_nombre : ''}`],
                  ['Hora', new Date(selPedido.created_at).toLocaleTimeString('es-CO')],
                ].map(([k, v]) => (
                  <div key={k} className="detail-row"><span>{k}</span><span>{v}</span></div>
                ))}
              </div>

              {/* PRODUCTOS EDITABLES */}
              <div className="detail-section">
                <div className="detail-section-label">Productos</div>
                <div className="item-grid item-grid-hdr">
                  <span>Producto</span><span style={{ textAlign: 'center' }}>Cant</span>
                  <span style={{ textAlign: 'right' }}>P.Unit</span><span style={{ textAlign: 'right' }}>Sub</span><span></span>
                </div>
                {itemsEdit.map((it, idx) => (
                  <div key={idx} className="item-grid">
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{it.nombre_producto}</span>
                    <input className="item-inp" type="number" value={it.cantidad} min="1" style={{ textAlign: 'center' }} onChange={e => updItem(idx, 'cantidad', parseInt(e.target.value) || 1)} />
                    <input className="item-inp" type="number" value={it.precio_unitario} onChange={e => updItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)} />
                    <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{fmt((parseFloat(it.precio_unitario)||0) * (parseInt(it.cantidad)||1))}</span>
                    <button className="item-remove" onClick={() => quitarItem(idx)}>×</button>
                  </div>
                ))}

                <div className="prod-search-wrap">
                  <input ref={prodSearchRef} className="filter-input" style={{ width: '100%', marginTop: 8 }} placeholder="Buscar y agregar producto..." onChange={e => buscarProducto(e.target.value)} />
                  {prodResults.length > 0 && (
                    <div className="prod-results">
                      {prodResults.map(p => (
                        <div key={p.id} className="prod-result-item" onClick={() => agregarProducto(p)}>
                          <span>{p.nombre}</span>
                          <span className="prod-result-price">{fmt(p.precio_venta)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* OBSERVACIONES */}
              <div className="detail-section">
                <div className="detail-section-label">Observaciones</div>
                <textarea className="textarea" style={{ minHeight: 50, fontSize: 12 }} value={obsEdit} onChange={e => setObsEdit(e.target.value)} placeholder="Observaciones del pedido..." />
              </div>

              {/* TOTAL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 15, fontWeight: 800, borderTop: '2px solid var(--border)' }}>
                <span>Total</span><span style={{ color: 'var(--am)' }}>{fmt(calcTotal())}</span>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }} onClick={actualizarPedido} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Actualizar pedido'}
              </button>

              {/* LIQUIDACIÓN SIMPLIFICADA */}
              <div className="liq-section" style={{ background: 'var(--bg2)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', marginTop: 24 }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase' }}>Total</span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#3B82F6' }}>{fmt(calcTotal())}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Métodos de pago</span>
                  <button className="btn btn-ghost btn-xs" style={{ color: '#3B82F6', fontWeight: 700 }} onClick={() => setLiqMPs(prev => [...prev, { mp: '', monto: '' }])}>
                    + Agregar
                  </button>
                </div>

                {liqMPs.map((mp, i) => (
                  <div key={i} className="mp-row" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <select className="input" style={{ flex: 1, padding: '8px 10px', fontSize: 13 }} value={mp.mp} onChange={e => setLiqMPs(prev => prev.map((x, j) => j === i ? { ...x, mp: e.target.value } : x))}>
                      <option value="">— Seleccionar —</option>
                      {metodosPago.filter(m => m.activo).map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                    </select>
                    <input className="input" type="number" placeholder="Monto" style={{ width: 130, textAlign: 'right', padding: '8px 10px', fontSize: 13 }} value={mp.monto} onChange={e => setLiqMPs(prev => prev.map((x, j) => j === i ? { ...x, monto: e.target.value } : x))} />
                    <button className="btn btn-danger btn-icon" style={{ width: 36, height: 36, padding: 0, background: 'rgba(239,68,68,0.1)' }} onClick={() => setLiqMPs(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}

                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 12, alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Cliente</label>
                  <input className="input" style={{ padding: '8px 12px' }} value={liqCliente} onChange={e => setLiqCliente(e.target.value)} />
                  
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Obs.</label>
                  <input className="input" style={{ padding: '8px 12px' }} placeholder="Observaciones..." value={liqObs} onChange={e => setLiqObs(e.target.value)} />
                  
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Paga con</label>
                  <input className="input" type="number" style={{ padding: '8px 12px' }} value={liqPagaCon || ''} onChange={e => setLiqPagaCon(parseFloat(e.target.value) || 0)} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 16px', borderRadius: 8, marginTop: 16, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {liqPagaCon > 0 ? 'Cambio / Vueltas' : ((calcTotal() - liqMPs.reduce((acc, x) => acc + (parseFloat(x.monto) || 0), 0)) > 0 ? 'Saldo Faltante' : 'Cambio / Vueltas')}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#3B82F6' }}>
                    {fmt(liqPagaCon > 0 ? Math.max(0, liqPagaCon - calcTotal()) : Math.abs(calcTotal() - liqMPs.reduce((acc, x) => acc + (parseFloat(x.monto) || 0), 0)))}
                  </span>
                </div>

                <button className="btn btn-success btn-lg" style={{ width: '100%', fontSize: 15, fontWeight: 800, padding: 14, letterSpacing: '1px' }} onClick={liquidar} disabled={liquidando}>
                  {liquidando ? 'Procesando...' : '✓ PAGAR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
