const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
const fs = require('fs');
const path = '/var/www/restaurante-api/src/db/connection.js';
let content = fs.readFileSync(path, 'utf8');

// Modificar timezone en la configuración
content = content.replace("timezone: '+00:00',", "timezone: '-05:00',\\n  dateStrings: true,");

// Agregar el evento para setear el timezone en MySQL
if (!content.includes("pool.pool.on('connection'")) {
  content += "\\n\\npool.pool.on('connection', function (connection) {\\n  connection.query(\\"SET time_zone = '-05:00';\\");\\n});\\n";
}

// Asegurar que Node también usa America/Bogota
if (!content.includes("process.env.TZ")) {
  content = "process.env.TZ = 'America/Bogota';\\n" + content;
}

fs.writeFileSync(path, content, 'utf8');
console.log('connection.js patched for timezone UTC-5 (Bogota)');
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/patch-tz.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/patch-tz.js && pm2 restart restaurante-api', (err2, stream) => {
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
