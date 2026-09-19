import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { api, fmt, fmtF, today } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export default function CajaAdmin() {
  const { toast, ToastContainer } = useToast()
  const [ventas, setVentas]   = useState([])
  const [stats, setStats]     = useState({})
  const [loading, setLoading] = useState(true)
  const [fi, setFi] = useState(today())
  const [ff, setFf] = useState(today())
  const [est, setEst] = useState('ACEPTADA') // Por defecto solo ventas activas

  async function cargar() {
    setLoading(true)
    try {
      const params = { fecha_inicio: fi, fecha_fin: ff }
      if (est) params.estado = est
      const [v, sRes] = await Promise.all([api.getVentas(params), api.getVentaStats(params)])
      const ventasData = v.data || []
      const statsBackend = sRes.data || {}
      setVentas(ventasData)
      
      const aceptadas = ventasData.filter(x => x.estado === 'ACEPTADA')
      const totalVendido = aceptadas.reduce((sum, x) => sum + parseFloat(x.total || 0), 0)
      const totalCosto = aceptadas.reduce((sum, x) => sum + parseFloat(x.total_costo || 0), 0)
      const utilidadBruta = totalVendido - totalCosto
      const porcentaje = totalCosto > 0 ? ((utilidadBruta / totalCosto) * 100).toFixed(2) : (utilidadBruta > 0 ? 100 : 0)
      
      setStats({
        total_ventas: aceptadas.length,
        total_vendido: totalVendido,
        utilidad_bruta: utilidadBruta,
        porcentaje_utilidad: porcentaje,
        categorias: statsBackend.categorias || []
      })
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  async function anular(id, folio) {
    if (!confirm(`¿Anular la venta ${folio}?`)) return
    try {
      await api.anularVenta(id)
      toast('Venta anulada')
      cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  function exportar() {
    try {
      const aceptadas = ventas.filter(x => x.estado === 'ACEPTADA')
      
      const totalesPorMetodo = {}
      let totalGeneral = 0
      
      aceptadas.forEach(v => {
        let parsed = []
        try { parsed = JSON.parse(v.metodos_pago) } catch(e){}
        parsed.forEach(m => {
          const tipo = m.tipo || 'Efectivo'
          const amt = parseFloat(m.monto || 0)
          if (!totalesPorMetodo[tipo]) totalesPorMetodo[tipo] = 0
          totalesPorMetodo[tipo] += amt
          totalGeneral += amt
        })
      })

      const resumenCierre = [
        ['CIERRE DE CAJA', `Del ${fi} al ${ff}`],
        [],
        ['MÉTODO DE PAGO', 'TOTAL RECAUDADO']
      ]
      
      Object.keys(totalesPorMetodo).forEach(tipo => {
        resumenCierre.push([tipo, totalesPorMetodo[tipo]])
      })
      resumenCierre.push([])
      resumenCierre.push(['TOTAL GENERAL', totalGeneral])
      resumenCierre.push([])
      resumenCierre.push(['UTILIDAD BRUTA', stats.utilidad_bruta])
      resumenCierre.push(['MARGEN %', stats.porcentaje_utilidad + '%'])

      const movimientos = ventas.map(v => {
        let pagos = ''
        try {
          const p = JSON.parse(v.metodos_pago)
          pagos = p.map(x => `${x.tipo}: $${x.monto}`).join(' | ')
        } catch(e){}
        
        return {
          'Folio': v.id_venta,
          'Fecha': new Date(v.created_at).toLocaleDateString('es-CO'),
          'Hora': new Date(v.created_at).toLocaleTimeString('es-CO'),
          'Cliente': v.cliente_nombre,
          'Ítems': v.items_count || 0,
          'Total Venta': parseFloat(v.total || 0),
          'Costo (Sistema)': parseFloat(v.total_costo || 0),
          'Utilidad': parseFloat(v.total || 0) - parseFloat(v.total_costo || 0),
          'Métodos de Pago': pagos,
          'Estado': v.estado
        }
      })

      const wb = XLSX.utils.book_new()
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenCierre)
      const wsMovimientos = XLSX.utils.json_to_sheet(movimientos)

      XLSX.utils.book_append_sheet(wb, wsResumen, 'Cierre por Método de Pago')
      XLSX.writeFile(wb, `Caja_${fi}_al_${ff}.xlsx`)
      toast('Exportado a Excel correctamente', 'success')
    } catch(e) {
      toast('Error al exportar: ' + e.message, 'error')
    }
  }

  function exportarPDF() {
    try {
      const doc = new jsPDF({ unit: 'mm', format: [80, 200] })
      let y = 10
      
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('CIERRE DE CAJA', 40, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Del: ${fi}`, 40, y, { align: 'center' }); y += 5
      doc.text(`Al: ${ff}`, 40, y, { align: 'center' }); y += 10
      
      const aceptadas = ventas.filter(x => x.estado === 'ACEPTADA')
      const totalesPorMetodo = {}
      let totalGeneral = 0
      
      aceptadas.forEach(v => {
        let parsed = []
        try { parsed = JSON.parse(v.metodos_pago) } catch(e){}
        parsed.forEach(m => {
          const tipo = m.tipo || 'Efectivo'
          const amt = parseFloat(m.monto || 0)
          if (!totalesPorMetodo[tipo]) totalesPorMetodo[tipo] = 0
          totalesPorMetodo[tipo] += amt
          totalGeneral += amt
        })
      })

      doc.setFont('helvetica', 'bold')
      doc.text('MÉTODOS DE PAGO', 40, y, { align: 'center' })
      y += 6
      doc.setFont('helvetica', 'normal')
      
      Object.keys(totalesPorMetodo).forEach(tipo => {
        doc.text(`${tipo}:`, 10, y)
        doc.text(fmt(totalesPorMetodo[tipo]), 70, y, { align: 'right' })
        y += 5
      })
      
      y += 5
      doc.line(10, y, 70, y)
      y += 7
      
      doc.setFont('helvetica', 'bold')
      doc.text('TOTAL RECAUDADO:', 10, y)
      doc.text(fmt(totalGeneral), 70, y, { align: 'right' })
      y += 8
      
      doc.text('UTILIDAD BRUTA:', 10, y)
      doc.text(fmt(stats.utilidad_bruta), 70, y, { align: 'right' })
      y += 8
      
      doc.text('MARGEN:', 10, y)
      doc.text(stats.porcentaje_utilidad + '%', 70, y, { align: 'right' })
      y += 8
      
      // CATEGORIAS
      if (stats.categorias && stats.categorias.length > 0) {
        y += 4
        doc.line(10, y, 70, y)
        y += 6
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('VENTAS POR CATEGORÍA', 40, y, { align: 'center' })
        y += 6
        doc.setFontSize(8)
        doc.text('CATEGORÍA', 10, y)
        doc.text('CANT', 46, y)
        doc.text('TOTAL', 70, y, { align: 'right' })
        y += 4
        doc.setFont('helvetica', 'normal')
        stats.categorias.forEach(c => {
          doc.text(String(c.categoria || 'Otros').substring(0, 15), 10, y)
          doc.text(String(c.cantidad), 48, y)
          doc.text(fmt(c.total), 70, y, { align: 'right' })
          y += 5
        })
      }
      y += 4
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Ventas procesadas: ${aceptadas.length}`, 40, y, { align: 'center' })
      y += 4
      doc.text('Generado por el sistema', 40, y, { align: 'center' })

      doc.save(`CierreCaja_${fi}_al_${ff}.pdf`)
      toast('PDF de Cierre generado (80mm)', 'success')
    } catch (e) {
      toast('Error al exportar PDF: ' + e.message, 'error')
    }
  }

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div><h2>Caja — Historial de ventas</h2></div>
      </div>

      {/* STATS */}
      <div className="stats-grid stats-3">
        <div className="stat-card">
          <div className="stat-label">Total vendido</div>
          <div className="stat-value">{fmt(stats.total_vendido)}</div>
          <div className="stat-sub">{stats.total_ventas} venta{stats.total_ventas !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Utilidad bruta</div>
          <div className="stat-value" style={{ color: 'var(--vd)' }}>{fmt(stats.utilidad_bruta)}</div>
          <div className="stat-sub vd">Precio venta − costo real</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">% Utilidad</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{stats.porcentaje_utilidad || 0}%</div>
          <div className="stat-sub">Margen real del período</div>
        </div>
      </div>

      {/* BARRA FILTROS */}
      <div className="caja-bar">
        <div className="filter-group">
          <label className="filter-label" style={{ color: 'var(--text3)' }}>Fecha inicio</label>
          <input className="filter-input" type="date" value={fi} onChange={e => setFi(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label" style={{ color: 'var(--text3)' }}>Fecha fin</label>
          <input className="filter-input" type="date" value={ff} onChange={e => setFf(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label" style={{ color: 'var(--text3)' }}>Estado</label>
          <select className="filter-input" value={est} onChange={e => setEst(e.target.value)}>
            <option value="">Todas</option>
            <option value="ACEPTADA">Aceptada</option>
            <option value="ANULADA">Anulada</option>
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={cargar}>Actualizar</button>
        <button className="btn btn-success btn-sm" onClick={exportar} style={{ marginLeft: 8 }}>Exportar Excel</button>
        <button className="btn btn-danger btn-sm" onClick={exportarPDF} style={{ marginLeft: 8 }}>Exportar PDF</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
          Total: {fmt(stats.total_vendido)} · {stats.total_ventas || 0} venta{(stats.total_ventas !== 1) ? 's' : ''} aceptadas
        </span>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Folio</th><th>Hora</th><th>Cliente</th><th>Ítems</th><th>Total</th>
                  <th>Utilidad</th><th>Métodos de pago</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700, color: 'var(--az)', fontSize: 12 }}>{v.folio}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{v.hora_venta}</td>
                    <td style={{ fontSize: 12 }}>{v.cliente_nombre || '—'}</td>
                    <td style={{ color: 'var(--az)', fontSize: 12 }}>{v.items_count || 0} ítem(s)</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{fmt(v.total)}</strong></td>
                    <td style={{ color: 'var(--vd)', fontWeight: 700, fontSize: 12 }}>{fmt(v.total - v.total_costo)}</td>
                    <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.metodos_pago_str || '—'}</td>
                    <td>
                      <span className={`badge ${v.estado === 'ACEPTADA' ? 'badge-green' : 'badge-red'}`}>{v.estado}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {v.estado === 'ACEPTADA' && (
                          <button className="btn btn-danger btn-xs" onClick={() => anular(v.id, v.folio)}>Anular</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!ventas.length && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: 28, color: 'var(--text3)', fontSize: 13 }}>Sin ventas en este período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
