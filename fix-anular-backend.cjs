const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

// Read current ventas.js and update the anular endpoint to also set pedido as cancelado
let content = fs.readFileSync('ventas-remote-full.js', 'utf8');

// Fix the anular route to also cancel the associated pedido
const oldAnular = `// PATCH /api/ventas/:id/anular
router.patch('/:id/anular', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'VENTA_NO_ENCONTRADA' } });
    if (rows[0].estado === 'ANULADA') return res.status(409).json({ success: false, error: { code: 'VENTA_YA_ANULADA' } });
    await db.query("UPDATE ventas SET estado = 'ANULADA' WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: { id: parseInt(req.params.id), estado: 'ANULADA' } });
  } catch (err) { next(err); }
});`;

const newAnular = `// PATCH /api/ventas/:id/anular
router.patch('/:id/anular', auth, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: { code: 'VENTA_NO_ENCONTRADA' } });
    }
    if (rows[0].estado === 'ANULADA') {
      await conn.rollback(); conn.release();
      return res.status(409).json({ success: false, error: { code: 'VENTA_YA_ANULADA' } });
    }
    // Anular la venta
    await conn.query("UPDATE ventas SET estado = 'ANULADA' WHERE id = ?", [req.params.id]);
    // También marcar el pedido asociado como cancelado
    if (rows[0].pedido_id) {
      await conn.query("UPDATE pedidos SET estado = 'cancelado' WHERE id = ?", [rows[0].pedido_id]);
    }
    await conn.commit();
    conn.release();
    res.json({ success: true, data: { id: parseInt(req.params.id), estado: 'ANULADA', pedido_cancelado: !!rows[0].pedido_id } });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
});`;

const fixedContent = content.replace(oldAnular, newAnular);

if (fixedContent === content) {
  console.error('ERROR: Pattern not found. Check whitespace/quotes.');
  process.exit(1);
}

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/var/www/restaurante-api/src/routes/ventas.js');
    ws.on('close', () => {
      console.log('ventas.js uploaded with fixed anular endpoint');
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && pm2 restart restaurante-api', (err2, stream2) => {
        let out = '';
        stream2.on('close', () => {
          console.log('PM2:', out.substring(0, 200));
          conn.end();
        }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
      });
    });
    ws.write(fixedContent);
    ws.end();
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
