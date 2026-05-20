import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

const signRefresh = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
  expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
});

// POST /api/v1/auth/register
export const register = async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    const rolesValidos = ['contador','auxiliar','empresario','persona_natural'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ error: `Rol inválido. Opciones: ${rolesValidos.join(', ')}` });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
    }

    // Verificar email único
    const { rows: exist } = await query('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase()]);
    if (exist.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo electrónico' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Crear usuario
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, apellido, email, rol, created_at`,
      [nombre.trim(), apellido.trim(), email.toLowerCase().trim(), password_hash, rol]
    );

    const user = rows[0];
    const token = sign(user.id);
    const refreshToken = signRefresh(user.id);

    logger.info(`✅ Nuevo usuario registrado: ${user.email} (${user.rol})`);

    res.status(201).json({
      message: '¡Cuenta creada exitosamente! Bienvenido a ContaFlow.',
      token,
      refreshToken,
      user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol: user.rol }
    });
  } catch (err) { next(err); }
};

// POST /api/v1/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const { rows } = await query(
      `SELECT id, nombre, apellido, email, password_hash, rol, activo
       FROM usuarios WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    if (!user.activo) return res.status(401).json({ error: 'Cuenta desactivada. Contacta soporte.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    // Actualizar último acceso
    await query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);

    // Obtener empresas del usuario
    const { rows: empresas } = await query(
      `SELECT e.id, e.nit, e.razon_social, e.nombre_comercial, ue.rol_empresa, ue.permisos
       FROM empresas e JOIN usuario_empresa ue ON ue.empresa_id = e.id
       WHERE ue.usuario_id = $1 AND ue.activo = true AND e.activa = true
       ORDER BY e.razon_social`,
      [user.id]
    );

    const token = sign(user.id);
    const refreshToken = signRefresh(user.id);

    logger.info(`🔐 Login: ${user.email}`);

    res.json({
      token,
      refreshToken,
      user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol: user.rol },
      empresas,
    });
  } catch (err) { next(err); }
};

// POST /api/v1/auth/refresh
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: rt } = req.body;
    if (!rt) return res.status(400).json({ error: 'refreshToken requerido' });
    const decoded = jwt.verify(rt, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query('SELECT id FROM usuarios WHERE id = $1 AND activo = true', [decoded.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Usuario no válido' });
    res.json({ token: sign(rows[0].id) });
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sesión expirada, inicia sesión' });
    next(err);
  }
};

// GET /api/v1/auth/me
export const me = async (req, res, next) => {
  try {
    const { rows: empresas } = await query(
      `SELECT e.id, e.nit, e.razon_social, e.nombre_comercial, ue.rol_empresa, ue.permisos
       FROM empresas e JOIN usuario_empresa ue ON ue.empresa_id = e.id
       WHERE ue.usuario_id = $1 AND ue.activo = true`,
      [req.user.id]
    );
    res.json({ user: req.user, empresas });
  } catch (err) { next(err); }
};

// PUT /api/v1/auth/change-password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres' });
    }
    const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) { next(err); }
};
