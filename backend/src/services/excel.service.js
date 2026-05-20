/**
 * ContaFlow — Servicio de procesamiento Excel
 * Lee archivos .xlsx / .xls / .csv y genera asientos contables automáticos
 * usando IA (Claude) para clasificar cuentas PUC colombianas.
 */

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { query, withTransaction } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { calcularRetefuente, calcularReteICA } from './retenciones.service.js';
import { clasificarCuentaPUC } from './ia.service.js';

/**
 * Parsear archivo Excel / CSV a array de objetos
 */
export const parsearArchivo = (filePath, tipoArchivo) => {
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    dateNF: 'yyyy-mm-dd',
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: '',
    blankrows: false,
  });
  logger.info(`📊 Archivo parseado: ${rows.length} filas (${tipoArchivo})`);
  return rows;
};

/**
 * Detectar y normalizar columnas automáticamente (mapeo IA)
 */
export const detectarColumnas = (rows, modulo) => {
  if (!rows.length) return {};
  const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
  const map = {};

  const buscar = (keywords) => headers.find(h => keywords.some(k => h.includes(k))) || null;

  if (modulo === 'ingresos' || modulo === 'gastos') {
    map.fecha       = buscar(['fecha', 'date', 'dia', 'periodo']);
    map.descripcion = buscar(['descripcion', 'concepto', 'detalle', 'glosa', 'description']);
    map.nit         = buscar(['nit', 'cc', 'identificacion', 'cedula', 'ruc']);
    map.nombre      = buscar(['nombre', 'razon', 'empresa', 'cliente', 'proveedor']);
    map.subtotal    = buscar(['subtotal', 'base', 'valor_sin', 'precio', 'monto', 'value']);
    map.iva         = buscar(['iva', 'impuesto', 'tax', 'gravamen']);
    map.total       = buscar(['total', 'valor_total', 'neto', 'amount']);
    map.cuenta      = buscar(['cuenta', 'puc', 'codigo_cuenta', 'account']);
  }

  if (modulo === 'nomina') {
    map.cedula      = buscar(['cedula', 'cc', 'identificacion', 'documento']);
    map.nombre      = buscar(['nombre', 'empleado', 'trabajador', 'employee']);
    map.cargo       = buscar(['cargo', 'puesto', 'position', 'oficio']);
    map.salario     = buscar(['salario', 'sueldo', 'basico', 'salary', 'remuneracion']);
    map.dias        = buscar(['dias', 'days', 'periodo']);
    map.eps         = buscar(['eps', 'salud', 'health']);
    map.afp         = buscar(['afp', 'pension', 'pensión', 'pension']);
  }

  if (modulo === 'bancario') {
    map.fecha       = buscar(['fecha', 'date']);
    map.descripcion = buscar(['descripcion', 'concepto', 'detalle', 'descripcion_mov']);
    map.debito      = buscar(['debito', 'egreso', 'salida', 'debit', 'cargo']);
    map.credito     = buscar(['credito', 'ingreso', 'entrada', 'credit', 'abono']);
    map.saldo       = buscar(['saldo', 'balance', 'disponible']);
  }

  logger.info(`🔍 Columnas detectadas: ${JSON.stringify(map)}`);
  return map;
};

/**
 * Procesar archivo de INGRESOS
 */
