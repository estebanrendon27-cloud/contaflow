/**
 * ContaFlow — excel.routes.js
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { authenticate } from '../middleware/auth.middleware.js';
import { query } from '../config/database.js';
import { procesarIngresos, procesarGastos, procesarNomina } from '../services/excel.service.js';

const router = Router();
router.use(authenticate);

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx','.xls','.csv','.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// POST /excel/upload/:modulo
router.post('/upload/:modulo', upload.single('archivo'), async (req, res, next) => {
  try {
    const { modulo } = req.params;
    const empresaId = req.headers['x-empresa-id'];
    if (!empresaId) return res.status(400).json({ error: 'X-Empresa-Id requerido' });
    if (!req.file)  return res.status(400).json({ error: 'Archivo requerido' });

    const modulosValidos = ['ingresos','gastos','nomina','bancario'];
    if (!modulosValidos.includes(modulo)) return res.status(400).json({ error: `Módulo inválido` });

    // Registrar archivo en BD
    const { rows } = await query(
      `INSERT INTO archivos_cargados
       (empresa_id, usuario_id, nombre_original, nombre_storage, tipo_archivo, modulo, tamanio_bytes, mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [empresaId, req.user.id, req.file.originalname, req.file.filename,
       path.extname(req.file.originalname).replace('.',''),
       modulo, req.file.size, req.file.mimetype]
    );
    const archivoId = rows[0].id;

    // Procesar en background y responder inmediatamente
    res.json({ message: 'Archivo recibido, procesando...', archivoId, modulo });

    // Procesar según módulo
    const filePath = req.file.path;
    try {
      let stats;
      if (modulo === 'ingresos') stats = await procesarIngresos(empresaId, filePath, req.user.id, archivoId);
      else if (modulo === 'gastos') stats = await procesarGastos(empresaId, filePath, req.user.id, archivoId);
      else if (modulo === 'nomina') {
        const { mes, anio } = req.body;
        stats = await procesarNomina(empresaId, filePath, req.user.id, archivoId,
          parseInt(mes) || new Date().getMonth()+1,
          parseInt(anio) || new Date().getFullYear());
      }
    } catch (procErr) {
      await query(`UPDATE archivos_cargados SET estado='error' WHERE id=$1`, [archivoId]);
    }
  } catch (err) { next(err); }
});

// GET /excel/archivos — historial de archivos cargados
router.get('/archivos', async (req, res, next) => {
  try {
    const empresaId = req.headers['x-empresa-id'];
    if (!empresaId) return res.status(400).json({ error: 'X-Empresa-Id requerido' });
    const { rows } = await query(
      `SELECT * FROM archivos_cargados WHERE empresa_id=$1
       ORDER BY created_at DESC LIMIT 50`, [empresaId]
    );
    res.json({ archivos: rows });
  } catch (err) { next(err); }
});

// GET /excel/archivos/:id/estado
router.get('/archivos/:id/estado', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre_original, modulo, estado, filas_procesadas,
              filas_ok, filas_error, errores, created_at
       FROM archivos_cargados WHERE id=$1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /excel/plantilla/:modulo — descargar plantilla Excel
router.get('/plantilla/:modulo', async (req, res) => {
  const { modulo } = req.params;
  const XLSX = (await import('xlsx')).default;
  const plantillas = {
    ingresos: {
      headers: ['Fecha','NIT_Cliente','Nombre_Cliente','Descripcion','Subtotal','IVA','Total','Cuenta_PUC'],
      ejemplo:  [['2025-05-01','901234567-1','Cliente XYZ SAS','Servicios de construcción','10000000','1900000','11900000','4135']],
    },
    gastos: {
      headers: ['Fecha','NIT_Proveedor','Nombre_Proveedor','Descripcion','Subtotal','IVA','Total','Cuenta_PUC'],
      ejemplo:  [['2025-05-02','860006797-9','Proveedor ABC','Materiales','5000000','950000','5950000','6205']],
    },
    nomina: {
      headers: ['Cedula','Nombre','Cargo','Departamento','Salario_Basico','Dias_Trabajados','EPS','AFP','Nivel_Riesgo_ARL'],
      ejemplo:  [['12345678','Juan Pérez','Ingeniero','Obras','3200000','30','Sura','Porvenir','1']],
    },
    bancario: {
      headers: ['Fecha','Descripcion','Debito','Credito','Saldo'],
      ejemplo:  [['2025-05-01','TRANSFERENCIA ENTRADA','','28400000','96640000']],
    },
  };
  const p = plantillas[modulo];
  if (!p) return res.status(400).json({ error: 'Módulo inválido' });

  const wb = XLSX.utils.book_new();
  const wsData = [p.headers, ...p.ejemplo];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = p.headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');

  // Hoja de instrucciones
  const inst = XLSX.utils.aoa_to_sheet([
    ['ContaFlow — Plantilla de ' + modulo.toUpperCase()],
    [''],
    ['INSTRUCCIONES:'],
    ['1. No modificar los nombres de las columnas (fila 1)'],
    ['2. Ingresar datos a partir de la fila 2'],
    ['3. Fechas en formato YYYY-MM-DD o DD/MM/YYYY'],
    ['4. Valores sin puntos de miles ni signos $'],
    ['5. NIT sin dígito de verificación o con guión'],
  ]);
  XLSX.utils.book_append_sheet(wb, inst, 'Instrucciones');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=contaflow_plantilla_${modulo}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

export default router;
