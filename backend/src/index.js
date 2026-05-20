/**
 * ContaFlow Backend — Servidor principal
 * Puerto: 3001 (por defecto)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { connectDB } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// Rutas
import authRoutes from './routes/auth.routes.js';
import empresaRoutes from './routes/empresa.routes.js';
import excelRoutes from './routes/excel.routes.js';
import dianRoutes from './routes/dian.routes.js';
import contabilidadRoutes from './routes/contabilidad.routes.js';
import reportesRoutes from './routes/reportes.routes.js';
import nominaRoutes from './routes/nomina.routes.js';
import ivaRoutes from './routes/iva.routes.js';
import iaRoutes from './routes/ia.routes.js';

config(); // Cargar .env

const app = express();
const PORT = process.env.PORT || 3001;
const API = `/api/${process.env.API_VERSION || 'v1'}`;

// ─── MIDDLEWARES GLOBALES ───────────────────────────────────────────────────

// Seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Empresa-Id'],
}));

// Rate limiting
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging HTTP
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) }
}));

// Archivos estáticos (uploads)
app.use('/uploads', express.static('uploads'));

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    app: 'ContaFlow API',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─── RUTAS API ───────────────────────────────────────────────────────────────

app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/empresas`,      empresaRoutes);
app.use(`${API}/excel`,         excelRoutes);
app.use(`${API}/dian`,          dianRoutes);
app.use(`${API}/contabilidad`,  contabilidadRoutes);
app.use(`${API}/reportes`,      reportesRoutes);
app.use(`${API}/nomina`,        nominaRoutes);
app.use(`${API}/iva`,           ivaRoutes);
app.use(`${API}/ia`,            iaRoutes);

// ─── MANEJO DE ERRORES ───────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ─── INICIO ──────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`🚀 ContaFlow API corriendo en http://localhost:${PORT}`);
      logger.info(`📋 API Base: http://localhost:${PORT}${API}`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('❌ Error iniciando servidor:', err);
    process.exit(1);
  }
};

start();

export default app;
