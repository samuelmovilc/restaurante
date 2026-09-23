const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
require('/var/www/restaurante-api/node_modules/dotenv').config({ path: '/var/www/restaurante-api/.env' });
const db = require('/var/www/restaurante-api/src/db/connection');
(async () => {
  try {
    const [rows] = await db.query(\`
      SELECT 
          COALESCE(c.nombre, 'Sin Categoría') AS categoria, 
          SUM(pd.cantidad) AS cantidad, 
          SUM(pd.cantidad * pd.precio_unitario) AS total 
      FROM ventas v 
      JOIN pedidos p ON v.pedido_id = p.id 
      JOIN pedido_detalle pd ON pd.pedido_id = p.id 
      LEFT JOIN productos pr ON pr.id = COALESCE(pd.producto_id, (SELECT id FROM productos WHERE nombre = pd.nombre_producto LIMIT 1))
      LEFT JOIN categorias c ON pr.categoria_id = c.id 
      WHERE v.estado = 'ACEPTADA'
      GROUP BY c.nombre
    \`);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/test-sql.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/test-sql.js', (err2, stream) => {
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
