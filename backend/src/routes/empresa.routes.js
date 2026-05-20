/**
 * ContaFlow — Rutas: Empresas
 */
import { Router } from 'express';
import { query, withTransaction } from '../config/database.js';
import { authenticate, requireEmpresa } from '../middleware/auth.middleware.js';
import { generarVencimientos } from '../services/dian.service.js';

const router = Router();
router.use(authenticate);

// GET /empresas — listar empresas del usuario
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*, ue.rol_empresa, ue.permisos
       FROM empresas e JOIN usuario_empresa ue ON ue.empresa_id = e.id
       WHERE ue.usuario_id = $1 AND ue.activo = true AND e.activa = true
       ORDER BY e.razon_social`,
      [req.user.id]
    );
    res.json({ empresas: rows });
  } catch (err) { next(err); }
});

// POST /empresas — crear empresa
router.post('/', async (req, res, next) => {
  try {
    const {
      nit, digito_verificacion, razon_social, nombre_comercial, email,
      telefono, direccion, departamento, municipio, codigo_ciiu,
      actividad_economica, regimen_tributario, tipo_empresa,
      estandar_niif, fecha_inicio_act, responsabilidades
    } = req.body;

    if (!nit || !razon_social || !digito_verificacion) {
      return res.status(400).json({ error: 'NIT, razón social y dígito verificación son requeridos' });
    }

    const empresa = await withTransaction(async (client) => {
      // Crear empresa
      const { rows: [emp] } = await client.query(
        `INSERT INTO empresas
         (nit, digito_verificacion, razon_social, nombre_comercial, email, telefono,
          direccion, departamento, municipio, codigo_ciiu, actividad_economica,
          regimen_tributario, tipo_empresa, estandar_niif, fecha_inicio_act, responsabilidades)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [nit, digito_verificacion, razon_social, nombre_comercial, email, telefono,
         direccion, departamento, municipio, codigo_ciiu, actividad_economica,
         regimen_tributario || 'responsable_iva', tipo_empresa,
         estandar_niif || 'niif_pymes', fecha_inicio_act,
         JSON.stringify(responsabilidades || [])]
      );

      // Vincular usuario
      await client.query(
        `INSERT INTO usuario_empresa (usuario_id, empresa_id, rol_empresa)
         VALUES ($1, $2, $3)`,
        [req.user.id, emp.id, req.user.rol]
      );

      // Crear período contable actual
      const now = new Date();
      await client.query(
        `INSERT INTO periodos_contables (empresa_id, anio, mes, fecha_inicio, fecha_fin)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [emp.id, now.getFullYear(), now.getMonth() + 1,
         new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
         new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]]
      );

      // Cargar PUC base (cuentas principales)
      await cargarPUCBase(client, emp.id);

      return emp;
    });

    // Generar vencimientos tributarios
    await generarVencimientos(empresa.id);

    res.status(201).json({ message: 'Empresa creada correctamente', empresa });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una empresa con este NIT' });
    next(err);
  }
});

// GET /empresas/:id — detalle empresa
router.get('/:id', requireEmpresa, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*,
         (SELECT COUNT(*) FROM transacciones WHERE empresa_id=e.id) as total_transacciones,
         (SELECT COUNT(*) FROM facturas_electronicas WHERE empresa_id=e.id) as total_fe,
         (SELECT COUNT(*) FROM nomina_periodos WHERE empresa_id=e.id) as total_nominas
       FROM empresas e WHERE e.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ empresa: rows[0] });
  } catch (err) { next(err); }
});

// PUT /empresas/:id — actualizar empresa
router.put('/:id', async (req, res, next) => {
  try {
    const campos = ['razon_social','nombre_comercial','email','telefono','direccion',
                    'departamento','municipio','codigo_ciiu','actividad_economica',
                    'regimen_tributario','tipo_empresa','responsabilidades'];
    const updates = []; const vals = []; let i = 1;
    for (const c of campos) {
      if (req.body[c] !== undefined) { updates.push(`${c}=$${i++}`); vals.push(req.body[c]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
    vals.push(req.params.id);
    const { rows } = await query(
      `UPDATE empresas SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals
    );
    res.json({ empresa: rows[0] });
  } catch (err) { next(err); }
});

