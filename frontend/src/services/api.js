/**
 * ContaFlow Frontend — API Client
 * Cliente Axios centralizado con interceptores JWT y manejo de errores
 */

import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── INTERCEPTOR REQUEST ──────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const empresaId = localStorage.getItem('cf_empresa_id');
  if (empresaId) config.headers['X-Empresa-Id'] = empresaId;

  return config;
});

// ─── INTERCEPTOR RESPONSE ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const msg    = error.response?.data?.error;

    if (status === 401) {
      // Intentar refresh token
      const refreshToken = localStorage.getItem('cf_refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('cf_token', data.token);
          error.config.headers.Authorization = `Bearer ${data.token}`;
          return api(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/auth';
          return Promise.reject(error);
        }
      }
      localStorage.clear();
      window.location.href = '/auth';
    }

    if (status === 403) toast.error('No tienes permisos para esta acción');
    if (status === 404) toast.error('Recurso no encontrado');
    if (status >= 500)  toast.error('Error del servidor. Intenta de nuevo.');
    if (msg && status !== 401) toast.error(msg);

    return Promise.reject(error);
  }
);

// ─── SERVICIOS ────────────────────────────────────────────────────────────────

export const authService = {
  register: (data)  => api.post('/auth/register', data),
  login:    (data)  => api.post('/auth/login', data),
  refresh:  (token) => api.post('/auth/refresh', { refreshToken: token }),
  me:       ()      => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const empresaService = {
  listar:      ()     => api.get('/empresas'),
  crear:       (data) => api.post('/empresas', data),
  obtener:     (id)   => api.get(`/empresas/${id}`),
  actualizar:  (id, data) => api.put(`/empresas/${id}`, data),
  dashboard:   (id)   => api.get(`/empresas/${id}/dashboard`),
};

export const excelService = {
  upload:       (modulo, formData) => api.post(`/excel/upload/${modulo}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => Math.round((e.loaded * 100) / e.total),
  }),
  historial:    ()  => api.get('/excel/archivos'),
  estado:       (id) => api.get(`/excel/archivos/${id}/estado`),
  plantilla:    (modulo) => api.get(`/excel/plantilla/${modulo}`, { responseType: 'blob' }),
};

export const dianService = {
  listarFE:    (params) => api.get('/dian/fe', { params }),
  emitirFE:    (data)   => api.post('/dian/fe/emitir', data),
  validarCUFE: (cufe)   => api.post('/dian/fe/validar-cufe', { cufe }),
  tokenEstado: ()       => api.get('/dian/token'),
  subirToken:  (data)   => api.post('/dian/token', data),
  vencimientos: ()      => api.get('/dian/vencimientos'),
  resumen:     ()       => api.get('/dian/resumen'),
};

export const ivaService = {
  periodos:      ()                => api.get('/iva/periodos'),
  calcular:      (bimestre, anio)  => api.post(`/iva/calcular/${bimestre}/${anio}`),
  retenciones:   (mes, anio)       => api.get(`/iva/retenciones/${mes}/${anio}`),
};

export const nominaService = {
  periodos:       ()   => api.get('/nomina/periodos'),
  empleados:      (id) => api.get(`/nomina/periodos/${id}/empleados`),
  resumen:        (id) => api.get(`/nomina/periodos/${id}/resumen`),
  generarPILA:    (id) => api.post(`/nomina/periodos/${id}/generar-pila`, {}, { responseType: 'blob' }),
};

export const contabilidadService = {
  transacciones: (params) => api.get('/contabilidad/transacciones', { params }),
  crearTx:       (data)   => api.post('/contabilidad/transacciones', data),
  puc:           ()       => api.get('/contabilidad/puc'),
  libroMayor:    (cuenta, params) => api.get(`/contabilidad/libro-mayor/${cuenta}`, { params }),
  periodos:      ()       => api.get('/contabilidad/periodos'),
};

export const reportesService = {
  balance:    (fecha)         => api.get('/reportes/balance', { params: { fecha } }),
  pyg:        (desde, hasta)  => api.get('/reportes/pyg', { params: { desde, hasta } }),
  flujoCaja:  ()              => api.get('/reportes/flujo-caja'),
  exportar:   (tipo)          => api.get(`/reportes/exportar/${tipo}`, { responseType: 'blob' }),
};

export const iaService = {
  chat:            (mensaje)       => api.post('/ia/chat', { mensaje }),
  historial:       ()              => api.get('/ia/historial'),
  clasificarCuenta:(desc, tipo)    => api.post('/ia/clasificar-cuenta', { descripcion: desc, tipo }),
  analizar:        ()              => api.post('/ia/analizar'),
};

// Helper para descargar blob como archivo
export const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
};
