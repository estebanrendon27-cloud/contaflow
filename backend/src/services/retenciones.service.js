/**
 * ContaFlow — Cálculo de retenciones colombianas
 * Según E.T. actualizado 2025
 */

const UVT_2025 = 47065;

/**
 * Retención en la fuente por concepto (Art. 392, 401, 439 E.T.)
 */
const CONCEPTOS_RETEFUENTE = [
  { keywords: ['honor', 'consul', 'asesori', 'auditor'], tarifa: 11, articulo: 'Art. 392' },
  { keywords: ['servic', 'manten', 'limpiez', 'seguridad', 'vigilanc'], tarifa: 4, articulo: 'Art. 392' },
  { keywords: ['arrend', 'alquiler', 'canon'], tarifa: 3.5, articulo: 'Art. 401' },
  { keywords: ['transport', 'flete', 'carga'], tarifa: 3.5, articulo: 'Art. 401' },
  { keywords: ['material', 'insumo', 'materia', 'cemento', 'herram', 'compra'], tarifa: 3.5, articulo: 'Art. 401' },
  { keywords: ['construc', 'obra', 'contrat'], tarifa: 2, articulo: 'Art. 439' },
  { keywords: ['software', 'licencia', 'tecnolog'], tarifa: 3.5, articulo: 'Art. 392' },
  { keywords: ['publicid', 'mercad', 'pauta'], tarifa: 3.5, articulo: 'Art. 392' },
  { keywords: ['interés', 'rendimient', 'financier'], tarifa: 7, articulo: 'Art. 395' },
];

/**
 * Calcular ReteFuente sobre una transacción
 */
export const calcularRetefuente = (descripcion, monto, nombreTercero, nitTercero) => {
  const BASE_MINIMA_SERVICIOS = UVT_2025 * 4;   // 4 UVT ~188.260
  const BASE_MINIMA_COMPRAS   = UVT_2025 * 27;  // 27 UVT ~1.270.755

  const desc = descripcion.toLowerCase();

  for (const concepto of CONCEPTOS_RETEFUENTE) {
    if (concepto.keywords.some(k => desc.includes(k))) {
      const baseMin = concepto.keywords.some(k => ['material','insumo','compra','cemento','herram'].includes(k))
        ? BASE_MINIMA_COMPRAS
        : BASE_MINIMA_SERVICIOS;

      if (monto < baseMin) return { tarifa: 0, valor: 0, concepto: 'Bajo base mínima' };

      const valor = Math.round(monto * (concepto.tarifa / 100));
      return {
        tarifa: concepto.tarifa,
        valor,
        concepto: concepto.articulo,
        descripcionConcepto: concepto.keywords[0],
      };
    }
  }

  return { tarifa: 0, valor: 0, concepto: 'Sin retención' };
};

/**
 * Calcular ReteICA según municipio
 * Tarifas más comunes (por mil)
 */
export const calcularReteICA = (monto, municipio = 'Medellin', actividad = 'servicios') => {
  const tarifas = {
    'Bogota':   { servicios: 9.66, comercio: 11.04, industrial: 9.66 },
    'Medellin': { servicios: 4.14, comercio: 4.14, industrial: 4.14 },
    'Cali':     { servicios: 8.0,  comercio: 8.0,  industrial: 6.0  },
    'default':  { servicios: 6.9,  comercio: 9.66, industrial: 4.14 },
  };

  const ciudad = Object.keys(tarifas).find(k => municipio.toLowerCase().includes(k.toLowerCase())) || 'default';
  const tarifa = tarifas[ciudad][actividad] || tarifas[ciudad].servicios;
  const valor  = Math.round(monto * (tarifa / 1000));

  return { tarifa, valor, municipio: ciudad };
};

/**
 * Calcular ReteIVA (15% del IVA)
 */
export const calcularReteIVA = (valorIVA) => {
  return {
    tarifa: 15,
    valor: Math.round(valorIVA * 0.15),
  };
};

/**
 * Resumen de retenciones del mes para formulario 350
 */
export const resumenRetencionsMes = async (empresaId, mes, anio) => {
  const { query } = await import('../config/database.js');
  const { rows } = await query(
    `SELECT
       SUM(CASE WHEN concepto ILIKE '%392%' AND descripcion ILIKE '%honor%' THEN valor ELSE 0 END) as honorarios,
       SUM(CASE WHEN concepto ILIKE '%392%' AND descripcion NOT ILIKE '%honor%' THEN valor ELSE 0 END) as servicios,
       SUM(CASE WHEN concepto ILIKE '%401%' AND descripcion ILIKE '%arrend%' THEN valor ELSE 0 END) as arrendamientos,
       SUM(CASE WHEN concepto ILIKE '%401%' AND descripcion NOT ILIKE '%arrend%' THEN valor ELSE 0 END) as compras,
       SUM(CASE WHEN concepto ILIKE '%439%' THEN valor ELSE 0 END) as construccion,
       SUM(valor) as total
     FROM retenciones
     WHERE empresa_id=$1 AND mes=$2 AND anio=$3 AND tipo='retefuente'`,
    [empresaId, mes, anio]
  );
  return rows[0] || {};
};