// GET /empresas/:id/dashboard — datos del dashboard
router.get('/:id/dashboard', async (req, res, next) => {
  try {
    const eid = req.params.id;
    const [ingresos, gastos, vencimientos, actividad, kpis] = await Promise.all([
      query(`SELECT COALESCE(SUM(credito),0) as total FROM transacciones
             WHERE empresa_id=$1 AND tipo='ingreso'
             AND DATE_TRUNC('month',fecha)=DATE_TRUNC('month',CURRENT_DATE)`, [eid]),
      query(`SELECT COALESCE(SUM(debito),0) as total FROM transacciones
             WHERE empresa_id=$1 AND tipo IN ('gasto','costo')
             AND DATE_TRUNC('month',fecha)=DATE_TRUNC('month',CURRENT_DATE)`, [eid]),
      query(`SELECT * FROM vencimientos_tributarios
             WHERE empresa_id=$1 AND presentado=false AND fecha_vence>=CURRENT_DATE
             ORDER BY fecha_vence LIMIT 6`, [eid]),
      query(`SELECT tipo,descripcion,created_at FROM transacciones
             WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 8`, [eid]),
      query(`SELECT
               COALESCE(SUM(CASE WHEN tipo='ingreso' THEN credito ELSE 0 END),0) as ingresos_mes,
               COALESCE(SUM(CASE WHEN tipo IN('gasto','costo') THEN debito ELSE 0 END),0) as gastos_mes,
               COALESCE((SELECT SUM(iva_pagar) FROM iva_periodos WHERE empresa_id=$1 AND estado='pendiente' LIMIT 1),0) as iva_pendiente,
               (SELECT COUNT(*) FROM facturas_electronicas WHERE empresa_id=$1 AND DATE_TRUNC('month',fecha_emision)=DATE_TRUNC('month',CURRENT_DATE)) as fe_mes
             FROM transacciones WHERE empresa_id=$1
             AND DATE_TRUNC('month',fecha)=DATE_TRUNC('month',CURRENT_DATE)`, [eid]),
    ]);

    // Gráfica últimos 6 meses
    const { rows: grafica } = await query(
      `SELECT DATE_TRUNC('month',fecha) as mes,
         SUM(CASE WHEN tipo='ingreso' THEN credito ELSE 0 END) as ingresos,
         SUM(CASE WHEN tipo IN('gasto','costo') THEN debito ELSE 0 END) as gastos
       FROM transacciones WHERE empresa_id=$1
       AND fecha >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY 1 ORDER BY 1`, [eid]
    );

    res.json({
      kpis: kpis.rows[0],
      ingresos: ingresos.rows[0].total,
      gastos: gastos.rows[0].total,
      vencimientos: vencimientos.rows,
      actividad: actividad.rows,
      grafica: grafica,
    });
  } catch (err) { next(err); }
});

