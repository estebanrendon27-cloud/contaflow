/**
 * ContaFlow — Store global con Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, empresaService } from '../services/api';

// ─── AUTH STORE ───────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      token:        null,
      refreshToken: null,
      isAuth:       false,

      login: async (email, password) => {
        const { data } = await authService.login({ email, password });
        localStorage.setItem('cf_token', data.token);
        localStorage.setItem('cf_refresh_token', data.refreshToken);
        set({ user: data.user, token: data.token, refreshToken: data.refreshToken, isAuth: true });
        return data;
      },

      register: async (formData) => {
        const { data } = await authService.register(formData);
        localStorage.setItem('cf_token', data.token);
        localStorage.setItem('cf_refresh_token', data.refreshToken);
        set({ user: data.user, token: data.token, refreshToken: data.refreshToken, isAuth: true });
        return data;
      },

      logout: () => {
        localStorage.removeItem('cf_token');
        localStorage.removeItem('cf_refresh_token');
        localStorage.removeItem('cf_empresa_id');
        set({ user: null, token: null, refreshToken: null, isAuth: false });
        useEmpresaStore.getState().reset();
      },

      loadMe: async () => {
        try {
          const { data } = await authService.me();
          set({ user: data.user, isAuth: true });
          return data;
        } catch { get().logout(); }
      },
    }),
    { name: 'cf-auth', partialize: (s) => ({ user: s.user, token: s.token, isAuth: s.isAuth }) }
  )
);

// ─── EMPRESA STORE ────────────────────────────────────────────────────────────
export const useEmpresaStore = create(
  persist(
    (set, get) => ({
      empresaActual: null,
      empresas:      [],
      loading:       false,

      setEmpresa: (empresa) => {
        localStorage.setItem('cf_empresa_id', empresa.id);
        set({ empresaActual: empresa });
      },

      cargarEmpresas: async () => {
        set({ loading: true });
        try {
          const { data } = await empresaService.listar();
          set({ empresas: data.empresas });
          // Si solo hay una empresa, seleccionarla automáticamente
          if (data.empresas.length === 1 && !get().empresaActual) {
            get().setEmpresa(data.empresas[0]);
          }
        } finally { set({ loading: false }); }
      },

      reset: () => set({ empresaActual: null, empresas: [] }),
    }),
    { name: 'cf-empresa', partialize: (s) => ({ empresaActual: s.empresaActual }) }
  )
);

// ─── UI STORE ─────────────────────────────────────────────────────────────────
export const useUIStore = create((set) => ({
  sidebarOpen: true,
  modalOpen:   null,
  loading:     {},

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal:  (id)  => set({ modalOpen: id }),
  closeModal: ()    => set({ modalOpen: null }),

  setLoading: (key, val) => set((s) => ({ loading: { ...s.loading, [key]: val } })),
  isLoading:  (key)      => useUIStore.getState().loading[key] || false,
}));

// ─── DASHBOARD STORE ──────────────────────────────────────────────────────────
export const useDashboardStore = create((set) => ({
  data:    null,
  loading: false,
  error:   null,

  cargar: async (empresaId) => {
    set({ loading: true, error: null });
    try {
      const { data } = await empresaService.dashboard(empresaId);
      set({ data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));
