const router = require('express').Router();
const db = require('../db/connection');
const { auth } = require('../middleware/auth');

// GET /api/pedidos — con filtros
router.get('/', auth, async (req, res, next) => {
  try {
    const { fecha, hora_desde, hora_hasta, vendedor_id, tipo_pedido, estado, orden } = req.query;
    let sql = `
      SELECT p.*,
             m.nombre  AS mesa_nombre,
             v.nombre  AS vendedor_nombre,
             (SELECT JSON_ARRAYAGG(
               JSON_OBJECT('id', pd.id, 'nombre_producto', pd.nombre_producto,
                           'cantidad', pd.cantidad, 'precio_unitario', pd.precio_unitario,
                           'precio_costo', pd.precio_costo, 'subtotal', pd.subtotal, 'nota', pd.nota)
             ) FROM pedido_detalle pd WHERE pd.pedido_id = p.id) AS items
      FROM pedidos p
      LEFT JOIN mesas     m ON p.mesa_id     = m.id
      LEFT JOIN vendedores v ON p.vendedor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    if (fecha)       { sql += ' AND DATE(p.created_at) = ?'; params.push(fecha); }
    if (hora_desde)  { sql += ' AND TIME(p.created_at) >= ?'; params.push(hora_desde); }
    if (hora_hasta)  { sql += ' AND TIME(p.created_at) <= ?'; params.push(hora_hasta); }
    if (vendedor_id) { sql += ' AND p.vendedor_id = ?';       params.push(vendedor_id); }
    if (tipo_pedido) { sql += ' AND p.tipo_pedido = ?';       params.push(tipo_pedido); }
    if (estado)      { sql += ' AND p.estado = ?';            params.push(estado); }
    sql += ` ORDER BY p.created_at ${orden === 'asc' ? 'ASC' : 'DESC'}`;
    const [rows] = await db.query(sql, params);
    // Parsear items JSON (puede venir como string)
    const data = rows.map(r => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || [])
    }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/pedidos/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, m.nombre AS mesa_nombre, v.nombre AS vendedor_nombre
       FROM pedidos p
       LEFT JOIN mesas m ON p.mesa_id = m.id
       LEFT JOIN vendedores v ON p.vendedor_id = v.id
       WHERE p.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'PEDIDO_NO_ENCONTRADO' } });
    const [items] = await db.query('SELECT * FROM pedido_detalle WHERE pedido_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...rows[0], items } });
  } catch (err) { next(err); }
});

// POST /api/pedidos — público para pedido.html
router.post('/', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { nombre_cliente, tipo_pedido, mesa_id, telefono, direccion, observaciones, vendedor_id, items } = req.body;
    // Validaciones
    if (!items || !items.length) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, error: { code: 'CARRITO_VACIO', message: 'El pedido debe tener al menos un producto' } });
    }
    if (!nombre_cliente?.trim()) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, error: { code: 'CLIENTE_REQUERIDO', message: 'Nombre del cliente requerido' } });
    }
    if (tipo_pedido === 'mesa' && !mesa_id) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, error: { code: 'MESA_REQUERIDA', message: 'Selecciona una mesa' } });
    }
    // Obtener número de pedido (transaccional)
    const [cnt] = await conn.query('SELECT valor FROM contadores WHERE nombre = ? FOR UPDATE', ['numero_pedido']);
    const numero = cnt[0].valor + 1;
    await conn.query('UPDATE contadores SET valor = ? WHERE nombre = ?', [numero, 'numero_pedido']);
    // Calcular total y snapshot de costos
    let total = 0;
    const detalles = [];
    for (const item of items) {
      const [prods] = await conn.query(
        'SELECT id, nombre, precio_venta, precio_costo FROM productos WHERE id = ? AND activo = 1',
        [item.producto_id]
      );
      if (!prods.length) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, error: { code: 'PRODUCTO_NO_ENCONTRADO', message: `Producto ${item.producto_id} no encontrado` } });
      }
      const prod = prods[0];
      const precio = item.precio_unitario || prod.precio_venta;
      const sub = precio * item.cantidad;
      total += sub;
      detalles.push({ producto_id: prod.id, nombre_producto: prod.nombre, precio_unitario: precio, precio_costo: prod.precio_costo, cantidad: item.cantidad, subtotal: sub, nota: item.nota || null });
    }
    // INSERT pedido
    const [pedResult] = await conn.query(
      `INSERT INTO pedidos (numero_pedido, nombre_cliente, tipo_pedido, mesa_id, telefono, direccion, observaciones, vendedor_id, total, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [numero, nombre_cliente.trim(), tipo_pedido || 'mesa', mesa_id || null, telefono || null,
       direccion || null, observaciones || null, vendedor_id || null, total]
    );
    const pedidoId = pedResult.insertId;
    // INSERT detalle
    for (const d of detalles) {
      await conn.query(
        `INSERT INTO pedido_detalle (pedido_id, producto_id, nombre_producto, precio_unitario, precio_costo, cantidad, subtotal, nota)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [pedidoId, d.producto_id, d.nombre_producto, d.precio_unitario, d.precio_costo, d.cantidad, d.subtotal, d.nota]
      );
    }
    await conn.commit();
    conn.release();
    res.status(201).json({ success: true, data: { id: pedidoId, numero_pedido: numero, total, estado: 'pendiente' } });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
});

// PUT /api/pedidos/:id — actualizar ítems y observaciones
router.put('/:id', auth, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { observaciones, items } = req.body;
    const pedidoId = req.params.id;
    const [ped] = await conn.query('SELECT id FROM pedidos WHERE id = ?', [pedidoId]);
    if (!ped.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: { code: 'PEDIDO_NO_ENCONTRADO' } });
    }
    // Borrar detalle actual e insertar nuevo
    await conn.query('DELETE FROM pedido_detalle WHERE pedido_id = ?', [pedidoId]);
    let total = 0;
    if (items && items.length) {
      for (const item of items) {
        const sub = (item.precio_unitario || 0) * (item.cantidad || 1);
        total += sub;
        await conn.query(
          `INSERT INTO pedido_detalle (pedido_id, producto_id, nombre_producto, precio_unitario, precio_costo, cantidad, subtotal, nota)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [pedidoId, item.producto_id || null, item.nombre_producto, item.precio_unitario || 0,
           item.precio_costo || 0, item.cantidad || 1, sub, item.nota || null]
        );
      }
    }
    await conn.query(
      'UPDATE pedidos SET observaciones = ?, total = ? WHERE id = ?',
      [observaciones || null, total, pedidoId]
    );
    await conn.commit();
    conn.release();
    const [rows] = await db.query('SELECT * FROM pedidos WHERE id = ?', [pedidoId]);
    const [newItems] = await db.query('SELECT * FROM pedido_detalle WHERE pedido_id = ?', [pedidoId]);
    res.json({ success: true, data: { ...rows[0], items: newItems } });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
});

// PATCH /api/pedidos/:id/estado
router.patch('/:id/estado', auth, async (req, res, next) => {
  try {
    const estados = ['pendiente', 'preparacion', 'listo', 'entregado', 'cancelado', 'liquidado'];
    const { estado } = req.body;
    if (!estados.includes(estado)) {
      return res.status(400).json({ success: false, error: { code: 'ESTADO_INVALIDO', message: `Estado debe ser uno de: ${estados.join(', ')}` } });
    }
    const [result] = await db.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, error: { code: 'PEDIDO_NO_ENCONTRADO' } });
    res.json({ success: true, data: { id: parseInt(req.params.id), estado } });
  } catch (err) { next(err); }
});

module.exports = router;