export const procesarIngresos = async (empresaId, filePath, usuarioId, archivoId) => {
  const rows  = parsearArchivo(filePath, 'ingresos');
  const colMap = detectarColumnas(rows, 'ingresos');
  const stats = { total: rows.length, ok: 0, errores: [], transacciones: [] };

  await withTransaction(async (client) => {
    // Obtener período activo
    const { rows: periodo } = await client.query(
      `SELECT id FROM periodos_contables
       WHERE empresa_id = $1 AND estado = 'abierto'
       ORDER BY anio DESC, mes DESC LIMIT 1`,
      [empresaId]
    );
    const periodoId = periodo[0]?.id || null;

    for (const [idx, row] of rows.entries()) {
      try {
        const get = (key) => colMap[key] ? row[Object.keys(row).find(k => k.toLowerCase() === colMap[key])] || '' : '';

        const fecha       = parseFecha(get('fecha')) || new Date().toISOString().split('T')[0];
        const descripcion = get('descripcion') || `Ingreso línea ${idx + 2}`;
        const nit         = limpiarNIT(get('nit'));
        const nombre      = get('nombre') || '';
        const subtotal    = parseMoneda(get('subtotal') || get('total'));
        const ivaRaw      = parseMoneda(get('iva'));
        const total       = parseMoneda(get('total')) || subtotal + ivaRaw;

        if (subtotal <= 0 && total <= 0) {
          stats.errores.push({ fila: idx + 2, error: 'Monto no válido o vacío' });
          continue;
        }

        // Calcular IVA si no viene explícito
        const ivaTarifa = ivaRaw > 0 ? Math.round((ivaRaw / subtotal) * 100) : 0;

        // Clasificar cuenta PUC con IA
        let cuentaPUC = get('cuenta') || '';
        if (!cuentaPUC) {
          cuentaPUC = await clasificarCuentaPUC(descripcion, 'ingreso', empresaId);
        }

        // Insertar transacción
        const { rows: tx } = await client.query(
          `INSERT INTO transacciones
           (empresa_id, periodo_id, tipo, fecha, descripcion, tercero_nit, tercero_nombre,
            cuenta_puc, credito, iva_tarifa, iva_valor, origen, archivo_origen_id, clasificado_ia, created_by)
           VALUES ($1,$2,'ingreso',$3,$4,$5,$6,$7,$8,$9,$10,'excel_upload',$11,true,$12)
           RETURNING id`,
          [empresaId, periodoId, fecha, descripcion, nit, nombre,
           cuentaPUC, subtotal, ivaTarifa, ivaRaw, archivoId, usuarioId]
        );

        stats.ok++;
        stats.transacciones.push(tx[0].id);
      } catch (rowErr) {
        stats.errores.push({ fila: idx + 2, error: rowErr.message });
        logger.warn(`⚠️ Fila ${idx + 2} con error: ${rowErr.message}`);
      }
    }

    // Actualizar estado del archivo
    await client.query(
      `UPDATE archivos_cargados SET
         filas_procesadas=$1, filas_ok=$2, filas_error=$3, estado=$4, errores=$5
       WHERE id=$6`,
      [stats.total, stats.ok, stats.errores.length,
       stats.errores.length === 0 ? 'completado' : 'completado_con_errores',
       JSON.stringify(stats.errores), archivoId]
    );
  });

  logger.info(`✅ Ingresos procesados: ${stats.ok}/${stats.total}`);
  return stats;
};

/**
 * Procesar archivo de GASTOS
 */
