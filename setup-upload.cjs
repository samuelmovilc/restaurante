const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
const fs = require('fs');
const path = require('path');

// 1. Create uploads dir
const uploadsDir = '/var/www/restaurante-api/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// 2. Write upload.js route
const uploadRouteContent = \`const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

router.post('/', upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No se subió ninguna imagen' } });
  }
  
  // Construct absolute URL so the frontend can use it directly
  const protocol = req.protocol;
  const host = req.get('host'); // Will be the Vercel host or the IP if called directly
  // Actually, returning a relative URL is safer with proxying, but absolute is easier for the DB
  // Because Vercel proxies /api/uploads to this backend, returning just /api/uploads/filename is perfect
  const imageUrl = \\\`/api/uploads/\\\${req.file.filename}\\\`;
  
  res.json({ success: true, data: { url: imageUrl } });
});

// Error handling for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: { message: err.message } });
  } else if (err) {
    return res.status(400).json({ success: false, error: { message: err.message } });
  }
  next();
});

module.exports = router;
\`;

fs.writeFileSync('/var/www/restaurante-api/src/routes/upload.js', uploadRouteContent);
console.log('Created src/routes/upload.js');

// 3. Patch server.js
let serverJs = fs.readFileSync('/var/www/restaurante-api/src/server.js', 'utf8');

if (!serverJs.includes("app.use('/api/upload'")) {
  serverJs = serverJs.replace(
    "// ── RUTAS ────────────────────────────────────────────────",
    "// ── RUTAS ────────────────────────────────────────────────\\napp.use('/api/upload',        require('./routes/upload'));\\napp.use('/api/uploads',       express.static(require('path').join(__dirname, '../uploads')));"
  );
  fs.writeFileSync('/var/www/restaurante-api/src/server.js', serverJs);
  console.log('Patched server.js with upload routes and static file serving');
} else {
  console.log('server.js already contains upload route');
}
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/setup-upload.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/setup-upload.js && pm2 restart restaurante-api', (err2, stream) => {
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
