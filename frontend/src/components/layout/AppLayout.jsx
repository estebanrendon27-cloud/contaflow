import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Upload, FileText, Receipt, Users, BarChart3, Bot, Settings, LogOut, ChevronDown, X, Building2, Search, Bell } from 'lucide-react';
import { useAuthStore, useEmpresaStore } from '../../store';
import toast from 'react-hot-toast';

const NAV = [
  { to:'/dashboard', icon: LayoutDashboard, label:'Panel principal' },
  { to:'/excel',     icon: Upload,           label:'Cargar Excel' },
];
const NAV_TRIBUTARIO = [
  { to:'/dian',   icon: FileText, label:'DIAN & FE' },
  { to:'/iva',    icon: Receipt,  label:'IVA & Retenciones' },
  { to:'/nomina', icon: Users,    label:'Nómina & PILA' },
];
const NAV_REPORTES = [
  { to:'/reportes',  icon: BarChart3, label:'Balance & P&G' },
  { to:'/asistente', icon: Bot,       label:'Asistente IA' },
];
const NAV_SISTEMA = [
  { to:'/config', icon: Settings, label:'Configuración' },
];

export default function AppLayout() {
  const { user, logout }                    = useAuthStore();
  const { empresas, empresaActual, setEmpresa, crearEmpresa } = useEmpresaStore();
  const navigate                            = useNavigate();
  const [empresaMenuOpen, setEmpresaMenuOpen] = useState(false);
  const [modalOpen, setModalOpen]           = useState(false);
  const [loading, setLoading]               = useState(false);
  const [form, setForm] = useState({
    razon_social: '', nit: '', digito_verificacion: '', regimen: 'comun', ciudad: '', direccion: ''
  });

  const handleLogout = () => { logout(); navigate('/auth'); };

  const handleCrearEmpresa = async () => {
    if (!form.razon_social || !form.nit) return toast.error('Razón social y NIT son obligatorios');
    setLoading(true);
    try {
      await crearEmpresa(form);
      toast.success('¡Empresa creada correctamente!');
      setModalOpen(false);
      setEmpresaMenuOpen(false);
      setForm({ razon_social:'', nit:'', digito_verificacion:'', regimen:'comun', ciudad:'', direccion:'' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Error creando empresa');
    } finally { setLoading(false); }
  };

  const ini = (txt) => txt ? txt.slice(0,2).toUpperCase() : 'CF';

  return (
    <div className="flex h-screen bg-[#0A0E1A] text-[#F0F4FF] overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-56 flex-shrink-0 bg-[#0D1525] border-r border-white/7 flex flex-col">
        <div className="px-4 py-4 border-b border-white/7 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00E5B0] flex items-center justify-center text-[#0A0E1A] font-black text-sm">CF</div>
          <span className="font-black text-base" style={{ fontFamily:'Syne,sans-serif' }}>ContaFlow</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <NavSection items={NAV} />
          <SectionLabel label="TRIBUTARIO" />
          <NavSection items={NAV_TRIBUTARIO} dot={true} />
          <SectionLabel label="REPORTES" />
          <NavSection items={NAV_REPORTES} />
          <SectionLabel label="SISTEMA" />
          <NavSection items={NAV_SISTEMA} />
        </nav>
        <div className="p-3 border-t border-white/7">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-[#3D7BFF]/20 flex items-center justify-center text-xs font-bold text-[#3D7BFF]">
              {ini(user?.nombre)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{user?.nombre || 'Usuario'}</div>
              <div className="text-[10px] text-[#8892AA] truncate capitalize">{user?.rol || 'contador'}</div>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8892AA] hover:text-[#FF5078]">
              <LogOut size={13}/>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/7 bg-[#0D1525] flex items-center px-4 gap-3 flex-shrink-0">
          <div className="relative">
            <button onClick={() => setEmpresaMenuOpen(p => !p)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-[#1E2A42] transition-colors text-sm">
              <div className={`w-2 h-2 rounded-full ${empresaActual ? 'bg-[#00E5B0]' : 'bg-[#8892AA]'}`} />
              <span className="max-w-[160px] truncate">{empresaActual?.razon_social || 'Sin empresa'}</span>
              <ChevronDown size={13} className="text-[#8892AA]"/>
            </button>
            {empresaMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[#141C2E] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {empresas.map(emp => (
                  <button key={emp.id} onClick={() => { setEmpresa(emp); setEmpresaMenuOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${emp.id === empresaActual?.id ? 'bg-[#00E5B0]/10 text-[#00E5B0]' : 'hover:bg-white/5 text-[#F0F4FF]'}`}>
                    <div className="font-medium truncate">{emp.razon_social}</div>
                    <div className="text-xs text-[#8892AA]">NIT {emp.nit}-{emp.digito_verificacion}</div>
                  </button>
                ))}
                <div className="border-t border-white/7">
                  <button onClick={() => { setModalOpen(true); setEmpresaMenuOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-[#00E5B0] hover:bg-[#00E5B0]/5 transition-colors">
                    + Agregar empresa
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button className="w-8 h-8 rounded-lg border border-white/7 flex items-center justify-center text-[#8892AA] hover:bg-[#1E2A42] transition-colors">
            <Search size={15}/>
          </button>
          <button className="w-8 h-8 rounded-lg border border-white/7 flex items-center justify-center text-[#8892AA] hover:bg-[#1E2A42] transition-colors relative">
            <Bell size={15}/>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF5078]" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* MODAL CREAR EMPRESA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1525] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/7">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-[#00E5B0]"/>
                <span className="font-bold" style={{ fontFamily:'Syne,sans-serif' }}>Nueva empresa</span>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-[#8892AA] hover:text-[#F0F4FF]">
                <X size={18}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8892AA] mb-1.5 block">Razón social *</label>
                <input value={form.razon_social} onChange={e => setForm(p=>({...p, razon_social: e.target.value}))}
                       placeholder="Ej: Mi Empresa SAS"
                       className="w-full bg-[#141C2E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F0F4FF] placeholder-[#8892AA] focus:outline-none focus:border-[#00E5B0]/50 transition-colors"/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-[#8892AA] mb-1.5 block">NIT *</label>
                  <input value={form.nit} onChange={e => setForm(p=>({...p, nit: e.target.value}))}
                         placeholder="900123456"
                         className="w-full bg-[#141C2E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F0F4FF] placeholder-[#8892AA] focus:outline-none focus:border-[#00E5B0]/50 transition-colors"/>
                </div>
                <div>
                  <label className="text-xs text-[#8892AA] mb-1.5 block">Dígito</label>
                  <input value={form.digito_verificacion} onChange={e => setForm(p=>({...p, digito_verificacion: e.target.value}))}
                         placeholder="0"
                         className="w-full bg-[#141C2E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F0F4FF] placeholder-[#8892AA] focus:outline-none focus:border-[#00E5B0]/50 transition-colors"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8892AA] mb-1.5 block">Régimen</label>
                <select value={form.regimen} onChange={e => setForm(p=>({...p, regimen: e.target.value}))}
                        className="w-full bg-[#141C2E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F0F4FF] focus:outline-none focus:border-[#00E5B0]/50 transition-colors">
                  <option value="comun">Régimen común</option>
                  <option value="simplificado">Régimen simplificado</option>
                  <option value="simple">Régimen SIMPLE</option>
                  <option value="gran_contribuyente">Gran contribuyente</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#8892AA] mb-1.5 block">Ciudad</label>
                  <input value={form.ciudad} onChange={e => setForm(p=>({...p, ciudad: e.target.value}))}
                         placeholder="Medellín"
                         className="w-full bg-[#141C2E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F0F4FF] placeholder-[#8892AA] focus:outline-none focus:border-[#00E5B0]/50 transition-colors"/>
                </div>
                <div>
                  <label className="text-xs text-[#8892AA] mb-1.5 block">Dirección</label>
                  <input value={form.direccion} onChange={e => setForm(p=>({...p, direccion: e.target.value}))}
                         placeholder="Calle 10 # 20-30"
                         className="w-full bg-[#141C2E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F0F4FF] placeholder-[#8892AA] focus:outline-none focus:border-[#00E5B0]/50 transition-colors"/>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModalOpen(false)}
                      className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm text-[#8892AA] hover:bg-[#1E2A42] transition-colors">
                Cancelar
              </button>
              <button onClick={handleCrearEmpresa} disabled={loading}
                      className="flex-1 py-2.5 bg-[#00E5B0] text-[#0A0E1A] rounded-xl text-sm font-semibold hover:shadow-[0_6px_20px_rgba(0,229,176,0.3)] disabled:opacity-50 transition-all">
                {loading ? 'Creando...' : 'Crear empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ label }) {
  return <div className="px-2 py-1.5 text-[9px] font-bold text-[#8892AA] uppercase tracking-widest mt-2">{label}</div>;
}

function NavSection({ items, dot }) {
  return items.map(({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to}
             className={({ isActive }) =>
               `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all relative
                ${isActive ? 'bg-[#1E2A42] text-[#F0F4FF] font-semibold' : 'text-[#8892AA] hover:text-[#F0F4FF] hover:bg-white/4'}`}>
      <Icon size={15}/>
      <span className="truncate">{label}</span>
      {dot && label === 'IVA & Retenciones' && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF5078]" />
      )}
    </NavLink>
  ));
}