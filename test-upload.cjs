const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
const { execSync } = require('child_process');
try {
  execSync('echo "fake image content" > /tmp/dummy.png');
  const out = execSync('curl -s -X POST -F "imagen=@/tmp/dummy.png;type=image/png" http://localhost:3006/api/upload');
  console.log('Upload response:', out.toString());
} catch (e) {
  console.error(e.message);
  if (e.stdout) console.log(e.stdout.toString());
  if (e.stderr) console.error(e.stderr.toString());
}
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/test-upload.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/test-upload.js', (err2, stream) => {
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
