/**
 * ContaFlow — iva.routes.js
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { query, withTransaction } from '../config/database.js';

export const ivaRouter = Router();
ivaRouter.use(authenticate);

// Bimestres IVA del año
const BIMESTRES = [
  { b:1, inicio:'01-01', fin:'02-28', vence:'03-15', nombre:'Enero–Febrero' },
  { b:2, inicio:'03-01', fin:'04-30', vence:'05-15', nombre:'Marzo–Abril' },
  { b:3, inicio:'05-01', fin:'06-30', vence:'07-15', nombre:'Mayo–Junio' },
  { b:4, inicio:'07-01', fin:'08-31', vence:'09-15', nombre:'Julio–Agosto' },
  { b:5, inicio:'09-01', fin:'10-31', vence:'11-14', nombre:'Septiembre–Octubre' },
  { b:6, inicio:'11-01', fin:'12-31', vence:'+01-15', nombre:'Noviembre–Diciembre' },
];

// GET /iva/periodos
ivaRouter.get('/periodos', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT * FROM iva_periodos WHERE empresa_id=$1 ORDER BY anio DESC, bimestre DESC`, [eid]
    );
    res.json({ periodos: rows });
  } catch (err) { next(err); }
});

// POST /iva/calcular/:bimestre/:anio — calcular IVA del bimestre
ivaRouter.post('/calcular/:bimestre/:anio', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const bimestre = parseInt(req.params.bimestre);
    const anio     = parseInt(req.params.anio);
    const bim      = BIMESTRES.find(b => b.b === bimestre);
    if (!bim) return res.status(400).json({ error: 'Bimestre inválido (1-6)' });

    const fechaInicio = `${anio}-${bim.inicio}`;
    const fechaFin    = `${anio}-${bim.fin}`;

    // IVA generado (ventas)
    const { rows: gen } = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN iva_tarifa=5  THEN iva_valor ELSE 0 END),0) as iva5,
         COALESCE(SUM(CASE WHEN iva_tarifa=19 THEN iva_valor ELSE 0 END),0) as iva19,
         COALESCE(SUM(CASE WHEN iva_tarifa=5  THEN credito   ELSE 0 END),0) as base5,
         COALESCE(SUM(CASE WHEN iva_tarifa=19 THEN credito   ELSE 0 END),0) as base19,
         COALESCE(SUM(CASE WHEN iva_tarifa=0  THEN credito   ELSE 0 END),0) as base0,
         COALESCE(SUM(CASE WHEN iva_tarifa IS NULL THEN credito ELSE 0 END),0) as excluido
       FROM transacciones
       WHERE empresa_id=$1 AND tipo='ingreso' AND fecha BETWEEN $2 AND $3`,
      [eid, fechaInicio, fechaFin]
    );

    // IVA descontable (compras)
    const { rows: desc } = await query(
      `SELECT COALESCE(SUM(iva_valor),0) as iva_descontable
       FROM transacciones WHERE empresa_id=$1 AND tipo IN ('gasto','costo') AND fecha BETWEEN $2 AND $3`,
      [eid, fechaInicio, fechaFin]
    );

    const ivaGenerado  = parseFloat(gen[0].iva5) + parseFloat(gen[0].iva19);
    const ivaDescontable = parseFloat(desc[0].iva_descontable);
    const ivaPagar = Math.max(0, ivaGenerado - ivaDescontable);
    const saldoFavor = Math.max(0, ivaDescontable - ivaGenerado);

    const fechaVenceBase = bim.vence.startsWith('+')
      ? `${anio+1}-${bim.vence.slice(1)}`
      : `${anio}-${bim.vence}`;

    await query(
      `INSERT INTO iva_periodos
       (empresa_id,bimestre,anio,fecha_inicio,fecha_fin,fecha_vencimiento,
        base_0,base_5,base_19,iva_generado_5,iva_generado_19,iva_descontable,iva_pagar,saldo_favor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (empresa_id,bimestre,anio) DO UPDATE SET
       base_0=$7,base_5=$8,base_19=$9,iva_generado_5=$10,iva_generado_19=$11,
       iva_descontable=$12,iva_pagar=$13,saldo_favor=$14`,
      [eid,bimestre,anio,fechaInicio,fechaFin,fechaVenceBase,
       gen[0].base0, gen[0].base5, gen[0].base19,
       gen[0].iva5, gen[0].iva19, ivaDescontable, ivaPagar, saldoFavor]
    );

    res.json({
      bimestre, anio, nombre: bim.nombre,
      base_0: parseFloat(gen[0].base0), base_5: parseFloat(gen[0].base5),
      base_19: parseFloat(gen[0].base19), excluido: parseFloat(gen[0].excluido),
      iva_generado_5: parseFloat(gen[0].iva5), iva_generado_19: parseFloat(gen[0].iva19),
      iva_generado_total: ivaGenerado, iva_descontable: ivaDescontable,
      iva_pagar: ivaPagar, saldo_favor: saldoFavor,
      fecha_vencimiento: fechaVenceBase,
    });
  } catch (err) { next(err); }
});

// GET /iva/retenciones/:mes/:anio
ivaRouter.get('/retenciones/:mes/:anio', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT tipo, concepto, articulo_et, tarifa,
         SUM(base) as base_total, SUM(valor) as valor_total, COUNT(*) as operaciones
       FROM retenciones WHERE empresa_id=$1 AND mes=$2 AND anio=$3
       GROUP BY tipo, concepto, articulo_et, tarifa ORDER BY tipo, valor_total DESC`,
      [eid, req.params.mes, req.params.anio]
    );
    const { rows: [totales] } = await query(
      `SELECT
         SUM(CASE WHEN tipo='retefuente' THEN valor ELSE 0 END) as retefuente,
         SUM(CASE WHEN tipo='reteiva'    THEN valor ELSE 0 END) as reteiva,
         SUM(CASE WHEN tipo='reteica'    THEN valor ELSE 0 END) as reteica,
         SUM(valor) as total
       FROM retenciones WHERE empresa_id=$1 AND mes=$2 AND anio=$3`,
      [eid, req.params.mes, req.params.anio]
    );
    res.json({ detalle: rows, totales });
  } catch (err) { next(err); }
});

/**
 * ContaFlow — nomina.routes.js
 */
