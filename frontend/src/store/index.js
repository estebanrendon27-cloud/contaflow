import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

// ── AUTH STORE ──────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:   null,
      token:  null,
      isAuth: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user, token: data.token, isAuth: true });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;localStorage.setItem('cf_token', data.token);
      },

      register: async (nombre, email, password, rol) => {
        const { data } = await api.post('/auth/register', { nombre, email, password, rol });
        set({ user: data.user, token: data.token, isAuth: true });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;localStorage.setItem('cf_token', data.token);
      },

      loadMe: async () => {
        try {
          const { token } = get();
          if (!token) return;
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const { data } = await api.get('/auth/me');
          set({ user: data.user, isAuth: true });
        } catch {
          set({ user: null, token: null, isAuth: false });
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuth: false });
        delete api.defaults.headers.common['Authorization'];
      },
    }),
    {
      name: 'contaflow-auth',
      partialize: (s) => ({ token: s.token, user: s.user, isAuth: s.isAuth }),
    }
  )
);

// ── EMPRESA STORE ───────────────────────────────────────────────────────────
export const useEmpresaStore = create(
  persist(
    (set, get) => ({
      empresas:      [],
      empresaActual: null,

      cargarEmpresas: async () => {
        try {
          const { data } = await api.get('/empresas');
          const lista = data.empresas || [];
          set({ empresas: lista });
          if (lista.length > 0 && !get().empresaActual) {
            set({ empresaActual: lista[0] });
            api.defaults.headers.common['X-Empresa-Id'] = lista[0].id;localStorage.setItem('cf_empresa_id', lista[0].id);
          }
        } catch (e) {
          console.error('Error cargando empresas', e);
        }
      },

      crearEmpresa: async (form) => {
        const { data } = await api.post('/empresas', form);
        const nueva = data.empresa;
        set(s => ({
          empresas: [...s.empresas, nueva],
          empresaActual: nueva,
        }));
        api.defaults.headers.common['X-Empresa-Id'] = nueva.id;
        localStorage.setItem('cf_empresa_id', nueva.id);
        return nueva;
      },

      setEmpresa: (empresa) => {
        set({ empresaActual: empresa });
        api.defaults.headers.common['X-Empresa-Id'] = empresa.id;
        localStorage.setItem('cf_empresa_id', empresa.id);
      },
    }),
    {
      name: 'contaflow-empresa',
      partialize: (s) => ({ empresaActual: s.empresaActual }),
    }
  )
);