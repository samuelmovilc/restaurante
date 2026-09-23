const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
require('dotenv').config({ path: '/var/www/restaurante-api/.env' });
const db = require('/var/www/restaurante-api/src/db/connection');
(async () => {
  try {
    console.log('Connecting to db...');
    const conn = await db.getConnection();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE venta_metodos_pago');
    await conn.query('TRUNCATE TABLE ventas');
    await conn.query('TRUNCATE TABLE pedido_detalle');
    await conn.query('TRUNCATE TABLE pedidos');
    await conn.query('TRUNCATE TABLE cartera');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();
    console.log('All orders, sales, and cartera wiped successfully.');
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
    const ws = sftp.createWriteStream('/tmp/wipe.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && cd /var/www/restaurante-api && node /tmp/wipe.js', (err2, stream) => {
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