export const nominaRouter = Router();
nominaRouter.use(authenticate);

// GET /nomina/periodos
nominaRouter.get('/periodos', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT * FROM nomina_periodos WHERE empresa_id=$1 ORDER BY anio DESC, mes DESC`, [eid]
    );
    res.json({ periodos: rows });
  } catch (err) { next(err); }
});

// GET /nomina/periodos/:id/empleados
nominaRouter.get('/periodos/:id/empleados', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM nomina_empleados WHERE nomina_periodo_id=$1 ORDER BY nombre`, [req.params.id]
    );
    res.json({ empleados: rows });
  } catch (err) { next(err); }
});

// GET /nomina/periodos/:id/resumen
nominaRouter.get('/periodos/:id/resumen', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT np.*,
         (SELECT COUNT(*) FROM nomina_empleados WHERE nomina_periodo_id=np.id) as empleados
       FROM nomina_periodos np WHERE np.id=$1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Período no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /nomina/periodos/:id/generar-pila — generar archivo PILA
nominaRouter.post('/periodos/:id/generar-pila', async (req, res, next) => {
  try {
    const { rows: empleados } = await query(
      `SELECT ne.*, np.mes, np.anio, np.empresa_id,
              e.nit as empresa_nit, e.razon_social
       FROM nomina_empleados ne
       JOIN nomina_periodos np ON np.id = ne.nomina_periodo_id
       JOIN empresas e ON e.id = np.empresa_id
       WHERE ne.nomina_periodo_id=$1`, [req.params.id]
    );
    if (!empleados.length) return res.status(404).json({ error: 'Sin empleados en este período' });

    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Tipo_Cotizante','Subtipo','TipoDocumento','Documento','PrimerApellido','SegundoApellido',
       'PrimerNombre','SegundoNombre','Dias_Cotizados','Salario','IBC_Salud','IBC_Pension',
       'Aporte_Salud_Empleado','Aporte_Pension_Empleado','Aporte_Salud_Patronal',
       'Aporte_Pension_Patronal','ARL','CCF','SENA','ICBF'],
      ...empleados.map(e => {
        const nombres = e.nombre.split(' ');
        return [
          '01', '00', 'CC', e.cedula,
          nombres[1] || '', nombres[2] || '',
          nombres[0] || '', nombres[3] || '',
          e.dias_trabajados, e.salario_basico,
          Math.round(e.salario_basico * e.dias_trabajados / 30),
          Math.round(e.salario_basico * e.dias_trabajados / 30),
          e.salud_empleado, e.pension_empleado,
          e.salud_patronal, e.pension_patronal,
          e.arl, e.ccf, e.sena, e.icbf,
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'PILA');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    await query(`UPDATE nomina_periodos SET pila_generado=true WHERE id=$1`, [req.params.id]);
    res.setHeader('Content-Disposition', `attachment; filename=pila_${empleados[0].mes}_${empleados[0].anio}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
});

/**
 * ContaFlow — contabilidad.routes.js
 */
export const contabilidadRouter = Router();
contabilidadRouter.use(authenticate);

// GET /contabilidad/transacciones
contabilidadRouter.get('/transacciones', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { tipo, desde, hasta, cuenta, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE empresa_id=$1'; const params = [eid];
    let i = 2;
    if (tipo)   { params.push(tipo);  where += ` AND tipo=$${i++}`; }
    if (desde)  { params.push(desde); where += ` AND fecha>=$${i++}`; }
    if (hasta)  { params.push(hasta); where += ` AND fecha<=$${i++}`; }
    if (cuenta) { params.push(cuenta); where += ` AND cuenta_puc LIKE $${i++}`; }
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT * FROM transacciones ${where} ORDER BY fecha DESC, created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`, params
    );
    const { rows: [cnt] } = await query(
      `SELECT COUNT(*) as total FROM transacciones ${where}`, params.slice(0,-2)
    );
    res.json({ transacciones: rows, total: parseInt(cnt.total) });
  } catch (err) { next(err); }
});

// POST /contabilidad/transacciones — crear transacción manual
contabilidadRouter.post('/transacciones', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { tipo, fecha, descripcion, tercero_nit, tercero_nombre,
            cuenta_puc, debito, credito, iva_tarifa, iva_valor,
            retefuente_tarifa, retefuente_valor, notas } = req.body;
    if (!tipo || !fecha || !descripcion) {
      return res.status(400).json({ error: 'tipo, fecha y descripción son requeridos' });
    }
    const { rows } = await query(
      `INSERT INTO transacciones
       (empresa_id,tipo,fecha,descripcion,tercero_nit,tercero_nombre,cuenta_puc,
        debito,credito,iva_tarifa,iva_valor,retefuente_tarifa,retefuente_valor,notas,
        origen,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual',$15)
       RETURNING *`,
      [eid,tipo,fecha,descripcion,tercero_nit,tercero_nombre,cuenta_puc,
       debito||0,credito||0,iva_tarifa||0,iva_valor||0,
       retefuente_tarifa||0,retefuente_valor||0,notas,req.user.id]
    );
    res.status(201).json({ transaccion: rows[0] });
  } catch (err) { next(err); }
});

