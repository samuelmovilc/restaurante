const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  // Read the current ventas.js (already uploaded version with anular fix)
  conn.exec('cat /var/www/restaurante-api/src/routes/ventas.js', (err, stream) => {
    let content = '';
    stream.on('close', () => {
      // Add pedido_id filter to the GET / route
      const oldFilter = `    if (fecha_inicio) { sql += ' AND v.fecha_venta >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { sql += ' AND v.fecha_venta <= ?'; params.push(fecha_fin); }
    if (estado)       { sql += ' AND v.estado = ?';       params.push(estado); }`;
      
      const newFilter = `    if (fecha_inicio) { sql += ' AND v.fecha_venta >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { sql += ' AND v.fecha_venta <= ?'; params.push(fecha_fin); }
    if (estado)       { sql += ' AND v.estado = ?';       params.push(estado); }
    if (req.query.pedido_id) { sql += ' AND v.pedido_id = ?'; params.push(req.query.pedido_id); }`;
      
      const oldQuery = `    const { fecha_inicio, fecha_fin, estado } = req.query;`;
      const newQuery = `    const { fecha_inicio, fecha_fin, estado } = req.query;`;
      
      let fixed = content.replace(oldFilter, newFilter);
      
      if (fixed === content) {
        console.error('Pattern not found!');
        console.log('Content around filter:', content.substring(content.indexOf('fecha_inicio'), content.indexOf('fecha_inicio') + 300));
        conn.end();
        return;
      }
      
      conn.sftp((err2, sftp) => {
        if (err2) throw err2;
        const ws = sftp.createWriteStream('/var/www/restaurante-api/src/routes/ventas.js');
        ws.on('close', () => {
          console.log('ventas.js updated with pedido_id filter');
          conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && pm2 restart restaurante-api', (err3, stream3) => {
            let out = '';
            stream3.on('close', () => {
              console.log('PM2 restart:', out.substring(0, 200));
              conn.end();
            }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
          });
        });
        ws.write(fixed);
        ws.end();
      });
    }).on('data', d => content += d.toString()).stderr.on('data', d => content += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
