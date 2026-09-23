const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
const fs = require('fs');
const path = '/var/www/restaurante-api/src/routes/ventas.js';
let content = fs.readFileSync(path, 'utf8');

const oldQuery = "SELECT pr.categoria, SUM(pd.cantidad) AS cantidad, SUM(pd.cantidad * pd.precio_unitario) AS total FROM ventas v JOIN pedidos p ON v.pedido_id = p.id JOIN pedido_detalle pd ON pd.pedido_id = p.id LEFT JOIN productos pr ON pd.producto_id = pr.id WHERE v.estado = 'ACEPTADA'";

const newQuery = "SELECT COALESCE(c.nombre, 'Sin Categoría') AS categoria, SUM(pd.cantidad) AS cantidad, SUM(pd.cantidad * pd.precio_unitario) AS total FROM ventas v JOIN pedidos p ON v.pedido_id = p.id JOIN pedido_detalle pd ON pd.pedido_id = p.id LEFT JOIN productos pr ON pd.producto_id = pr.id LEFT JOIN categorias c ON pr.categoria_id = c.id WHERE v.estado = 'ACEPTADA'";

content = content.replace(oldQuery, newQuery);
// Fix the GROUP BY as well
content = content.replace("GROUP BY pr.categoria", "GROUP BY c.nombre");

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed category query');
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/fix-stats-query.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/fix-stats-query.js && pm2 restart restaurante-api', (err2, stream) => {
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
