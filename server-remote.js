require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);

// ── SEGURIDAD ────────────────────────────────────────────
app.use(helmet());

// CORS — solo dominios permitidos
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Permitir peticiones sin origin (Postman, móvil nativo, etc.)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado para: ${origin}`));
  },
  credentials: true,
}));

// Rate limiting
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { success: false, error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Espera 15 minutos.' } }
}));

app.use('/api/pedidos', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
}));

// ── BODY PARSER ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HEALTH CHECK ─────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const db = require('./db/connection');
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message });
  }
});

// ── RUTAS ────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/configuracion', require('./routes/configuracion'));
app.use('/api/productos',     require('./routes/productos'));
app.use('/api/pedidos',       require('./routes/pedidos'));
app.use('/api/ventas',        require('./routes/ventas'));
app.use('/api/cartera',       require('./routes/cartera'));
app.use('/api/costeos',       require('./routes/costeos'));
// Catálogo: mesas, categorias, vendedores, metodos_pago
app.use('/api',               require('./routes/catalogo'));

// ── MANEJO DE ERRORES ────────────────────────────────────
const { errorHandler, notFound } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ── INICIO ───────────────────────────────────────────────
const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
});
