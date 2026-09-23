const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const sql = `
    SET FOREIGN_KEY_CHECKS = 0;
    TRUNCATE TABLE venta_metodos_pago;
    TRUNCATE TABLE ventas;
    TRUNCATE TABLE pedido_detalle;
    TRUNCATE TABLE pedidos;
    TRUNCATE TABLE cartera;
    SET FOREIGN_KEY_CHECKS = 1;
  `;
  
  const cmd = `docker exec papeleria_app_mariadb mysql -u admin -padmin -D restaurante_app -e "${sql}"`;
  
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('Database cleaned successfully:', out);
      conn.end();
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
