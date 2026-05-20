import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      'SELECT id, nombre, apellido, email, rol, activo FROM usuarios WHERE id = $1',
      [decoded.id]
    );
    if (!rows[0] || !rows[0].activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }
    req.user = rows[0];
    // Empresa activa en contexto (header X-Empresa-Id)
    const empresaId = req.headers['x-empresa-id'];
    if (empresaId) {
      const { rows: emp } = await query(
        `SELECT e.* FROM empresas e
         JOIN usuario_empresa ue ON ue.empresa_id = e.id
         WHERE ue.usuario_id = $1 AND e.id = $2 AND ue.activo = true`,
        [req.user.id, empresaId]
      );
      if (emp[0]) req.empresa = emp[0];
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión nuevamente' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};

export const requireEmpresa = (req, res, next) => {
  if (!req.empresa) {
    return res.status(400).json({ error: 'Empresa requerida. Envía X-Empresa-Id en el header' });
  }
  next();
};