// GET /contabilidad/puc — plan de cuentas
contabilidadRouter.get('/puc', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT * FROM puc_cuentas WHERE empresa_id=$1 ORDER BY codigo`, [eid]
    );
    res.json({ cuentas: rows });
  } catch (err) { next(err); }
});

// GET /contabilidad/libro-mayor/:cuenta — auxiliar de una cuenta
contabilidadRouter.get('/libro-mayor/:cuenta', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { desde, hasta } = req.query;
    let where = 'WHERE empresa_id=$1 AND cuenta_puc LIKE $2';
    const params = [eid, `${req.params.cuenta}%`];
    if (desde) { params.push(desde); where += ` AND fecha>=$${params.length}`; }
    if (hasta) { params.push(hasta); where += ` AND fecha<=$${params.length}`; }
    const { rows } = await query(
      `SELECT *, SUM(debito - credito) OVER (ORDER BY fecha, created_at) as saldo_acumulado
       FROM transacciones ${where} ORDER BY fecha, created_at`, params
    );
    const { rows: [totales] } = await query(
      `SELECT SUM(debito) as total_debito, SUM(credito) as total_credito,
              SUM(debito-credito) as saldo
       FROM transacciones ${where}`, params
    );
    res.json({ movimientos: rows, totales });
  } catch (err) { next(err); }
});

// GET /contabilidad/periodos
contabilidadRouter.get('/periodos', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM periodos_contables WHERE empresa_id=$1 ORDER BY anio DESC, mes DESC`,
      [req.headers['x-empresa-id']]
    );
    res.json({ periodos: rows });
  } catch (err) { next(err); }
});

/**
 * ContaFlow — reportes.routes.js
 */
export const reportesRouter = Router();
reportesRouter.use(authenticate);

