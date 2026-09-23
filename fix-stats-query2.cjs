const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
const fs = require('fs');
const path = '/var/www/restaurante-api/src/routes/ventas.js';
let content = fs.readFileSync(path, 'utf8');

const oldQuery = "SELECT COALESCE(c.nombre, 'Sin Categoría') AS categoria, SUM(pd.cantidad) AS cantidad, SUM(pd.cantidad * pd.precio_unitario) AS total FROM ventas v JOIN pedidos p ON v.pedido_id = p.id JOIN pedido_detalle pd ON pd.pedido_id = p.id LEFT JOIN productos pr ON pd.producto_id = pr.id LEFT JOIN categorias c ON pr.categoria_id = c.id WHERE v.estado = 'ACEPTADA' GROUP BY c.nombre";

const newQuery = "SELECT COALESCE(c.nombre, 'Sin Categoría') AS categoria, SUM(pd.cantidad) AS cantidad, SUM(pd.cantidad * pd.precio_unitario) AS total FROM ventas v JOIN pedidos p ON v.pedido_id = p.id JOIN pedido_detalle pd ON pd.pedido_id = p.id LEFT JOIN productos pr ON pr.id = COALESCE(pd.producto_id, (SELECT id FROM productos WHERE nombre = pd.nombre_producto LIMIT 1)) LEFT JOIN categorias c ON pr.categoria_id = c.id WHERE v.estado = 'ACEPTADA' GROUP BY c.nombre";

content = content.replace(oldQuery, newQuery);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched API with intelligent name-matching query');
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/fix-stats-query2.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/fix-stats-query2.js && pm2 restart restaurante-api', (err2, stream) => {
        let out = '';
        stream.on('close', () => {
          console.log(out);
          conn.end();
        }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
      });
    });
    ws.write(scriptToRun);
    ws.end();
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
