import { useState, useEffect, useCallback } from 'react'
import { api, fmt } from '../lib/api'
import { useToast } from '../hooks/useToast'

const ESTADOS = ['pendiente', 'preparacion']

function tiempoDesde(created_at) {
  // Manejo robusto de fechas para evitar desfases de zona horaria del servidor
  let d = new Date(created_at);
  // Si la fecha devuelta por el servidor está en el futuro, o más de 12 horas en el pasado,
  // puede deberse a un mismatch de zona horaria entre Node y el navegador.
  // Una forma robusta es forzar la lectura local de la fecha ignorando el 'Z'
  const localStr = (created_at || '').replace('Z', '').replace('T', ' ');
  let dLocal = new Date(localStr.replace(/-/g, '/')); // replace - with / for safari support
  
  // Usar la fecha local si parece más correcta (menos de 24 horas de diferencia)
  const diffLocal = Math.floor((Date.now() - dLocal) / 1000);
  const diffOriginal = Math.floor((Date.now() - d) / 1000);
  
  // Seleccionamos la que tenga más sentido (la que no sea negativa y sea más pequeña)
  let diff = diffOriginal;
  if (diffLocal >= 0 && (diff < 0 || diffLocal < diff)) {
    diff = diffLocal;
  }
  // Fallback por si acaso: si ambas son negativas, mostrar 0
  if (diff < 0) diff = 0;

  const m = Math.floor(diff / 60)
  const s = diff % 60
  return { texto: `${m}:${String(s).padStart(2,'0')}`, minutos: m }
}

function useTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
}

export default function CocinaPage() {
  useTick()
  const { toast, ToastContainer } = useToast()
  const [pedidos, setPedidos]     = useState([])
  const [loading, setLoading]     = useState(true)

  const cargar = useCallback(async () => {
    try {
      const res = await api.getPedidos({ estado: 'pendiente', orden: 'asc' })
      const res2 = await api.getPedidos({ estado: 'preparacion', orden: 'asc' })
      setPedidos([...(res.data || []), ...(res2.data || [])])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 15000)
    return () => clearInterval(id)
  }, [cargar])

  async function cambiar(id, estado) {
    try {
      await api.cambiarEstado(id, estado)
      toast(`Estado actualizado`)
      cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const TIPO_LABEL = { mesa: '🪑', domicilio: '🛵', venta_interna: '🏠', credito: '📂' }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="cocina-page">
      <ToastContainer />
      <header className="cocina-header">
        <h1>🍳  Cocina — Pedidos activos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{pedidos.length} orden{pedidos.length !== 1 ? 'es' : ''}</span>
          <button className="btn btn-ghost btn-sm" onClick={cargar}>↺ Actualizar</button>
          <a href="/admin" className="btn btn-dark btn-sm">Panel admin →</a>
        </div>
      </header>

      {pedidos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Sin pedidos pendientes</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Actualización automática cada 15 segundos</div>
        </div>
      ) : (
        <div className="cocina-grid">
          {pedidos.map(p => {
            const { texto, minutos } = tiempoDesde(p.created_at)
            const timeClass = minutos < 10 ? 'ok' : minutos < 20 ? 'warning' : 'danger'
            const items = typeof p.items === 'string' ? JSON.parse(p.items || '[]') : (p.items || [])
            return (
              <div key={p.id} className={`cocina-card ${minutos >= 20 ? 'urgente' : ''}`}>
                <div className="cocina-card-header">
                  <div>
                    <div className="cocina-card-num">{p.num || `#${p.numero_pedido}`}</div>
                    <div className="cocina-card-meta">
                      {TIPO_LABEL[p.tipo_pedido]} {p.mesa_nombre || p.tipo_pedido}  ·  {p.nombre_cliente}
                    </div>
                  </div>
                  <div>
                    <div className={`cocina-card-time ${timeClass}`}>{texto}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', marginTop: 2 }}>min</div>
                  </div>
                </div>

                <div className="cocina-items">
                  {items.map((it, i) => (
                    <div key={i} className="cocina-item">
                      <div className="cocina-item-qty">{it.cantidad}</div>
                      <div className="cocina-item-name">{it.nombre_producto}</div>
                      {it.nota && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({it.nota})</span>}
                    </div>
                  ))}
                </div>

                {p.observaciones && (
                  <div className="cocina-obs">📝 {p.observaciones}</div>
                )}

                <div className="cocina-card-actions">
                  {p.estado === 'pendiente' && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => cambiar(p.id, 'preparacion')}>
                      En preparación
                    </button>
                  )}
                  {p.estado === 'preparacion' && (
                    <button className="btn btn-success" style={{ flex: 1 }} onClick={() => cambiar(p.id, 'listo')}>
                      ✓  Marcar listo
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => cambiar(p.id, 'cancelado')}>
                    Cancelar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