// GET /reportes/balance — balance general
reportesRouter.get('/balance', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { fecha } = req.query;
    const corte = fecha || new Date().toISOString().split('T')[0];

    const { rows } = await query(
      `SELECT
         p.codigo, p.nombre, p.tipo, p.naturaleza, p.nivel, p.codigo_padre,
         COALESCE(SUM(t.debito),0) as total_debito,
         COALESCE(SUM(t.credito),0) as total_credito,
         COALESCE(
           CASE p.naturaleza
             WHEN 'debito'  THEN SUM(t.debito) - SUM(t.credito)
             WHEN 'credito' THEN SUM(t.credito) - SUM(t.debito)
           END
         ,0) as saldo
       FROM puc_cuentas p
       LEFT JOIN transacciones t ON t.cuenta_puc LIKE p.codigo||'%'
         AND t.empresa_id=$1 AND t.fecha<=$2
       WHERE p.empresa_id=$1
       GROUP BY p.codigo, p.nombre, p.tipo, p.naturaleza, p.nivel, p.codigo_padre
       ORDER BY p.codigo`,
      [eid, corte]
    );

    // Estructurar en árbol
    const totalActivos  = rows.filter(r => r.codigo.startsWith('1')).reduce((a, r) => a + parseFloat(r.saldo), 0);
    const totalPasivos  = rows.filter(r => r.codigo.startsWith('2')).reduce((a, r) => a + parseFloat(r.saldo), 0);
    const totalPatrim   = rows.filter(r => r.codigo.startsWith('3')).reduce((a, r) => a + parseFloat(r.saldo), 0);

    res.json({
      fecha_corte: corte,
      cuentas: rows,
      totales: {
        activos: totalActivos,
        pasivos: totalPasivos,
        patrimonio: totalPatrim,
        pasivos_patrimonio: totalPasivos + totalPatrim,
        cuadra: Math.abs(totalActivos - (totalPasivos + totalPatrim)) < 1,
      },
    });
  } catch (err) { next(err); }
});

// GET /reportes/pyg — estado de resultados
reportesRouter.get('/pyg', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { desde, hasta } = req.query;
    const fechaDesde = desde || `${new Date().getFullYear()}-01-01`;
    const fechaHasta = hasta || new Date().toISOString().split('T')[0];

    const { rows: [r] } = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='ingreso' THEN credito ELSE 0 END),0) as ingresos,
         COALESCE(SUM(CASE WHEN tipo='costo'   THEN debito  ELSE 0 END),0) as costos,
         COALESCE(SUM(CASE WHEN tipo='gasto' AND cuenta_puc LIKE '51%' THEN debito ELSE 0 END),0) as gastos_admon,
         COALESCE(SUM(CASE WHEN tipo='gasto' AND cuenta_puc LIKE '52%' THEN debito ELSE 0 END),0) as gastos_ventas,
         COALESCE(SUM(CASE WHEN tipo='gasto' AND cuenta_puc LIKE '53%' THEN debito ELSE 0 END),0) as gastos_financ,
         COALESCE(SUM(CASE WHEN tipo='nomina' THEN debito ELSE 0 END),0) as nomina
       FROM transacciones WHERE empresa_id=$1 AND fecha BETWEEN $2 AND $3`,
      [eid, fechaDesde, fechaHasta]
    );

    const utilBruta = r.ingresos - r.costos;
    const utilOper  = utilBruta - r.gastos_admon - r.gastos_ventas - r.nomina;
    const utilAimp  = utilOper - r.gastos_financ;
    const impRenta  = Math.max(0, utilAimp * 0.35);
    const utilNeta  = utilAimp - impRenta;

    res.json({
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      ingresos: parseFloat(r.ingresos),
      costos: parseFloat(r.costos),
      utilidad_bruta: utilBruta,
      gastos_admon: parseFloat(r.gastos_admon),
      gastos_ventas: parseFloat(r.gastos_ventas),
      nomina: parseFloat(r.nomina),
      utilidad_operacional: utilOper,
      gastos_financieros: parseFloat(r.gastos_financ),
      utilidad_antes_impuestos: utilAimp,
      impuesto_renta: impRenta,
      utilidad_neta: utilNeta,
      indicadores: {
        margen_bruto: r.ingresos > 0 ? (utilBruta / r.ingresos * 100).toFixed(1) : 0,
        margen_operacional: r.ingresos > 0 ? (utilOper / r.ingresos * 100).toFixed(1) : 0,
        margen_neto: r.ingresos > 0 ? (utilNeta / r.ingresos * 100).toFixed(1) : 0,
      },
    });
  } catch (err) { next(err); }
});

// GET /reportes/flujo-caja — flujo de caja del período
reportesRouter.get('/flujo-caja', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { rows } = await query(
      `SELECT DATE_TRUNC('month',fecha) as mes,
         SUM(CASE WHEN tipo='ingreso' THEN credito ELSE 0 END) as entradas,
         SUM(CASE WHEN tipo IN ('gasto','costo','nomina') THEN debito ELSE 0 END) as salidas
       FROM transacciones WHERE empresa_id=$1 AND fecha >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY 1 ORDER BY 1`, [eid]
    );
    res.json({ flujo: rows });
  } catch (err) { next(err); }
});

// GET /reportes/exportar/:tipo — exportar a Excel
reportesRouter.get('/exportar/:tipo', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    const { tipo } = req.params;
    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.utils.book_new();

    if (tipo === 'transacciones') {
      const { rows } = await query(
        `SELECT fecha,tipo,descripcion,tercero_nombre,cuenta_puc,debito,credito,
                iva_tarifa,iva_valor,retefuente_valor,estado
         FROM transacciones WHERE empresa_id=$1 ORDER BY fecha DESC LIMIT 5000`, [eid]
      );
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Transacciones');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=contaflow_${tipo}_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { next(err); }
});

/**
 * ContaFlow — ia.routes.js
 */
export const iaRouter = Router();
iaRouter.use(authenticate);

// POST /ia/chat — chat con el asistente contable
iaRouter.post('/chat', async (req, res, next) => {
  try {
    const { mensaje, historialId } = req.body;
    const eid = req.headers['x-empresa-id'];
    if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje requerido' });

    // Obtener historial reciente
    const { rows: historial } = await query(
      `SELECT rol, contenido FROM chat_ia
       WHERE empresa_id=$1 AND usuario_id=$2
       ORDER BY created_at DESC LIMIT 10`,
      [eid, req.user.id]
    );

    const { chatContable } = await import('../services/ia.service.js');
    const { respuesta, tokensUsed } = await chatContable(
      mensaje, historial.reverse(), eid, req.user.id
    );
    res.json({ respuesta, tokensUsed });
  } catch (err) { next(err); }
});

// GET /ia/historial
iaRouter.get('/historial', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT rol, contenido, created_at FROM chat_ia
       WHERE empresa_id=$1 AND usuario_id=$2
       ORDER BY created_at ASC LIMIT 50`,
      [req.headers['x-empresa-id'], req.user.id]
    );
    res.json({ historial: rows });
  } catch (err) { next(err); }
});

