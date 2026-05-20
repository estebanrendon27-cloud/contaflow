/**
 * ContaFlow — AppLayout.jsx
 * Layout principal: sidebar + topbar + content
 */
import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useEmpresaStore } from '../../store';
import {
  LayoutDashboard, FileSpreadsheet, Key, FileText,
  Users, BarChart3, Bot, Settings, LogOut,
  ChevronDown, Bell, Search, Menu, X, Building2,
  TrendingUp, AlertCircle, CheckCircle
} from 'lucide-react';

const NAV = [
  { label: 'Principal', items: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Panel principal' },
    { to: '/excel',     icon: FileSpreadsheet,  label: 'Cargar Excel' },
  ]},
  { label: 'Tributario', items: [
    { to: '/dian',    icon: Key,       label: 'DIAN & FE',        badge: null },
    { to: '/iva',     icon: FileText,  label: 'IVA & Retenciones', badge: 'alerta' },
    { to: '/nomina',  icon: Users,     label: 'Nómina & PILA' },
  ]},
  { label: 'Reportes', items: [
    { to: '/reportes',  icon: BarChart3,   label: 'Balance & P&G' },
    { to: '/asistente', icon: Bot,         label: 'Asistente IA' },
  ]},
  { label: 'Sistema', items: [
    { to: '/config', icon: Settings, label: 'Configuración' },
  ]},
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [empresaMenuOpen, setEmpresaMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { empresaActual, empresas, setEmpresa } = useEmpresaStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/auth'); };

  return (
    <div className="flex h-screen bg-[#0A0E1A] text-[#F0F4FF] font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className={`
        ${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0
        bg-[#0D1525] border-r border-white/7 flex flex-col
        transition-all duration-300 relative z-20
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/7 h-14">
          <div className="w-8 h-8 rounded-lg bg-[#00E5B0] flex items-center justify-center
                          text-[#0A0E1A] font-black text-sm flex-shrink-0">CF</div>
          {sidebarOpen && <span className="font-bold text-base tracking-tight">ContaFlow</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map((section) => (
            <div key={section.label}>
              {sidebarOpen && (
                <div className="px-4 py-2 mt-1 text-[10px] font-semibold tracking-widest
                                uppercase text-white/25">{section.label}</div>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `
                    flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm
                    transition-all duration-150 relative group mb-0.5
                    ${isActive
                      ? 'bg-[#00E5B0]/10 text-[#00E5B0] font-medium'
                      : 'text-[#8892AA] hover:bg-white/4 hover:text-[#F0F4FF]'}
                  `}
                >
                  <item.icon size={17} className="flex-shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge === 'alerta' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5078] flex-shrink-0" />
                      )}
                    </>
                  )}
                  {/* Tooltip cuando está cerrado */}
                  {!sidebarOpen && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[#141C2E] border
                                    border-white/10 rounded-lg text-xs whitespace-nowrap
                                    opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/7 p-3">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/4 cursor-pointer"
               onClick={handleLogout}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00E5B0] to-[#3D7BFF]
                            flex items-center justify-center text-[#0A0E1A] text-xs font-bold flex-shrink-0">
              {user?.nombre?.[0]}{user?.apellido?.[0]}
            </div>
            {sidebarOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{user?.nombre} {user?.apellido}</div>
                  <div className="text-[10px] text-[#8892AA] capitalize">{user?.rol?.replace('_',' ')}</div>
                </div>
                <LogOut size={14} className="text-[#8892AA] flex-shrink-0" />
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOPBAR */}
        <header className="h-14 bg-[#0D1525] border-b border-white/7 flex items-center
                           justify-between px-4 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="w-8 h-8 rounded-lg border border-white/7 flex items-center
                               justify-center text-[#8892AA] hover:bg-[#1E2A42] transition-colors">
              {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
            </button>

            {/* Selector empresa */}
            <div className="relative">
              <button
                onClick={() => setEmpresaMenuOpen(!empresaMenuOpen)}
                className="flex items-center gap-2 bg-[#141C2E] border border-white/7 rounded-lg
                           px-3 py-1.5 text-sm hover:border-white/15 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-[#00E5B0]" />
                <span className="max-w-40 truncate">{empresaActual?.razon_social || 'Sin empresa'}</span>
                <ChevronDown size={12} className="text-[#8892AA]" />
              </button>

              {empresaMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#141C2E] border border-white/10
                                rounded-xl shadow-2xl overflow-hidden z-50">
                  {empresas.map((emp) => (
                    <button key={emp.id} onClick={() => { setEmpresa(emp); setEmpresaMenuOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                              ${emp.id === empresaActual?.id ? 'bg-[#00E5B0]/10 text-[#00E5B0]'
                                                             : 'hover:bg-white/5 text-[#F0F4FF]'}`}>
                      <div className="font-medium truncate">{emp.razon_social}</div>
                      <div className="text-xs text-[#8892AA]">NIT {emp.nit}-{emp.digito_verificacion}</div>
                    </button>
                  ))}
                  <div className="border-t border-white/7">
                    <button onClick={() => { navigate('/onboarding'); setEmpresaMenuOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-[#00E5B0]
                                       hover:bg-[#00E5B0]/5 transition-colors">
                      + Agregar empresa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg border border-white/7 flex items-center
                               justify-center text-[#8892AA] hover:bg-[#1E2A42] transition-colors">
              <Search size={15} />
            </button>
            <button className="w-8 h-8 rounded-lg border border-white/7 flex items-center
                               justify-center text-[#8892AA] hover:bg-[#1E2A42] transition-colors relative">
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF5078]" />
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Overlay empresa menu */}
      {empresaMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setEmpresaMenuOpen(false)} />
      )}
    </div>
  );
}
