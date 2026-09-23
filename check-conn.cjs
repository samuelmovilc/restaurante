const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
const fs = require('fs');
const content = fs.readFileSync('/var/www/restaurante-api/src/db/connection.js', 'utf8');
console.log(content);
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/check-conn.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/check-conn.js', (err2, stream) => {
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
