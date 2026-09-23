const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  conn.exec('cat /var/www/restaurante-api/src/routes/ventas.js', (err, stream) => {
    let content = '';
    stream.on('close', () => {
      // Modificar el query de GET /api/ventas
      const oldQuery = `      SELECT v.*,
        (SELECT GROUP_CONCAT(CONCAT(mp.metodo_nombre, ': ', FORMAT(mp.monto,0))
                SEPARATOR ' | ')
         FROM venta_metodos_pago mp WHERE mp.venta_id = v.id) AS metodos_pago_str,
        (SELECT COUNT(*) FROM pedido_detalle pd
         LEFT JOIN pedidos pe ON pd.pedido_id = pe.id
         WHERE pe.id = v.pedido_id) AS items_count
      FROM ventas v`;
      
      const newQuery = `      SELECT v.*,
        (SELECT GROUP_CONCAT(CONCAT(mp.metodo_nombre, ': ', FORMAT(mp.monto,0))
                SEPARATOR ' | ')
         FROM venta_metodos_pago mp WHERE mp.venta_id = v.id) AS metodos_pago_str,
        (SELECT CONCAT('[', GROUP_CONCAT(JSON_OBJECT('tipo', IFNULL(mp.metodo_tipo, mp.metodo_nombre), 'nombre', mp.metodo_nombre, 'monto', mp.monto)), ']')
         FROM venta_metodos_pago mp WHERE mp.venta_id = v.id) AS metodos_pago,
        (SELECT COUNT(*) FROM pedido_detalle pd
         LEFT JOIN pedidos pe ON pd.pedido_id = pe.id
         WHERE pe.id = v.pedido_id) AS items_count
      FROM ventas v`;
      
      let fixed = content.replace(oldQuery, newQuery);
      
      if (fixed === content) {
        console.error('No se pudo hacer el replace del query');
        process.exit(1);
      }
      
      conn.sftp((err2, sftp) => {
        if (err2) throw err2;
        const ws = sftp.createWriteStream('/var/www/restaurante-api/src/routes/ventas.js');
        ws.on('close', () => {
          console.log('Query actualizado.');
          conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && pm2 restart restaurante-api', (err3, stream3) => {
            stream3.on('close', () => {
              console.log('PM2 restart OK');
              conn.end();
            });
          });
        });
        ws.write(fixed);
        ws.end();
      });
    }).on('data', d => content += d.toString()).stderr.on('data', d => content += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
