/**
 * ContaFlow — utils/format.js
 * Formateadores reutilizables en toda la app
 */

export const fmt = {
  // Pesos colombianos completo: $1.234.567
  cop: (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(num);
  },

  // Millones abreviado: $148.3M
  copM: (val) => {
    const num = parseFloat(val) || 0;
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(0)}k`;
    return fmt.cop(num);
  },

  // Número con separador de miles
  num: (val) => new Intl.NumberFormat('es-CO').format(parseFloat(val) || 0),

  // Porcentaje
  pct: (val, decimals = 1) => `${(parseFloat(val) || 0).toFixed(decimals)}%`,

  // Fecha corta: 15 may 2025
  fecha: (val) => {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  },

  // Fecha y hora: 15 may 2025, 3:42 PM
  fechaHora: (val) => {
    if (!val) return '—';
    return new Date(val).toLocaleString('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  // Tiempo relativo: hace 3 horas
  relativo: (val) => {
    if (!val) return '—';
    const diff = Date.now() - new Date(val).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)   return 'ahora mismo';
    if (mins  < 60)  return `hace ${mins} min`;
    if (hours < 24)  return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (days  < 30)  return `hace ${days} día${days > 1 ? 's' : ''}`;
    return fmt.fecha(val);
  },

  // NIT formateado: 900.123.456-7
  nit: (nit, dv) => {
    if (!nit) return '—';
    const clean = String(nit).replace(/\D/g, '');
    const formatted = clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dv != null ? `${formatted}-${dv}` : formatted;
  },

  // Cuenta PUC con guión: 1110-01
  cuenta: (codigo) => {
    if (!codigo) return '—';
    return String(codigo).replace(/(\d{4})(\d+)/, '$1-$2');
  },
};

// Calcular dígito de verificación del NIT
export const calcDV = (nit) => {
  const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const clean = String(nit).replace(/\D/g, '');
  let sum = 0;
  for (let i = 0; i < clean.length; i++) {
    sum += parseInt(clean[clean.length - 1 - i]) * primos[i];
  }
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
};

// Parsear moneda colombiana a número
export const parseCOP = (val) => {
  if (!val && val !== 0) return 0;
  const str = String(val).replace(/[$\s.]/g, '').replace(',', '.');
  return parseFloat(str) || 0;
};

// Detectar si un valor es un número válido
export const isNumeric = (val) => !isNaN(parseFloat(val)) && isFinite(val);

// Redondear a 2 decimales
export const round2 = (val) => Math.round((parseFloat(val) || 0) * 100) / 100;

// Colores para gráficas
export const CHART_COLORS = {
  ingresos:  '#00E5B0',
  gastos:    '#FF5078',
  utilidad:  '#3D7BFF',
  iva:       '#FFB800',
  nomina:    '#8892AA',
};

export const BIMESTRES = [
  { id: 1, nombre: 'Enero–Febrero',     inicio: '01', fin: '02' },
  { id: 2, nombre: 'Marzo–Abril',       inicio: '03', fin: '04' },
  { id: 3, nombre: 'Mayo–Junio',        inicio: '05', fin: '06' },
  { id: 4, nombre: 'Julio–Agosto',      inicio: '07', fin: '08' },
  { id: 5, nombre: 'Septiembre–Octubre',inicio: '09', fin: '10' },
  { id: 6, nombre: 'Noviembre–Diciembre',inicio:'11', fin: '12' },
];

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

export const DEPARTAMENTOS_CO = [
  'Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá',
  'Caldas','Caquetá','Casanare','Cauca','Cesar','Chocó',
  'Córdoba','Cundinamarca','Guainía','Guaviare','Huila',
  'La Guajira','Magdalena','Meta','Nariño','Norte de Santander',
  'Putumayo','Quindío','Risaralda','San Andrés','Santander',
  'Sucre','Tolima','Valle del Cauca','Vaupés','Vichada','Bogotá D.C.',
];
