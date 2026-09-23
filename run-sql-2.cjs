const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
require('/var/www/restaurante-api/node_modules/dotenv').config({ path: '/var/www/restaurante-api/.env' });
const db = require('/var/www/restaurante-api/src/db/connection');
(async () => {
  try {
    const [rows] = await db.query(\`
      SELECT 
          pd.nombre AS Producto_Nombre_En_Pedido,
          pr.nombre AS Producto_Nombre_En_Catalogo,
          SUM(pd.cantidad) AS Cantidad_Vendida,
          SUM(pd.cantidad * pd.precio_unitario) AS Total_Recaudado
      FROM ventas v
      JOIN pedido_detalle pd ON v.pedido_id = pd.pedido_id
      LEFT JOIN productos pr ON pd.producto_id = pr.id
      WHERE v.estado = 'ACEPTADA' 
        AND (pr.categoria_id IS NULL OR pr.categoria_id = 0 OR pr.id IS NULL)
      GROUP BY pd.nombre, pr.nombre
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
    const ws = sftp.createWriteStream('/tmp/run-sql-2.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/run-sql-2.js', (err2, stream) => {
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
