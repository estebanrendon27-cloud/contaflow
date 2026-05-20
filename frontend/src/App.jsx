/**
 * ContaFlow — App.jsx
 * Router principal con rutas protegidas y layout
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, useEmpresaStore } from './store';

// Páginas
import AuthPage      from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import ExcelPage     from './pages/ExcelPage';
import DIANPage      from './pages/DIANPage';
import IVAPage       from './pages/IVAPage';
import NominaPage    from './pages/NominaPage';
import ReportesPage  from './pages/ReportesPage';
import AsistentePage from './pages/AsistentePage';
import ConfigPage    from './pages/ConfigPage';

// Layout
import AppLayout from './components/layout/AppLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
  },
});

// Ruta protegida
const ProtectedRoute = () => {
  const { isAuth, user } = useAuthStore();
  if (!isAuth) return <Navigate to="/auth" replace />;
  return <Outlet />;
};

// Ruta que requiere empresa configurada
const RequireEmpresa = () => {
  const { empresaActual } = useEmpresaStore();
  
  return <Outlet />;
};

export default function App() {
  const { isAuth, loadMe } = useAuthStore();
  const { cargarEmpresas } = useEmpresaStore();

  useEffect(() => {
    if (isAuth) { loadMe(); cargarEmpresas(); }
  }, [isAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />

            <Route element={<RequireEmpresa />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"   element={<DashboardPage />} />
                <Route path="/excel"       element={<ExcelPage />} />
                <Route path="/dian"        element={<DIANPage />} />
                <Route path="/iva"         element={<IVAPage />} />
                <Route path="/nomina"      element={<NominaPage />} />
                <Route path="/reportes"    element={<ReportesPage />} />
                <Route path="/asistente"   element={<AsistentePage />} />
                <Route path="/config"      element={<ConfigPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#141C2E',
            color: '#F0F4FF',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#00E5B0', secondary: '#0A0E1A' } },
          error:   { iconTheme: { primary: '#FF5078', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  );
}