export const procesarGastos = async (empresaId, filePath, usuarioId, archivoId) => {
  const rows   = parsearArchivo(filePath, 'gastos');
  const colMap = detectarColumnas(rows, 'gastos');
  const stats  = { total: rows.length, ok: 0, errores: [], transacciones: [] };

  await withTransaction(async (client) => {
    const { rows: periodo } = await client.query(
      `SELECT id FROM periodos_contables WHERE empresa_id=$1 AND estado='abierto' ORDER BY anio DESC,mes DESC LIMIT 1`,
      [empresaId]
    );
    const periodoId = periodo[0]?.id || null;

    for (const [idx, row] of rows.entries()) {
      try {
        const get = (key) => colMap[key] ? row[Object.keys(row).find(k => k.toLowerCase() === colMap[key])] || '' : '';
        const fecha       = parseFecha(get('fecha')) || new Date().toISOString().split('T')[0];
        const descripcion = get('descripcion') || `Gasto línea ${idx + 2}`;
        const nit         = limpiarNIT(get('nit'));
        const nombre      = get('nombre') || '';
        const subtotal    = parseMoneda(get('subtotal') || get('total'));
        const ivaRaw      = parseMoneda(get('iva'));
        const ivaTarifa   = ivaRaw > 0 && subtotal > 0 ? Math.round((ivaRaw / subtotal) * 100) : 0;

        if (subtotal <= 0) {
          stats.errores.push({ fila: idx + 2, error: 'Monto no válido' });
          continue;
        }

        // Calcular retenciones automáticamente
        const { tarifa: rteTarifa, valor: rteValor } = calcularRetefuente(descripcion, subtotal, nombre, nit);
        const { tarifa: ricaTarifa, valor: ricaValor } = calcularReteICA(subtotal);

        // Clasificar cuenta PUC
        let cuentaPUC = get('cuenta') || '';
        if (!cuentaPUC) {
          cuentaPUC = await clasificarCuentaPUC(descripcion, 'gasto', empresaId);
        }

        await client.query(
          `INSERT INTO transacciones
           (empresa_id,periodo_id,tipo,fecha,descripcion,tercero_nit,tercero_nombre,
            cuenta_puc,debito,iva_tarifa,iva_valor,retefuente_tarifa,retefuente_valor,
            reteica_tarifa,reteica_valor,origen,archivo_origen_id,clasificado_ia,created_by)
           VALUES ($1,$2,'gasto',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'excel_upload',$15,true,$16)`,
          [empresaId, periodoId, fecha, descripcion, nit, nombre,
           cuentaPUC, subtotal, ivaTarifa, ivaRaw, rteTarifa, rteValor,
           ricaTarifa, ricaValor, archivoId, usuarioId]
        );
        stats.ok++;
      } catch (rowErr) {
        stats.errores.push({ fila: idx + 2, error: rowErr.message });
      }
    }
    await client.query(
      `UPDATE archivos_cargados SET filas_procesadas=$1,filas_ok=$2,filas_error=$3,estado=$4,errores=$5 WHERE id=$6`,
      [stats.total, stats.ok, stats.errores.length,
       stats.errores.length === 0 ? 'completado' : 'completado_con_errores',
       JSON.stringify(stats.errores), archivoId]
    );
  });
  return stats;
};

/**
 * Procesar NÓMINA
 */
