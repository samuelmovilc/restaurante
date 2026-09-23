const router = require('express').Router();
const db = require('../db/connection');
const { auth } = require('../middleware/auth');

// GET /api/ventas/stats — estadísticas para la caja
router.get('/stats', auth, async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let sql = `
      SELECT
        COUNT(*)                   AS total_ventas,
        COALESCE(SUM(total), 0)    AS total_vendido,
        COALESCE(SUM(total - total_costo), 0) AS utilidad_bruta
      FROM ventas
      WHERE estado = 'ACEPTADA'
    `;
    const params = [];
    if (fecha_inicio) { sql += ' AND fecha_venta >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { sql += ' AND fecha_venta <= ?'; params.push(fecha_fin); }
    const [rows] = await db.query(sql, params);
    const s = rows[0];
    const total_costo = s.total_vendido - s.utilidad_bruta;
    const pct = total_costo > 0 ? ((s.utilidad_bruta / total_costo) * 100).toFixed(2) : 0;
    res.json({ success: true, data: { ...s, porcentaje_utilidad: parseFloat(pct) } });
  } catch (err) { next(err); }
});

// GET /api/ventas — historial filtrado
router.get('/', auth, async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, estado } = req.query;
    let sql = `
      SELECT v.*,
        (SELECT GROUP_CONCAT(CONCAT(mp.metodo_nombre, ': ', FORMAT(mp.monto,0))
                SEPARATOR ' | ')
         FROM venta_metodos_pago mp WHERE mp.venta_id = v.id) AS metodos_pago_str,
        (SELECT COUNT(*) FROM pedido_detalle pd
         LEFT JOIN pedidos pe ON pd.pedido_id = pe.id
         WHERE pe.id = v.pedido_id) AS items_count
      FROM ventas v
      WHERE 1=1
    `;
    const params = [];
    if (fecha_inicio) { sql += ' AND v.fecha_venta >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { sql += ' AND v.fecha_venta <= ?'; params.push(fecha_fin); }
    if (estado)       { sql += ' AND v.estado = ?';       params.push(estado); }
    sql += ' ORDER BY v.created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/ventas/:id — detalle
router.get('/:id', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'VENTA_NO_ENCONTRADA' } });
    const [mps] = await db.query('SELECT * FROM venta_metodos_pago WHERE venta_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...rows[0], metodos_pago: mps } });
  } catch (err) { next(err); }
});

// POST /api/ventas — liquidar venta
router.post('/', auth, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { pedido_id, cliente_nombre, observaciones, metodos_pago, total } = req.body;
    if (!pedido_id || !metodos_pago?.length || !total) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, error: { code: 'CAMPOS_REQUERIDOS', message: 'pedido_id, metodos_pago y total son requeridos' } });
    }
    // Verificar que pedido no esté ya liquidado
    const [filasPed] = await conn.query(
      `SELECT p.*, pd.precio_costo, pd.cantidad
       FROM pedidos p
       LEFT JOIN pedido_detalle pd ON pd.pedido_id = p.id
       WHERE p.id = ?`, [pedido_id]
    );
    if (!filasPed.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: { code: 'PEDIDO_NO_ENCONTRADO' } });
    }
    const [existing] = await conn.query('SELECT id FROM ventas WHERE pedido_id = ? AND estado = "ACEPTADA"', [pedido_id]);
    if (existing.length) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ success: false, error: { code: 'PEDIDO_YA_LIQUIDADO', message: 'Este pedido ya fue liquidado' } });
    }
    // Calcular total_costo (utilidad real)
    const [costoRows] = await conn.query(
      'SELECT COALESCE(SUM(precio_costo * cantidad), 0) AS total_costo FROM pedido_detalle WHERE pedido_id = ?',
      [pedido_id]
    );
    const total_costo = parseFloat(costoRows[0].total_costo || 0);
    // Generar folio
    const hoy = new Date();
    const yy = String(hoy.getFullYear()).slice(2);
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const [cntRow] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM ventas WHERE fecha_venta = CURDATE()`
    );
    const seq = String(parseInt(cntRow[0].cnt || 0) + 1).padStart(3, '0');
    const waiter_id = filasPed[0].vendedor_id;
    const folio = `VENTA-${yy}${mm}${dd}-${seq}`;
    // INSERT venta
    const [vtaResult] = await conn.query(
      `INSERT INTO ventas (folio, pedido_id, cliente_nombre, observaciones, total, total_costo, estado, fecha_venta, hora_venta, vendedor_id)
       VALUES (?, ?, ?, ?, ?, ?, 'ACEPTADA', CURDATE(), CURTIME(), ?)`,
      [folio, pedido_id, cliente_nombre || null, observaciones || null, total, total_costo, waiter_id]
    );
    const ventaId = vtaResult.insertId;
    // INSERT métodos de pago
    for (const mp of metodos_pago) {
      await conn.query(
        'INSERT INTO venta_metodos_pago (venta_id, metodo_nombre, metodo_tipo, monto) VALUES (?, ?, ?, ?)',
        [ventaId, mp.nombre, mp.tipo, mp.monto]
      );
      // Si es crédito → registrar en cartera
      if (mp.tipo === 'credito') {
        const [detallesRows] = await conn.query(
          'SELECT nombre_producto, cantidad FROM pedido_detalle WHERE pedido_id = ?', [pedido_id]
        );
        const itemsDesc = detallesRows.map(d => `${d.nombre_producto} x${d.cantidad}`).join(', ');
        const [pedNum] = await conn.query('SELECT numero_pedido FROM pedidos WHERE id = ?', [pedido_id]);
        await conn.query(
          `INSERT INTO cartera (trabajador_nombre, pedido_numero, venta_id, fecha_venta, items_descripcion, total)
           VALUES (?, ?, ?, CURDATE(), ?, ?)`,
          [cliente_nombre || 'Sin nombre', `#${pedNum[0]?.numero_pedido || pedido_id}`, ventaId, itemsDesc, mp.monto || total]
        );
      }
    }
    // UPDATE estado pedido
    await conn.query("UPDATE pedidos SET estado = 'entregado' WHERE id = ?", [pedido_id]);
    await conn.commit();
    conn.release();
    res.status(201).json({ success: true, data: { id: ventaId, folio, total, estado: 'ACEPTADA' } });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
});

// PATCH /api/ventas/:id/anular
router.patch('/:id/anular', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'VENTA_NO_ENCONTRADA' } });
    if (rows[0].estado === 'ANULADA') return res.status(409).json({ success: false, error: { code: 'VENTA_YA_ANULADA' } });
    await db.query("UPDATE ventas SET estado = 'ANULADA' WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: { id: parseInt(req.params.id), estado: 'ANULADA' } });
  } catch (err) { next(err); }
});

// GET /api/ventas/export/excel
router.get('/export/excel', auth, async (req, res, next) => {
  try {
    const XLSX = require('xlsx');
    const { fecha_inicio, fecha_fin, estado } = req.query;
    let sql = 'SELECT folio, fecha_venta, hora_venta, cliente_nombre, total, (total - total_costo) AS utilidad, estado FROM ventas WHERE 1=1';
    const params = [];
    if (fecha_inicio) { sql += ' AND fecha_venta >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { sql += ' AND fecha_venta <= ?'; params.push(fecha_fin); }
    if (estado)       { sql += ' AND estado = ?';       params.push(estado); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="caja.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
});

module.exports = router;
