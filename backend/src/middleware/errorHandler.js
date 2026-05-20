import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error(`${status} ${req.method} ${req.url} — ${err.message}`, { stack: err.stack });
  res.status(status).json({
    error: status < 500 ? err.message : 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.url}` });
};
