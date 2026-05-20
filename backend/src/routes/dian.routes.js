/**
 * ContaFlow — dian.routes.js
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { query, withTransaction } from '../config/database.js';
import { registrarFEEnBD, generarVencimientos, validarCUFE, generarXMLFactura } from '../services/dian.service.js';

const router = Router();
router.use(authenticate);

// GET /dian/fe — listar FE
router.get('/fe', async (req, res, next) => {
  try {
    const empresaId = req.headers['x-empresa-id'];
    if (!empresaId) return res.status(400).json({ error: 'X-Empresa-Id requerido' });
    const { tipo, mes, anio, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let whereExtra = ''; const params = [empresaId];
    if (tipo) { params.push(tipo); whereExtra += ` AND tipo=$${params.length}`; }
    if (mes && anio) {
      params.push(mes, anio);
      whereExtra += ` AND EXTRACT(MONTH FROM fecha_emision)=$${params.length-1} AND EXTRACT(YEAR FROM fecha_emision)=$${params.length}`;
    }
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT * FROM facturas_electronicas WHERE empresa_id=$1${whereExtra}
       ORDER BY fecha_emision DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    const { rows: [cnt] } = await query(
      `SELECT COUNT(*) as total FROM facturas_electronicas WHERE empresa_id=$1${whereExtra}`,
      params.slice(0, -2)
    );
    res.json({ facturas: rows, total: parseInt(cnt.total), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// POST /dian/fe — registrar FE manual
router.post('/fe', async (req, res, next) => {
  try {
    const empresaId = req.headers['x-empresa-id'];
    const fe = await registrarFEEnBD(empresaId, req.body);
    res.status(201).json({ fe });
  } catch (err) { next(err); }
});

// POST /dian/fe/emitir — emitir nueva FE
router.post('/fe/emitir', async (req, res, next) => {
  try {
    const empresaId = req.headers['x-empresa-id'];
    if (!empresaId) return res.status(400).json({ error: 'X-Empresa-Id requerido' });
    const { rows: [empresa] } = await query('SELECT * FROM empresas WHERE id=$1', [empresaId]);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const { cliente_nit, cliente_nombre, items, observaciones } = req.body;
    if (!cliente_nit || !items?.length) {
      return res.status(400).json({ error: 'NIT cliente e ítems son requeridos' });
    }

    // Calcular totales
    let subtotal = 0, iva5 = 0, iva19 = 0;
    for (const item of items) {
      subtotal += item.cantidad * item.precio_unitario;
      if (item.tarifa_iva === 19) iva19 += item.cantidad * item.precio_unitario * 0.19;
      if (item.tarifa_iva === 5)  iva5  += item.cantidad * item.precio_unitario * 0.05;
    }
    const total = subtotal + iva5 + iva19;

    // Número de FE consecutivo
    const { rows: [last] } = await query(
      `SELECT numero_fe FROM facturas_electronicas WHERE empresa_id=$1 AND tipo='emitida'
       ORDER BY created_at DESC LIMIT 1`, [empresaId]
    );
    const num = last ? parseInt(last.numero_fe.split('-').pop()) + 1 : 1;
    const numero = `FE-${new Date().getFullYear()}-${String(num).padStart(4,'0')}`;

    const feData = {
      tipo: 'emitida', numero,
      fecha: new Date().toISOString().split('T')[0],
      emisor_nit: empresa.nit, emisor_nombre: empresa.razon_social,
      cliente_nit, cliente_nombre,
      subtotal: Math.round(subtotal), iva: Math.round(iva19 + iva5),
      total: Math.round(total),
    };

    // Generar XML
    const xml = generarXMLFactura({ ...feData, numero, cliente_nombre }, empresa);

    // Registrar en BD
    const fe = await registrarFEEnBD(empresaId, feData);

    res.status(201).json({
      message: 'Factura electrónica emitida correctamente',
      fe, numero, subtotal, iva: iva19 + iva5, total,
      xml_disponible: true,
    });
  } catch (err) { next(err); }
});

// POST /dian/fe/validar-cufe
router.post('/fe/validar-cufe', async (req, res, next) => {
  try {
    const { cufe } = req.body;
    if (!cufe) return res.status(400).json({ error: 'CUFE requerido' });
    const resultado = await validarCUFE(cufe);
    res.json(resultado);
  } catch (err) { next(err); }
});

// GET /dian/token — estado del token
router.get('/token', async (req, res, next) => {
  try {
    const empresaId = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT id, nombre_archivo, tipo_certificado, ambiente, emisor,
              fecha_inicio, fecha_vence, activo, ultimo_uso, total_usos,
              (fecha_vence - CURRENT_DATE) as dias_restantes
       FROM tokens_dian WHERE empresa_id=$1 AND activo=true`, [empresaId]
    );
    res.json({ token: rows[0] || null });
  } catch (err) { next(err); }
});

// POST /dian/token — subir token DIAN
router.post('/token', async (req, res, next) => {
  try {
    const empresaId = req.headers['x-empresa-id'];
    const { nombre_archivo, tipo_certificado, ambiente, emisor, fecha_inicio, fecha_vence } = req.body;
    await query(`UPDATE tokens_dian SET activo=false WHERE empresa_id=$1`, [empresaId]);
    const { rows } = await query(
      `INSERT INTO tokens_dian
       (empresa_id, nombre_archivo, tipo_certificado, ambiente, emisor, fecha_inicio, fecha_vence)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [empresaId, nombre_archivo, tipo_certificado || 'p12', ambiente || 'produccion',
       emisor, fecha_inicio, fecha_vence]
    );
    res.status(201).json({ message: 'Token registrado correctamente', token: rows[0] });
  } catch (err) { next(err); }
});

// GET /dian/vencimientos
router.get('/vencimientos', async (req, res, next) => {
  try {
    const empresaId = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT * FROM vencimientos_tributarios
       WHERE empresa_id=$1 AND fecha_vence >= CURRENT_DATE
       ORDER BY fecha_vence LIMIT 20`, [empresaId]
    );
    res.json({ vencimientos: rows });
  } catch (err) { next(err); }
});

// GET /dian/resumen — KPIs de FE del mes
router.get('/resumen', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo='recibida') as fe_recibidas,
         COUNT(*) FILTER (WHERE tipo='emitida') as fe_emitidas,
         COUNT(*) FILTER (WHERE tipo IN ('nota_credito','nota_debito')) as notas,
         COALESCE(SUM(total) FILTER (WHERE tipo='recibida'),0) as total_recibidas,
         COALESCE(SUM(total) FILTER (WHERE tipo='emitida'),0) as total_emitidas,
         COUNT(*) FILTER (WHERE estado_dian='pendiente') as pendientes_dian
       FROM facturas_electronicas
       WHERE empresa_id=$1
       AND DATE_TRUNC('month',fecha_emision)=DATE_TRUNC('month',CURRENT_DATE)`, [eid]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