// Cargar PUC base
async function cargarPUCBase(client, empresaId) {
  const cuentas = [
    ['1','ACTIVOS','clase','debito',null,1],
    ['11','EFECTIVO Y EQUIVALENTES','grupo','debito','1',2],
    ['1105','Caja','cuenta','debito','11',3],
    ['1110','Bancos','cuenta','debito','11',3],
    ['13','DEUDORES','grupo','debito','1',2],
    ['1305','Clientes','cuenta','debito','13',3],
    ['1325','Cuentas por cobrar socios','cuenta','debito','13',3],
    ['14','INVENTARIOS','grupo','debito','1',2],
    ['1405','Mercancías no fabricadas por la empresa','cuenta','debito','14',3,true],
    ['15','PROPIEDADES PLANTA Y EQUIPO','grupo','debito','1',2],
    ['1516','Construcciones en curso','cuenta','debito','15',3,true],
    ['1520','Maquinaria y equipo','cuenta','debito','15',3,true],
    ['1592','Depreciación acumulada','cuenta','credito','15',3,true],
    ['19','OTROS ACTIVOS','grupo','debito','1',2],
    ['1910','Intangibles','cuenta','debito','19',3,true],
    ['2','PASIVOS','clase','credito',null,1],
    ['22','PROVEEDORES','grupo','credito','2',2],
    ['2205','Proveedores nacionales','cuenta','credito','22',3,true],
    ['23','CUENTAS POR PAGAR','grupo','credito','2',2],
    ['2365','Retención en la fuente','cuenta','credito','23',3,true],
    ['2367','Impuesto a las ventas retenido','cuenta','credito','23',3,true],
    ['2368','IVA por pagar','cuenta','credito','23',3,true],
    ['24','IMPUESTOS, GRAVÁMENES Y TASAS','grupo','credito','2',2],
    ['2408','IVA descontable','cuenta','debito','24',3,true],
    ['25','OBLIGACIONES LABORALES','grupo','credito','2',2],
    ['2505','Salarios por pagar','cuenta','credito','25',3,true],
    ['2510','Cesantías consolidadas','cuenta','credito','25',3,true],
    ['2515','Intereses sobre cesantías','cuenta','credito','25',3,true],
    ['2520','Prima de servicios','cuenta','credito','25',3,true],
    ['2525','Vacaciones consolidadas','cuenta','credito','25',3,true],
    ['26','PASIVOS ESTIMADOS','grupo','credito','2',2],
    ['2610','Anticipos y avances recibidos','cuenta','credito','26',3,true],
    ['3','PATRIMONIO','clase','credito',null,1],
    ['31','CAPITAL SOCIAL','grupo','credito','3',2],
    ['3105','Capital suscrito y pagado','cuenta','credito','31',3,true],
    ['33','RESERVAS','grupo','credito','3',2],
    ['3305','Reserva legal','cuenta','credito','33',3,true],
    ['36','RESULTADOS DEL EJERCICIO','grupo','credito','3',2],
    ['3605','Utilidad del ejercicio','cuenta','credito','36',3,true],
    ['3610','Pérdida del ejercicio','cuenta','debito','36',3,true],
    ['4','INGRESOS','clase','credito',null,1],
    ['41','OPERACIONALES DE VENTAS','grupo','credito','4',2],
    ['4120','Comercio al por mayor y al por menor','cuenta','credito','41',3,true],
    ['4135','Servicios','cuenta','credito','41',3,true],
    ['4155','Arrendamientos','cuenta','credito','41',3,true],
    ['4175','Honorarios','cuenta','credito','41',3,true],
    ['42','NO OPERACIONALES','grupo','credito','4',2],
    ['4210','Financieros','cuenta','credito','42',3,true],
    ['4295','Otros ingresos no operacionales','cuenta','credito','42',3,true],
    ['5','GASTOS OPERACIONALES ADMINISTRACIÓN','clase','debito',null,1],
    ['51','GASTOS OPERACIONALES DE ADMINISTRACIÓN','grupo','debito','5',2],
    ['5105','Gastos de personal','cuenta','debito','51',3,true],
    ['5110','Honorarios','cuenta','debito','51',3,true],
    ['5115','Impuestos','cuenta','debito','51',3,true],
    ['5120','Arrendamientos','cuenta','debito','51',3,true],
    ['5135','Servicios','cuenta','debito','51',3,true],
    ['5140','Gastos legales','cuenta','debito','51',3,true],
    ['5145','Mantenimiento y reparaciones','cuenta','debito','51',3,true],
    ['5195','Diversos','cuenta','debito','51',3,true],
    ['52','GASTOS OPERACIONALES DE VENTAS','grupo','debito','5',2],
    ['5205','Gastos de personal ventas','cuenta','debito','52',3,true],
    ['5245','Seguros','cuenta','debito','52',3,true],
    ['5295','Servicios públicos','cuenta','debito','52',3,true],
    ['53','GASTOS NO OPERACIONALES','grupo','debito','5',2],
    ['5305','Financieros','cuenta','debito','53',3,true],
    ['5310','Pérdida en venta de inversiones','cuenta','debito','53',3,true],
    ['6','COSTOS DE VENTAS','clase','debito',null,1],
    ['61','COSTO DE VENTAS Y DE PRESTACIÓN DE SERVICIOS','grupo','debito','6',2],
    ['6105','Industria manufacturera','cuenta','debito','61',3,true],
    ['6135','Comercio al por mayor y al por menor','cuenta','debito','61',3,true],
    ['6155','Servicios','cuenta','debito','61',3,true],
    ['62','COMPRAS','grupo','debito','6',2],
    ['6205','Compras de mercancías','cuenta','debito','62',3,true],
    ['6225','Devoluciones en compras','cuenta','credito','62',3,true],
  ];

  for (const c of cuentas) {
    await client.query(
      `INSERT INTO puc_cuentas (empresa_id,codigo,nombre,tipo,naturaleza,codigo_padre,nivel,permite_mov)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (empresa_id,codigo) DO NOTHING`,
      [empresaId, c[0], c[1], c[2], c[3], c[4], c[5], c[6] || false]
    ).catch(() => {});
  }
}

export default router;