// POST /ia/clasificar-cuenta — clasificar cuenta PUC
iaRouter.post('/clasificar-cuenta', async (req, res, next) => {
  try {
    const { descripcion, tipo } = req.body;
    if (!descripcion) return res.status(400).json({ error: 'Descripción requerida' });
    const { clasificarCuentaPUC } = await import('../services/ia.service.js');
    const cuenta = await clasificarCuentaPUC(descripcion, tipo || 'gasto', req.headers['x-empresa-id']);
    res.json({ cuenta, descripcion });
  } catch (err) { next(err); }
});

// POST /ia/analizar — analizar empresa y generar alertas
iaRouter.post('/analizar', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    if (!eid) return res.status(400).json({ error: 'Empresa requerida' });
    const { analizarIndicadores } = await import('../services/ia.service.js');
    const resultado = await analizarIndicadores(eid);
    res.json(resultado);
  } catch (err) { next(err); }
});


// GET /reportes/exportar/:tipo — exportar reporte en Excel
reportesRouter.get('/exportar/:tipo', async (req, res, next) => {
  try {
    const eid = req.headers['x-empresa-id'];
    if (!eid) return res.status(400).json({ error: 'Empresa requerida' });
    const { tipo } = req.params;
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.default.Workbook();
    const ws = wb.addWorksheet(tipo.toUpperCase());
    ws.columns = [
      { header: 'Concepto', key: 'concepto', width: 40 },
      { header: 'Valor', key: 'valor', width: 20 },
    ];
    if (tipo === 'balance') {
      const { rows } = await query(`SELECT descripcion as concepto, debito - credito as valor FROM transacciones WHERE empresa_id=$1`, [eid]);
      rows.forEach(r => ws.addRow(r));
    } else if (tipo === 'pyg') {
      const { rows } = await query(`SELECT tipo as concepto, SUM(debito - credito) as valor FROM transacciones WHERE empresa_id=$1 GROUP BY tipo`, [eid]);
      rows.forEach(r => ws.addRow(r));
    } else {
      ws.addRow({ concepto: 'Sin datos', valor: 0 });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=contaflow_${tipo}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});