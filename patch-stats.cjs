const { Client } = require('ssh2');
const conn = new Client();

const scriptContent = `
const fs = require('fs');
const path = '/var/www/restaurante-api/src/routes/ventas.js';
let content = fs.readFileSync(path, 'utf8');

const oldStats = \`    const [rows] = await db.query(sql, params);
    const s = rows[0];
    const total_costo = s.total_vendido - s.utilidad_bruta;
    const pct = total_costo > 0 ? ((s.utilidad_bruta / total_costo) * 100).toFixed(2) : 0;
    res.json({ success: true, data: { ...s, porcentaje_utilidad: parseFloat(pct) } });\`;

const newStats = \`    const [rows] = await db.query(sql, params);
    
    // Obtener ventas por categoría
    let sqlCat = \\"SELECT pr.categoria, SUM(pd.cantidad) AS cantidad, SUM(pd.cantidad * pd.precio_unitario) AS total FROM ventas v JOIN pedidos p ON v.pedido_id = p.id JOIN pedido_detalle pd ON pd.pedido_id = p.id LEFT JOIN productos pr ON pd.producto_id = pr.id WHERE v.estado = 'ACEPTADA'\\";
    const catParams = [];
    if (fecha_inicio) { sqlCat += ' AND v.fecha_venta >= ?'; catParams.push(fecha_inicio); }
    if (fecha_fin)    { sqlCat += ' AND v.fecha_venta <= ?'; catParams.push(fecha_fin); }
    sqlCat += ' GROUP BY pr.categoria ORDER BY total DESC';
    const [catRows] = await db.query(sqlCat, catParams);

    const s = rows[0];
    const total_costo = s.total_vendido - s.utilidad_bruta;
    const pct = total_costo > 0 ? ((s.utilidad_bruta / total_costo) * 100).toFixed(2) : 0;
    res.json({ success: true, data: { ...s, porcentaje_utilidad: parseFloat(pct), categorias: catRows } });\`;

content = content.replace(oldStats, newStats);
fs.writeFileSync(path, content, 'utf8');
console.log('Stats route patched for categories');
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/patch-stats.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/patch-stats.js && pm2 restart restaurante-api', (err2, stream) => {
        let out = '';
        stream.on('close', () => {
          console.log(out);
          conn.end();
        }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
      });
    });
    ws.write(scriptContent);
    ws.end();
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