export const procesarNomina = async (empresaId, filePath, usuarioId, archivoId, mes, anio) => {
  const rows   = parsearArchivo(filePath, 'nomina');
  const colMap = detectarColumnas(rows, 'nomina');
  const stats  = { total: rows.length, ok: 0, errores: [], empleados: [] };
  const SMMLV  = 1300000; // 2025

  await withTransaction(async (client) => {
    // Crear período de nómina
    const { rows: np } = await client.query(
      `INSERT INTO nomina_periodos (empresa_id, mes, anio)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
      [empresaId, mes, anio]
    );
    let nominaPeriodoId = np[0]?.id;
    if (!nominaPeriodoId) {
      const { rows: ex } = await client.query(
        'SELECT id FROM nomina_periodos WHERE empresa_id=$1 AND mes=$2 AND anio=$3',
        [empresaId, mes, anio]
      );
      nominaPeriodoId = ex[0].id;
    }

    let totales = { salarios: 0, salud: 0, pension: 0, arl: 0, parafiscales: 0,
                    prima: 0, cesantias: 0, vacaciones: 0, retefuente: 0, neto: 0, costo: 0 };

    for (const [idx, row] of rows.entries()) {
      try {
        const get = (key) => colMap[key] ? row[Object.keys(row).find(k => k.toLowerCase() === colMap[key])] || '' : '';
        const cedula  = String(get('cedula')).replace(/\D/g, '');
        const nombre  = get('nombre') || `Empleado ${idx + 2}`;
        const cargo   = get('cargo') || '';
        const salario = parseMoneda(get('salario')) || SMMLV;
        const dias    = parseInt(get('dias')) || 30;

        // Cálculos automáticos según ley colombiana
        const salarioBase   = (salario / 30) * dias;
        const saludEmp      = Math.round(salarioBase * 0.04);     // 4% empleado
        const pensionEmp    = Math.round(salarioBase * 0.04);     // 4% empleado
        const saludPat      = Math.round(salarioBase * 0.085);    // 8.5% patronal
        const pensionPat    = Math.round(salarioBase * 0.12);     // 12% patronal
        const arl           = Math.round(salarioBase * 0.00522);  // Nivel riesgo 1
        const sena          = Math.round(salarioBase * 0.02);     // 2%
        const icbf          = Math.round(salarioBase * 0.03);     // 3%
        const ccf           = Math.round(salarioBase * 0.04);     // 4%
        const primaProv     = Math.round(salarioBase / 12);       // 1/12
        const cesantiasProv = Math.round(salarioBase / 12);       // 1/12
        const vacasProv     = Math.round(salarioBase / 24);       // 15 días / año

        // ReteFuente (simplificada - tabla Art. 383 E.T.)
        const baseRte    = salarioBase - saludEmp - pensionEmp;
        const uvt        = 47065; // UVT 2025
        const baseUVT    = baseRte / uvt;
        let retefuente   = 0;
        if (baseUVT > 128.96) retefuente = Math.round(baseRte * 0.19 - 9614000);
        else if (baseUVT > 87.03) retefuente = Math.round(baseRte * 0.15 - 5905000);
        else if (baseUVT > 38.90) retefuente = Math.round(baseRte * 0.10 - 1507000);
        retefuente = Math.max(0, retefuente);

        const totalDed  = saludEmp + pensionEmp + retefuente;
        const netoPagar = salarioBase - totalDed;
        const costoTotal = salarioBase + saludPat + pensionPat + arl + sena + icbf + ccf + primaProv + cesantiasProv + vacasProv;

        await client.query(
          `INSERT INTO nomina_empleados
           (empresa_id,nomina_periodo_id,cedula,nombre,cargo,salario_basico,dias_trabajados,
            total_devengado,salud_empleado,pension_empleado,retefuente,total_deducciones,neto_pagar,
            salud_patronal,pension_patronal,arl,sena,icbf,ccf,prima_prov,cesantias_prov,vacaciones_prov)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
          [empresaId, nominaPeriodoId, cedula, nombre, cargo, salario, dias,
           salarioBase, saludEmp, pensionEmp, retefuente, totalDed, netoPagar,
           saludPat, pensionPat, arl, sena, icbf, ccf, primaProv, cesantiasProv, vacasProv]
        );

        // Acumular totales
        totales.salarios    += salarioBase;
        totales.salud       += saludPat;
        totales.pension     += pensionPat;
        totales.arl         += arl;
        totales.parafiscales += sena + icbf + ccf;
        totales.prima       += primaProv;
        totales.cesantias   += cesantiasProv;
        totales.vacaciones  += vacasProv;
        totales.retefuente  += retefuente;
        totales.neto        += netoPagar;
        totales.costo       += costoTotal;
        stats.ok++;
      } catch (rowErr) {
        stats.errores.push({ fila: idx + 2, error: rowErr.message });
      }
    }

    // Actualizar totales del período
    await client.query(
      `UPDATE nomina_periodos SET
         total_empleados=$1,total_salarios=$2,total_salud=$3,total_pension=$4,total_arl=$5,
         total_parafiscales=$6,total_prima=$7,total_cesantias=$8,total_vacaciones=$9,
         total_retefuente=$10,total_neto=$11,costo_total=$12,estado='calculado'
       WHERE id=$13`,
      [stats.ok, totales.salarios, totales.salud, totales.pension, totales.arl,
       totales.parafiscales, totales.prima, totales.cesantias, totales.vacaciones,
       totales.retefuente, totales.neto, totales.costo, nominaPeriodoId]
    );

    await client.query(
      `UPDATE archivos_cargados SET filas_procesadas=$1,filas_ok=$2,filas_error=$3,estado='completado' WHERE id=$4`,
      [stats.total, stats.ok, stats.errores.length, archivoId]
    );
    stats.nominaPeriodoId = nominaPeriodoId;
    stats.totales = totales;
  });
  return stats;
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

export const parseMoneda = (val) => {
  if (!val && val !== 0) return 0;
  const str = String(val).replace(/[$\s.]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
};

export const parseFecha = (val) => {
  if (!val) return null;
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return val;
  // DD/MM/YYYY
  const dm = String(val).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dm) return `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
  // Fecha JS
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return null;
};

export const limpiarNIT = (nit) => {
  if (!nit) return null;
  return String(nit).replace(/[^\d\-]/g, '').slice(0, 15) || null;
};
