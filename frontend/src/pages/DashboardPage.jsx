/**
 * ContaFlow — DashboardPage.jsx
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, FileText,
         Upload, CheckSquare, Clock, Zap } from 'lucide-react';
import { useEmpresaStore } from '../store';
import { empresaService } from '../services/api';
import { fmt } from '../utils/format';

export default function DashboardPage() {
  const { empresaActual } = useEmpresaStore();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', empresaActual?.id],
    queryFn: () => empresaService.dashboard(empresaActual.id).then(r => r.data),
    enabled: !!empresaActual?.id,
    refetchInterval: 60000,
  });

  if (isLoading) return <PageLoader />;

  const kpis = data?.kpis || {};
  const ingresos    = parseFloat(kpis.ingresos_mes || 0);
  const gastos      = parseFloat(kpis.gastos_mes   || 0);
  const utilidad    = ingresos - gastos;
  const ivaPend     = parseFloat(kpis.iva_pendiente || 0);

  const graficaData = (data?.grafica || []).map(g => ({
    mes: new Date(g.mes).toLocaleDateString('es-CO', { month: 'short' }),
    Ingresos: Math.round(parseFloat(g.ingresos) / 1e6 * 10) / 10,
    Gastos:   Math.round(parseFloat(g.gastos)   / 1e6 * 10) / 10,
  }));

  const vencimientos = data?.vencimientos || [];
  const urgentes     = vencimientos.filter(v => v.dias_restantes <= 15);

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-[#8892AA] mb-1">
            {empresaActual?.razon_social} · {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          </div>
          <h1 className="text-2xl font-black text-[#F0F4FF]" style={{ fontFamily:'Syne,sans-serif', letterSpacing:'-0.3px' }}>
            Panel principal
          </h1>
        </div>
        <button onClick={() => navigate('/excel')}
                className="flex items-center gap-2 bg-[#00E5B0] text-[#0A0E1A] px-4 py-2 rounded-xl
                           text-sm font-semibold hover:shadow-[0_6px_20px_rgba(0,229,176,0.3)]
                           hover:-translate-y-0.5 transition-all">
          <Upload size={15}/> Cargar archivos
        </button>
      </div>

      {/* ALERTA VENCIMIENTOS */}
      {urgentes.length > 0 && (
        <div className="flex items-start gap-3 bg-[#FFB800]/7 border border-[#FFB800]/20
                        rounded-xl p-4 mb-6">
          <AlertCircle size={18} className="text-[#FFB800] flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-[#FFB800]">
              {urgentes.length} vencimiento{urgentes.length > 1 ? 's' : ''} próximo{urgentes.length > 1 ? 's:' : ':'}
            </span>
            {' '}{urgentes.map(v => `${v.descripcion} (${v.dias_restantes}d)`).join(' · ')}
          </div>
          <button onClick={() => navigate('/iva')}
                  className="text-xs text-[#FFB800] font-medium hover:underline whitespace-nowrap">
            Ver formularios →
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI icon={<TrendingUp size={18}/>} color="#00E5B0" bg="rgba(0,229,176,0.1)"
             label="Ingresos del mes" value={fmt.cop(ingresos)} sub="▲ vs mes anterior" subColor="#00E5B0" />
        <KPI icon={<TrendingDown size={18}/>} color="#FF5078" bg="rgba(255,80,120,0.1)"
             label="Gastos del mes" value={fmt.cop(gastos)} sub="Operativos + nómina" subColor="#8892AA" />
        <KPI icon={<DollarSign size={18}/>} color="#3D7BFF" bg="rgba(61,123,255,0.1)"
             label="Utilidad estimada" value={fmt.cop(utilidad)}
             sub={utilidad >= 0 ? `Margen ${ingresos > 0 ? Math.round(utilidad/ingresos*100) : 0}%` : 'Pérdida'}
             subColor={utilidad >= 0 ? '#00E5B0' : '#FF5078'} />
        <KPI icon={<FileText size={18}/>} color="#FFB800" bg="rgba(255,184,0,0.1)"
             label="IVA pendiente" value={fmt.cop(ivaPend)} sub="Bimestre · Revisar" subColor="#FFB800" />
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* GRÁFICA - 2/3 */}
        <div className="xl:col-span-2 flex flex-col gap-5">
          <Card title="📊 Ingresos vs Gastos" action={{ label: 'Ver P&G →', to: '/reportes' }}>
            {graficaData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={graficaData} barGap={4}>
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#8892AA' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#8892AA' }} axisLine={false} tickLine={false}
                           tickFormatter={v => `$${v}M`} />
                    <Tooltip
                      contentStyle={{ background: '#141C2E', border: '1px solid rgba(255,255,255,0.07)',
                                      borderRadius: '10px', fontSize: '12px', color: '#F0F4FF' }}
                      formatter={v => [`$${v}M`, '']} />
                    <Bar dataKey="Ingresos" fill="#00E5B0" radius={[3,3,0,0]} />
                    <Bar dataKey="Gastos"   fill="rgba(61,123,255,0.6)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {[['#00E5B0','Ingresos'],['rgba(61,123,255,0.8)','Gastos']].map(([c,l]) => (
                    <div key={l} className="flex items-center gap-1.5 text-xs text-[#8892AA]">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                      {l}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon="📊" msg="Sin datos aún. Carga tus archivos Excel para ver la gráfica." />
            )}
          </Card>

          {/* ÚLTIMAS TRANSACCIONES */}
          <Card title="🔄 Últimas transacciones" action={{ label: 'Ver todas →', to: '/reportes' }}>
            {(data?.actividad || []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['Descripción','Tipo','Monto','Estado'].map(h => (
                        <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider
                                               text-[#8892AA] pb-3 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.actividad || []).slice(0,6).map((tx, i) => (
                      <tr key={i} className="border-t border-white/4 hover:bg-white/2 transition-colors">
                        <td className="py-2.5 pr-4 text-xs max-w-[180px] truncate text-[#F0F4FF]">{tx.descripcion}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium
                            ${tx.tipo==='ingreso' ? 'bg-[#00E5B0]/10 text-[#00E5B0]'
                            : tx.tipo==='nomina'  ? 'bg-[#3D7BFF]/10 text-[#3D7BFF]'
                            : 'bg-[#FF5078]/10 text-[#FF5078]'}`}>
                            {tx.tipo}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs font-semibold text-[#F0F4FF]">—</td>
                        <td className="py-2.5 text-[10px] text-[#00E5B0]">✓</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon="🔄" msg="No hay transacciones aún." />}
          </Card>
        </div>

        {/* SIDEBAR DERECHO - 1/3 */}
        <div className="flex flex-col gap-5">

          {/* VENCIMIENTOS */}
          <Card title="📅 Vencimientos DIAN" action={{ label: 'Ver todos →', to: '/dian' }}>
            {vencimientos.length > 0 ? (
              <div className="space-y-3">
                {vencimientos.slice(0,4).map((v, i) => {
                  const dias = parseInt(v.dias_restantes);
                  const color = dias <= 8 ? '#FF5078' : dias <= 20 ? '#FFB800' : '#00E5B0';
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 text-center bg-[#1E2A42] rounded-lg py-1.5 flex-shrink-0">
                        <div className="text-base font-black text-[#F0F4FF] leading-tight"
                             style={{ fontFamily:'Syne,sans-serif' }}>
                          {new Date(v.fecha_vence).getDate()}
                        </div>
                        <div className="text-[9px] text-[#8892AA] uppercase">
                          {new Date(v.fecha_vence).toLocaleString('es-CO',{month:'short'})}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[#F0F4FF] truncate">{v.descripcion}</div>
                        <div className="text-[10px] text-[#8892AA]">Form. {v.formulario}</div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${color}18`, color }}>
                        {dias}d
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState icon="📅" msg="Sin vencimientos próximos." />}
          </Card>

          {/* CARGA RÁPIDA */}
          <Card title="📁 Carga rápida">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon:'💰', label:'Ingresos',   hint:'Excel ventas',    to:'/excel?tab=ingresos' },
                { icon:'💳', label:'Gastos',      hint:'Compras/servicios', to:'/excel?tab=gastos' },
                { icon:'👥', label:'Nómina',      hint:'Período actual',  to:'/excel?tab=nomina' },
                { icon:'🏦', label:'Extracto',   hint:'Conciliación',    to:'/excel?tab=bancario' },
              ].map((item) => (
                <button key={item.label} onClick={() => navigate(item.to)}
                        className="border border-dashed border-white/10 rounded-xl p-3 text-center
                                   hover:border-[#00E5B0]/30 hover:bg-[#00E5B0]/3 transition-all group">
                  <div className="text-xl mb-1">{item.icon}</div>
                  <div className="text-xs font-medium text-[#F0F4FF] group-hover:text-[#00E5B0]">{item.label}</div>
                  <div className="text-[10px] text-[#8892AA]">{item.hint}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* ACTIVIDAD RECIENTE */}
          <Card title="⚡ Actividad reciente">
            <div className="space-y-3">
              {[
                { icon:'📥', bg:'rgba(0,229,176,0.12)', msg:'FE descargadas automáticamente', t:'Hace 12 min' },
                { icon:'📊', bg:'rgba(61,123,255,0.12)', msg:'Nómina liquidada — 14 empleados', t:'Hace 2 días' },
                { icon:'⚠️', bg:'rgba(255,184,0,0.12)', msg:'Alerta vencimiento IVA en 8 días', t:'Hace 3 días' },
              ].map((a, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                       style={{ background: a.bg }}>{a.icon}</div>
                  <div>
                    <div className="text-xs text-[#F0F4FF] leading-tight">{a.msg}</div>
                    <div className="text-[10px] text-[#8892AA] mt-0.5">{a.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function KPI({ icon, color, bg, label, value, sub, subColor }) {
  return (
    <div className="bg-[#141C2E] border border-white/7 rounded-xl p-4 hover:border-white/12
                    hover:-translate-y-0.5 transition-all cursor-default">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#8892AA]">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg, color }}>{icon}</div>
      </div>
      <div className="text-xl font-black mb-1 text-[#F0F4FF]" style={{ fontFamily:'Syne,sans-serif', color }}>{value}</div>
      <div className="text-xs" style={{ color: subColor }}>{sub}</div>
    </div>
  );
}

function Card({ title, action, children }) {
  const navigate = useNavigate();
  return (
    <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/4">
        <span className="text-sm font-bold text-[#F0F4FF]" style={{ fontFamily:'Syne,sans-serif' }}>{title}</span>
        {action && (
          <button onClick={() => navigate(action.to)}
                  className="text-xs text-[#00E5B0] hover:opacity-70 transition-opacity">{action.label}</button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div className="text-center py-8">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-xs text-[#8892AA]">{msg}</p>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00E5B0]/30 border-t-[#00E5B0] rounded-full animate-spin" />
        <p className="text-xs text-[#8892AA]">Cargando datos...</p>
      </div>
    </div>
  );
}
