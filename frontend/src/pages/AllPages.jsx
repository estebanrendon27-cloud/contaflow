/**
 * ContaFlow — ExcelPage.jsx
 */
import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { excelService, descargarBlob, reportesService, nominaService } from '../services/api';
const inputBaseCls = "w-full bg-[#141C2E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#F0F4FF] placeholder-[#8892AA] focus:outline-none focus:border-[#00E5B0]/50 transition-colors";
const selCls = inputBaseCls;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
import { useEmpresaStore } from '../store';
import { fmt } from '../utils/format';
function PageHeader({ title, highlight, sub, children }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-black text-[#F0F4FF]" style={{ fontFamily:'Syne,sans-serif' }}>
          {title} <span className="text-[#00E5B0]">{highlight}</span>
        </h1>
        {sub && <p className="text-sm text-[#8892AA] mt-0.5">{sub}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

const TABS = [
  { id:'ingresos', label:'💰 Ingresos',     hint:'Ventas, facturas, anticipos' },
  { id:'gastos',   label:'💳 Gastos',        hint:'Compras, servicios, gastos' },
  { id:'nomina',   label:'👥 Nómina',        hint:'Empleados, salarios, PILA' },
  { id:'bancario', label:'🏦 Conciliación', hint:'Extracto bancario' },
];

const PASOS = [
  'Leyendo y validando archivo...',
  'Detectando columnas automáticamente...',
  'Clasificando cuentas PUC con IA...',
  'Calculando IVA y retenciones...',
  'Generando asientos contables...',
];

export default function ExcelPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab]           = useState(searchParams.get('tab') || 'ingresos');
  const [file, setFile]         = useState(null);
  const [drag, setDrag]         = useState(false);
  const [processing, setProc]   = useState(false);
  const [paso, setPaso]         = useState(0);
  const [resultado, setResult]  = useState(null);
  const [mes, setMes]           = useState(new Date().getMonth() + 1);
  const [anio, setAnio]         = useState(new Date().getFullYear());
  const fileRef = useRef();
  const { empresaActual }       = useEmpresaStore();
  const qc                      = useQueryClient();

  const { data: historial } = useQuery({
    queryKey: ['archivos', empresaActual?.id],
    queryFn:  () => excelService.historial().then(r => r.data),
    enabled:  !!empresaActual?.id,
  });

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) return toast.error('Solo se aceptan archivos .xlsx, .xls o .csv');
    setFile(f); setResult(null);
  };

  const procesar = async () => {
    if (!file) return toast.error('Selecciona un archivo primero');
    setProc(true); setPaso(0); setResult(null);

    // Simular pasos (el servidor procesa en background)
    for (let i = 0; i < PASOS.length; i++) {
      setPaso(i);
      await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
    }

    const fd = new FormData();
    fd.append('archivo', file);
    if (tab === 'nomina') { fd.append('mes', mes); fd.append('anio', anio); }

    try {
      const { data } = await excelService.upload(tab, fd);
      setResult({ ok: true, archivoId: data.archivoId });
      toast.success('¡Archivo procesado correctamente!');
      qc.invalidateQueries(['archivos']);
      qc.invalidateQueries(['dashboard']);
    } catch {
      setResult({ ok: false });
      toast.error('Error procesando el archivo');
    } finally { setProc(false); }
  };

  const descargar = async (modulo) => {
    try {
      const { data } = await excelService.plantilla(modulo);
      descargarBlob(data, `contaflow_plantilla_${modulo}.xlsx`);
    } catch { toast.error('Error descargando plantilla'); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Carga de" highlight="Archivos Excel"
                  sub={`${empresaActual?.razon_social} · ${MESES[mes-1]} ${anio}`}>
        <button onClick={() => descargar(tab)}
                className="flex items-center gap-2 bg-transparent border border-white/10 text-[#F0F4FF]
                           px-3 py-2 rounded-xl text-sm hover:bg-[#1E2A42] transition-colors">
          <Download size={14}/> Descargar plantilla
        </button>
      </PageHeader>

      {/* TABS */}
      <div className="flex gap-1 bg-[#141C2E] border border-white/7 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setFile(null); setResult(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${tab===t.id ? 'bg-[#1E2A42] text-[#F0F4FF]' : 'text-[#8892AA] hover:text-[#F0F4FF]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* UPLOAD + PROCESO */}
        <div className="lg:col-span-3 space-y-4">

          {/* Período nómina */}
          {tab === 'nomina' && (
            <div className="bg-[#141C2E] border border-white/7 rounded-xl p-4">
              <div className="text-sm font-bold mb-3" style={{ fontFamily:'Syne,sans-serif' }}>📅 Período de nómina</div>
              <div className="grid grid-cols-2 gap-3">
                <select value={mes} onChange={e => setMes(e.target.value)} className={selCls}>
                  {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={anio} onChange={e => setAnio(e.target.value)} className={selCls}>
                  {[2025,2024,2023].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* DROP ZONE */}
          <div
            onClick={() => !file && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all
              ${file ? 'border-[#00E5B0]/40 bg-[#00E5B0]/4' :
                drag ? 'border-[#00E5B0]/40 bg-[#00E5B0]/4' :
                'border-white/10 hover:border-[#00E5B0]/25 hover:bg-[#00E5B0]/2 cursor-pointer'}`}>
            <input ref={fileRef} type="file" className="hidden"
                   accept=".xlsx,.xls,.csv" onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div>
                <div className="text-3xl mb-2">📊</div>
                <div className="text-sm font-semibold text-[#00E5B0]">{file.name}</div>
                <div className="text-xs text-[#8892AA] mt-1">{(file.size/1024).toFixed(1)} KB · Listo para procesar</div>
                <button onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
                        className="mt-3 text-xs text-[#FF5078] hover:underline flex items-center gap-1 mx-auto">
                  <X size={12}/> Quitar archivo
                </button>
              </div>
            ) : (
              <div>
                <Upload size={32} className="mx-auto mb-3 text-[#8892AA]" />
                <div className="text-sm font-semibold text-[#F0F4FF] mb-1">Arrastra tu archivo aquí</div>
                <div className="text-xs text-[#8892AA] mb-3">{TABS.find(t=>t.id===tab)?.hint}</div>
                <div className="flex gap-2 justify-center">
                  {['.xlsx','.xls','.csv'].map(e => (
                    <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5
                                            border border-white/7 text-[#8892AA]">{e}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PASOS DE PROCESAMIENTO */}
          <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/4">
              <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>⚙️ Procesamiento automático</span>
            </div>
            <div className="p-4 space-y-3">
              {PASOS.map((p, i) => {
                const done   = resultado?.ok && i <= paso;
                const active = processing && i === paso;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs
                      font-bold border transition-all mt-0.5
                      ${done   ? 'bg-[#00E5B0] border-[#00E5B0] text-[#0A0E1A]' :
                        active ? 'border-[#3D7BFF] text-[#3D7BFF]' :
                        'border-white/15 text-[#8892AA]'}`}>
                      {done ? '✓' : active ? <Loader2 size={12} className="animate-spin"/> : i+1}
                    </div>
                    <div className="pt-0.5">
                      <div className={`text-sm ${active ? 'text-[#3D7BFF]' : done ? 'text-[#F0F4FF]' : 'text-[#8892AA]'}`}>{p}</div>
                    </div>
                  </div>
                );
              })}

              <button onClick={procesar} disabled={!file || processing}
                      className="w-full mt-2 py-2.5 bg-[#00E5B0] text-[#0A0E1A] rounded-xl text-sm
                                 font-semibold flex items-center justify-center gap-2 transition-all
                                 hover:shadow-[0_6px_20px_rgba(0,229,176,0.3)] hover:-translate-y-0.5
                                 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
                {processing ? <><Loader2 size={15} className="animate-spin"/> Procesando...</>
                            : <><FileSpreadsheet size={15}/> Procesar archivo</>}
              </button>
            </div>
          </div>

          {/* RESULTADO */}
          {resultado?.ok && (
            <div className="bg-[#00E5B0]/5 border border-[#00E5B0]/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-[#00E5B0]" />
                <span className="text-sm font-bold text-[#00E5B0]" style={{ fontFamily:'Syne,sans-serif' }}>
                  ¡Procesado correctamente!
                </span>
              </div>
              <p className="text-xs text-[#8892AA]">
                Los registros han sido clasificados en el PUC colombiano y están disponibles en los reportes.
              </p>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 py-2 bg-[#00E5B0]/10 text-[#00E5B0] rounded-lg text-xs font-medium
                                   hover:bg-[#00E5B0]/20 transition-colors">
                  👁 Ver libro diario
                </button>
                <button className="flex-1 py-2 bg-[#00E5B0] text-[#0A0E1A] rounded-lg text-xs font-medium
                                   hover:shadow-[0_4px_12px_rgba(0,229,176,0.3)] transition-all">
                  ⬇️ Exportar asientos
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-2 space-y-4">

          {/* RESUMEN TAB */}
          <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/4">
              <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>📈 Resumen del mes</span>
            </div>
            <div className="p-4 space-y-3">
              {tab === 'ingresos' && (
                <>
                  <ResumenBar label="Ventas de servicios (4135)" valor="$98.3M" pct={66} color="#00E5B0" />
                  <ResumenBar label="Arrendamientos (4155)"      valor="$32.1M" pct={22} color="#3D7BFF" />
                  <ResumenBar label="Anticipos (2805)"           valor="$17.9M" pct={12} color="#FFB800" />
                  <div className="flex justify-between pt-3 border-t border-white/7">
                    <span className="text-xs text-[#8892AA]">Total</span>
                    <span className="font-black text-[#00E5B0]" style={{ fontFamily:'Syne,sans-serif' }}>$148.3M</span>
                  </div>
                </>
              )}
              {tab === 'gastos' && (
                <>
                  <ResumenBar label="Costos directos (6xxx)" valor="$35.9M" pct={40} color="#FF5078" />
                  <ResumenBar label="Nómina y prest. (51xx)" valor="$22.4M" pct={25} color="#3D7BFF" />
                  <ResumenBar label="Gastos admon (52xx)"    valor="$16.1M" pct={18} color="#FFB800" />
                  <ResumenBar label="Otros"                  valor="$15.3M" pct={17} color="#8892AA" />
                  <div className="flex justify-between pt-3 border-t border-white/7">
                    <span className="text-xs text-[#8892AA]">Total</span>
                    <span className="font-black text-[#FF5078]" style={{ fontFamily:'Syne,sans-serif' }}>$89.7M</span>
                  </div>
                </>
              )}
              {tab === 'nomina' && (
                <>
                  {[
                    { k:'Salarios básicos',    v:'$12.400.000', c:'#F0F4FF' },
                    { k:'Aportes salud (8.5%)',v:'$1.054.000', c:'#FF5078' },
                    { k:'Aportes pensión',     v:'$1.488.000', c:'#FF5078' },
                    { k:'Parafiscales (9%)',   v:'$1.116.000', c:'#FF5078' },
                    { k:'Prima / Cesantías',   v:'$2.066.000', c:'#FFB800' },
                    { k:'Neto a pagar',        v:'$11.340.000', c:'#00E5B0' },
                  ].map(r => (
                    <div key={r.k} className="flex justify-between text-xs border-b border-white/4 pb-1.5">
                      <span className="text-[#8892AA]">{r.k}</span>
                      <span className="font-semibold" style={{ color: r.c }}>{r.v}</span>
                    </div>
                  ))}
                </>
              )}
              {tab === 'bancario' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-[#8892AA]">Conciliados</span><span className="text-[#00E5B0] font-semibold">142 ✓</span></div>
                  <div className="flex justify-between text-xs"><span className="text-[#8892AA]">En revisión</span><span className="text-[#FFB800] font-semibold">7 ⚠</span></div>
                  <div className="flex justify-between text-xs"><span className="text-[#8892AA]">Sin cruce</span><span className="text-[#FF5078] font-semibold">3 ✗</span></div>
                  <div className="mt-2 bg-white/5 rounded-lg h-2 overflow-hidden">
                    <div className="h-full bg-[#00E5B0] rounded-lg" style={{ width:'94%' }} />
                  </div>
                  <div className="text-[10px] text-[#8892AA] text-right">94% conciliado</div>
                </div>
              )}
            </div>
          </div>

          {/* HISTORIAL */}
          <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/4">
              <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>📋 Historial de cargas</span>
            </div>
            <div className="divide-y divide-white/4">
              {(historial?.archivos || []).slice(0,5).map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <FileSpreadsheet size={14} className="text-[#8892AA] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#F0F4FF] truncate">{a.nombre_original}</div>
                    <div className="text-[10px] text-[#8892AA]">
                      {a.modulo} · {a.filas_ok} registros · {new Date(a.created_at).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0
                    ${a.estado==='completado' ? 'bg-[#00E5B0]/10 text-[#00E5B0]'
                    : a.estado==='error'      ? 'bg-[#FF5078]/10 text-[#FF5078]'
                    : 'bg-[#FFB800]/10 text-[#FFB800]'}`}>
                    {a.estado}
                  </span>
                </div>
              ))}
              {(!historial?.archivos?.length) && (
                <div className="text-center py-6 text-xs text-[#8892AA]">Sin cargas anteriores</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumenBar({ label, valor, pct, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#8892AA] truncate max-w-[65%]">{label}</span>
        <span className="font-semibold text-[#F0F4FF]">{valor}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width:`${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── IVA PAGE ──────────────────────────────────────────────────────────────────
export function IVAPage() {
  const [tab, setTab] = useState('iva');
  const { empresaActual } = useEmpresaStore();
  const now = new Date();

  const bimestreActual = Math.ceil((now.getMonth() + 1) / 2);

  const { data: ivaData, isLoading, refetch } = useQuery({
    queryKey: ['iva', empresaActual?.id, bimestreActual],
    queryFn: async () => {
      const { ivaService } = await import('../services/api');
      return ivaService.periodos().then(r => r.data);
    },
    enabled: !!empresaActual?.id,
  });

  const calcular = async () => {
    try {
      const { ivaService } = await import('../services/api');
      await ivaService.calcular(bimestreActual, now.getFullYear());
      toast.success('IVA calculado correctamente');
      refetch();
    } catch { toast.error('Error calculando IVA'); }
  };

  const BIMESTRES_LABELS = ['','Ene–Feb','Mar–Abr','May–Jun','Jul–Ago','Sep–Oct','Nov–Dic'];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="IVA, Retenciones &" highlight="Formularios DIAN" sub={empresaActual?.razon_social}>
        <button className="flex items-center gap-2 bg-[#00E5B0] text-[#0A0E1A] px-4 py-2 rounded-xl
                           text-sm font-semibold hover:shadow-[0_6px_20px_rgba(0,229,176,0.3)] transition-all">
          📤 Presentar ante DIAN
        </button>
      </PageHeader>

      <div className="flex gap-1 bg-[#141C2E] border border-white/7 rounded-xl p-1 mb-6 w-fit">
        {[['iva','📋 IVA'],['retenciones','🔖 Retenciones'],['formularios','📄 Formularios']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${tab===t ? 'bg-[#1E2A42] text-[#F0F4FF]' : 'text-[#8892AA] hover:text-[#F0F4FF]'}`}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'IVA generado', valor:'$22.140.000', color:'#FFB800', hint:'Bimestre actual' },
          { label:'IVA descontable', valor:'$13.820.000', color:'#3D7BFF', hint:'Compras del período' },
          { label:'IVA a pagar', valor:'$8.320.000', color:'#FF5078', hint:'⚠ Vence en 8 días' },
        ].map(k => (
          <div key={k.label} className="bg-[#141C2E] border border-white/7 rounded-xl p-4">
            <div className="text-xs text-[#8892AA] mb-2">{k.label}</div>
            <div className="text-xl font-black mb-1" style={{ fontFamily:'Syne,sans-serif', color: k.color }}>{k.valor}</div>
            <div className="text-xs" style={{ color: k.color === '#FF5078' ? '#FF5078' : '#8892AA' }}>{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/4 flex items-center justify-between">
            <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>
              📊 Desglose IVA — Bimestre {BIMESTRES_LABELS[bimestreActual]} {now.getFullYear()}
            </span>
            <button onClick={calcular} className="text-xs text-[#00E5B0] hover:underline">Recalcular</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Tarifa','Base gravable','IVA generado','IVA descontable','Saldo'].map(h => (
                    <th key={h} className="text-[10px] font-semibold uppercase tracking-wider text-[#8892AA]
                                           text-left px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { tarifa:'19%', base:'$98.400k', gen:'$18.696k', desc:'$10.320k', saldo:'$8.376k', saldoColor:'#FF5078' },
                  { tarifa:'5%',  base:'$24.200k', gen:'$1.210k',  desc:'$1.266k',  saldo:'-$56k',   saldoColor:'#00E5B0' },
                  { tarifa:'0%',  base:'$13.400k', gen:'$0',       desc:'$2.234k',  saldo:'-$2.234k',saldoColor:'#00E5B0' },
                  { tarifa:'Excl',base:'$18.000k', gen:'$0',       desc:'$0',       saldo:'$0',      saldoColor:'#8892AA' },
                ].map((r, i) => (
                  <tr key={i} className="border-b border-white/4 hover:bg-white/2">
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                       bg-[#FFB800]/10 text-[#FFB800]">{r.tarifa}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#F0F4FF]">{r.base}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#FFB800]">{r.gen}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#3D7BFF]">{r.desc}</td>
                    <td className="px-4 py-2.5 text-xs font-bold" style={{ color: r.saldoColor }}>{r.saldo}</td>
                  </tr>
                ))}
                <tr className="bg-white/2 font-bold">
                  <td className="px-4 py-3 text-xs font-bold text-[#F0F4FF]">TOTAL</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#F0F4FF]">$154.000k</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#FFB800]">$19.906k</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#3D7BFF]">$13.820k</td>
                  <td className="px-4 py-3 text-base font-black text-[#FF5078]">$8.320k</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulario 300 visual */}
        <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/4 flex items-center justify-between">
            <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>📄 Formulario 300</span>
            <span className="text-[10px] bg-[#00E5B0]/10 text-[#00E5B0] px-2 py-0.5 rounded-full">Auto-diligenciado</span>
          </div>
          <div className="p-4">
            <div className="bg-[#0D1525] rounded-xl overflow-hidden border border-white/5">
              <div className="bg-gradient-to-r from-[#0a3a7a] to-[#0c1e3d] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-white/40 uppercase tracking-widest">República de Colombia — DIAN</div>
                    <div className="text-sm font-bold text-white">Declaración de IVA bimestral</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-[#00E5B0]">300</div>
                    <div className="text-[10px] text-white/40">Form. oficial</div>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label:'Casilla 66 — Base gravada 19%', val:'98.400.000' },
                  { label:'Casilla 67 — IVA generado 19%', val:'18.696.000' },
                  { label:'Casilla 71 — Base gravada 5%',  val:'24.200.000' },
                  { label:'Casilla 82 — IVA descontable',  val:'13.820.000' },
                ].map(f => (
                  <div key={f.label}>
                    <div className="text-[9px] text-[#8892AA] mb-0.5">{f.label}</div>
                    <div className="bg-[#00E5B0]/8 border border-[#00E5B0]/15 rounded-lg px-3 py-1.5
                                    text-sm font-bold text-[#00E5B0]">{f.val}</div>
                  </div>
                ))}
                <div className="bg-[#00E5B0]/10 border border-[#00E5B0]/25 rounded-xl px-4 py-3
                                flex items-center justify-between mt-3">
                  <span className="text-xs text-[#00E5B0]">Casilla 89 — Total a pagar</span>
                  <span className="text-xl font-black text-[#00E5B0]">$8.320.000</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className="py-2 border border-white/10 rounded-xl text-xs text-[#F0F4FF]
                                 hover:bg-[#1E2A42] transition-colors">✏️ Editar casillas</button>
              <button className="py-2 bg-[#00E5B0] text-[#0A0E1A] rounded-xl text-xs font-semibold
                                 hover:shadow-[0_4px_12px_rgba(0,229,176,0.3)] transition-all">📤 Presentar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DIAN PAGE ─────────────────────────────────────────────────────────────────
export function DIANPage() {
  const [modalFE, setModalFE] = useState(false);
  const [loadingFE, setLoadingFE] = useState(false);
  const [formFE, setFormFE] = useState({
    receptor_nit: '', receptor_nombre: '', descripcion: '',
    subtotal: '', iva_tarifa: '19', fecha_emision: new Date().toISOString().slice(0,10)
  });
  const { empresaActual } = useEmpresaStore();
  const { data: resumen } = useQuery({
    queryKey: ['dian-resumen', empresaActual?.id],
    queryFn: () => import('../services/api').then(m => m.dianService.resumen().then(r => r.data)),
    enabled: !!empresaActual?.id,
  });
  const { data: feData } = useQuery({
    queryKey: ['fe', empresaActual?.id],
    queryFn: () => import('../services/api').then(m => m.dianService.listarFE({ limit: 10 }).then(r => r.data)),
    enabled: !!empresaActual?.id,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="DIAN &" highlight="Facturación Electrónica" sub={empresaActual?.razon_social}>
       <button onClick={() => setModalFE(true)}
        className="flex items-center gap-2 bg-[#3D7BFF] text-white px-4 py-2 rounded-xl
                   text-sm font-semibold hover:shadow-[0_6px_20px_rgba(61,123,255,0.3)] transition-all">
  📤 Emitir FE
</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label:'FE recibidas', val: resumen?.fe_recibidas || 0, color:'#00E5B0' },
          { label:'FE emitidas',  val: resumen?.fe_emitidas  || 0, color:'#3D7BFF' },
          { label:'Total recibidas', val: fmt.copM(resumen?.total_recibidas || 0), color:'#FFB800' },
          { label:'Total emitidas',  val: fmt.copM(resumen?.total_emitidas  || 0), color:'#00E5B0' },
          { label:'Pendientes DIAN', val: resumen?.pendientes_dian || 0, color:'#FF5078' },
        ].map(k => (
          <div key={k.label} className="bg-[#141C2E] border border-white/7 rounded-xl p-3">
            <div className="text-[10px] text-[#8892AA] mb-1.5">{k.label}</div>
            <div className="text-lg font-black" style={{ fontFamily:'Syne,sans-serif', color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/4 flex items-center justify-between">
          <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>🧾 Facturas electrónicas</span>
          <div className="flex gap-2">
            <span className="text-[10px] bg-[#00E5B0]/10 text-[#00E5B0] px-2 py-0.5 rounded-full">Recibidas</span>
            <span className="text-[10px] bg-[#3D7BFF]/10 text-[#3D7BFF] px-2 py-0.5 rounded-full">Emitidas</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Número FE','Tipo','Empresa','Fecha','Total','Estado'].map(h => (
                  <th key={h} className="text-[10px] font-semibold uppercase tracking-wider text-[#8892AA]
                                         text-left px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(feData?.facturas || DEMO_FE).map((fe, i) => (
                <tr key={i} className="border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#00E5B0]">{fe.numero_fe || fe.numero}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium
                      ${fe.tipo==='recibida' ? 'bg-[#3D7BFF]/10 text-[#3D7BFF]'
                      : fe.tipo==='emitida'  ? 'bg-[#00E5B0]/10 text-[#00E5B0]'
                      : 'bg-[#FFB800]/10 text-[#FFB800]'}`}>{fe.tipo}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#F0F4FF] max-w-[150px] truncate">
                    {fe.tipo==='recibida' ? fe.emisor_nombre : fe.receptor_nombre}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#8892AA]">
                    {fe.fecha_emision ? new Date(fe.fecha_emision).toLocaleDateString('es-CO') : fe.fecha}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold text-[#00E5B0]">
                    {fmt.cop(fe.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="bg-[#00E5B0]/10 text-[#00E5B0] px-2 py-0.5 rounded-full text-[10px]">
                      {fe.estado_dian || 'Válida'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const DEMO_FE = [
  { numero:'FE-2025-0421', tipo:'recibida', emisor_nombre:'Inversiones Alfa SAS', fecha:'02/05/2025', total:33796000, estado_dian:'aceptada' },
  { numero:'FE-2025-0389', tipo:'recibida', emisor_nombre:'Argos S.A.',           fecha:'03/05/2025', total:11745000, estado_dian:'aceptada' },
  { numero:'FV-2025-0089', tipo:'emitida',  receptor_nombre:'Constructores XYZ',   fecha:'05/05/2025', total:53550000, estado_dian:'aceptada' },
  { numero:'FV-2025-0088', tipo:'emitida',  receptor_nombre:'Inversiones Alfa',    fecha:'06/05/2025', total:33796000, estado_dian:'aceptada' },
  { numero:'FV-2025-0087', tipo:'emitida',  receptor_nombre:'Arrendatario A3',     fecha:'07/05/2025', total:3808000,  estado_dian:'pendiente' },
];

// ── NOMINA PAGE ───────────────────────────────────────────────────────────────
export function NominaPage() {
  const { empresaActual } = useEmpresaStore();
  const { data } = useQuery({
    queryKey: ['nomina-periodos', empresaActual?.id],
    queryFn: () => import('../services/api').then(m => m.nominaService.periodos().then(r => r.data)),
    enabled: !!empresaActual?.id,
  });

  const periodos = data?.periodos || [];
  const ultimo = periodos[0];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Nómina &" highlight="PILA" sub={empresaActual?.razon_social}>
   <button onClick={async () => { if (!ultimo) return toast.error('No hay períodos de nómina'); try { const { data } = await nominaService.generarPILA(ultimo.id); descargarBlob(data, `pila_${ultimo.mes}_${ultimo.anio}.xlsx`); toast.success('PILA generada correctamente'); } catch { toast.error('Error generando PILA'); } }} className="flex items-center gap-2 bg-[#00E5B0] text-[#0A0E1A] px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-[0_6px_20px_rgba(0,229,176,0.3)]">
  📄 Generar PILA
</button>
      </PageHeader>

      {ultimo ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { k:'Empleados',    v: ultimo.total_empleados,  c:'#00E5B0' },
            { k:'Costo total',  v: fmt.cop(ultimo.costo_total), c:'#FF5078' },
            { k:'Neto a pagar', v: fmt.cop(ultimo.total_neto),  c:'#3D7BFF' },
            { k:'ReteFuente',   v: fmt.cop(ultimo.total_retefuente), c:'#FFB800' },
          ].map(k => (
            <div key={k.k} className="bg-[#141C2E] border border-white/7 rounded-xl p-4">
              <div className="text-xs text-[#8892AA] mb-2">{k.k}</div>
              <div className="text-xl font-black" style={{ fontFamily:'Syne,sans-serif', color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#141C2E] border border-white/7 rounded-xl p-12 text-center mb-6">
          <div className="text-4xl mb-3">👥</div>
          <div className="font-bold text-[#F0F4FF] mb-2">Sin períodos de nómina</div>
          <p className="text-sm text-[#8892AA]">Carga tu primer archivo de nómina desde el módulo Excel.</p>
        </div>
      )}

      <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/4">
          <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>📋 Períodos de nómina</span>
        </div>
        {periodos.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Período','Empleados','Salarios','Parafiscales','Neto','Estado',''].map(h => (
                  <th key={h} className="text-[10px] font-semibold uppercase tracking-wider text-[#8892AA]
                                         text-left px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.map((p, i) => (
                <tr key={i} className="border-b border-white/4 hover:bg-white/2">
                  <td className="px-4 py-2.5 text-sm font-semibold text-[#F0F4FF]">
                    {MESES[p.mes-1]} {p.anio}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#8892AA]">{p.total_empleados}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-[#F0F4FF]">{fmt.cop(p.total_salarios)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#FF5078]">{fmt.cop(p.total_parafiscales)}</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-[#00E5B0]">{fmt.cop(p.total_neto)}</td>
                  <td className="px-4 py-2.5">
                    <span className="bg-[#00E5B0]/10 text-[#00E5B0] px-2 py-0.5 rounded-full text-[10px]">
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button className="text-xs text-[#3D7BFF] hover:underline">PILA →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-xs text-[#8892AA]">Sin datos</div>
        )}
      </div>
    </div>
  );
}

// ── REPORTES PAGE ─────────────────────────────────────────────────────────────
export function ReportesPage() {
  const [tab, setTab] = useState('balance');
  const { empresaActual } = useEmpresaStore();

  const { data: balance } = useQuery({
    queryKey: ['balance', empresaActual?.id],
    queryFn: () => import('../services/api').then(m => m.reportesService.balance().then(r => r.data)),
    enabled: !!empresaActual?.id && tab === 'balance',
  });

  const { data: pyg } = useQuery({
    queryKey: ['pyg', empresaActual?.id],
    queryFn: () => import('../services/api').then(m => m.reportesService.pyg().then(r => r.data)),
    enabled: !!empresaActual?.id && tab === 'pyg',
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Reportes" highlight="Contables" sub={empresaActual?.razon_social}>
       <button onClick={async () => { try { const { data } = await reportesService.exportar(tab); descargarBlob(data, `contaflow_${tab}_${new Date().toISOString().slice(0,10)}.xlsx`); } catch { toast.error('Error exportando'); } }}
        className="flex items-center gap-2 bg-transparent border border-white/10 text-[#F0F4FF]
                   px-3 py-2 rounded-xl text-sm hover:bg-[#1E2A42] transition-colors">
  <Download size={14}/> Exportar Excel
</button>
      </PageHeader>

      <div className="flex gap-1 bg-[#141C2E] border border-white/7 rounded-xl p-1 mb-6 w-fit">
        {[['balance','📊 Balance'],['pyg','📈 P&G'],['libro','📚 Libro Mayor']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${tab===t ? 'bg-[#1E2A42] text-[#F0F4FF]' : 'text-[#8892AA] hover:text-[#F0F4FF]'}`}>{l}</button>
        ))}
      </div>

      {tab === 'balance' && (
        <div className="grid grid-cols-2 gap-5">
          {[
            { title:'🟢 ACTIVOS', items: [
              { cuenta:'1105', desc:'Caja', saldo:'$12.400.000', color:'#F0F4FF' },
              { cuenta:'1110', desc:'Bancos — Bancolombia', saldo:'$84.320.000', color:'#F0F4FF' },
              { cuenta:'1305', desc:'Clientes — cartera', saldo:'$224.800.000', color:'#F0F4FF' },
              { cuenta:'1470', desc:'Inventarios materiales', saldo:'$142.420.000', color:'#F0F4FF' },
              { cuenta:'1516', desc:'Construcciones en curso', saldo:'$198.400.000', color:'#F0F4FF' },
            ], total:'$824.340.000', totalColor:'#00E5B0' },
            { title:'🔴 PASIVOS + PATRIMONIO', items: [
              { cuenta:'2205', desc:'Proveedores', saldo:'$68.400.000', color:'#FF5078' },
              { cuenta:'2365', desc:'ReteFuente por pagar', saldo:'$4.218.000', color:'#FF5078' },
              { cuenta:'2368', desc:'IVA por pagar', saldo:'$8.320.000', color:'#FF5078' },
              { cuenta:'3105', desc:'Capital suscrito', saldo:'$200.000.000', color:'#3D7BFF' },
              { cuenta:'3605', desc:'Utilidad del ejercicio', saldo:'$58.600.000', color:'#00E5B0' },
            ], total:'$824.340.000', totalColor:'#00E5B0' },
          ].map(col => (
            <div key={col.title} className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/4">
                <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>{col.title}</span>
              </div>
              <div className="divide-y divide-white/4">
                {col.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2">
                    <span className="font-mono text-[10px] text-[#8892AA] w-10 flex-shrink-0">{item.cuenta}</span>
                    <span className="flex-1 text-xs text-[#F0F4FF] truncate">{item.desc}</span>
                    <span className="text-xs font-bold" style={{ color: item.color }}>{item.saldo}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-4 py-3 border-t-2 border-white/10">
                <span className="text-sm font-bold text-[#F0F4FF]">TOTAL</span>
                <span className="text-lg font-black" style={{ fontFamily:'Syne,sans-serif', color: col.totalColor }}>
                  {col.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'pyg' && (
        <div className="bg-[#141C2E] border border-white/7 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/4">
            <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>
              📋 Estado de Resultados — {pyg ? `${pyg.periodo?.desde} al ${pyg.periodo?.hasta}` : 'Enero–Abril 2025'}
            </span>
          </div>
          <div className="p-4 space-y-1">
            {[
              { label:'INGRESOS OPERACIONALES', val: pyg?.ingresos || 483200000, type:'section', color:'#00E5B0' },
              { label:'(-) COSTOS DE VENTAS',   val: pyg?.costos  || 238400000, type:'section', color:'#FF5078' },
              { label:'UTILIDAD BRUTA',          val: pyg?.utilidad_bruta || 244800000, type:'total', color:'#00E5B0' },
              { label:'(-) Gastos administración', val: pyg?.gastos_admon || 74400000, type:'normal', color:'#FF5078' },
              { label:'(-) Gastos de ventas',     val: pyg?.gastos_ventas || 16100000, type:'normal', color:'#FF5078' },
              { label:'(-) Nómina y prestaciones',val: pyg?.nomina || 57700000, type:'normal', color:'#FF5078' },
              { label:'UTILIDAD OPERACIONAL',     val: pyg?.utilidad_operacional || 96600000, type:'total', color:'#3D7BFF' },
              { label:'(-) Gastos financieros',   val: pyg?.gastos_financieros || 18400000, type:'normal', color:'#FF5078' },
              { label:'UTILIDAD ANTES IMPUESTOS', val: pyg?.utilidad_antes_impuestos || 78200000, type:'total', color:'#FFB800' },
              { label:'(-) Impuesto de renta (35%)',val:pyg?.impuesto_renta || 27370000, type:'normal', color:'#FF5078' },
              { label:'UTILIDAD NETA DEL EJERCICIO',val:pyg?.utilidad_neta || 50830000, type:'grand', color:'#00E5B0' },
            ].map((r, i) => (
              <div key={i} className={`flex justify-between px-3 py-2 rounded-lg text-sm
                ${r.type==='section' ? 'bg-[#1E2A42] font-semibold'
                : r.type==='total'  ? 'font-bold border-t border-white/10'
                : r.type==='grand'  ? 'bg-[#00E5B0]/8 border border-[#00E5B0]/20 font-black text-base mt-2'
                : ''}`}>
                <span className={r.type==='grand' ? 'text-[#F0F4FF]' : r.type==='section' ? 'text-[#F0F4FF]' : 'text-[#8892AA]'}>
                  {r.label}
                </span>
                <span className="font-black" style={{ fontFamily:'Syne,sans-serif', color: r.color }}>
                  {fmt.cop(r.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'libro' && (
        <div className="bg-[#141C2E] border border-white/7 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">📚</div>
          <div className="font-bold text-[#F0F4FF] mb-2">Libro Mayor por cuenta</div>
          <p className="text-sm text-[#8892AA] mb-4">Selecciona una cuenta del PUC para ver su auxiliar completo.</p>
          <input placeholder="🔍 Buscar cuenta o código PUC..." className={`${inputBaseCls} max-w-sm mx-auto`} />
        </div>
      )}
    </div>
  );
}

// ── ASISTENTE IA PAGE ─────────────────────────────────────────────────────────
export function AsistentePage() {
  const [msgs, setMsgs]   = useState([
    { rol:'assistant', contenido:'¡Hola! Soy tu asistente contable ContaFlow. Conozco la normativa tributaria colombiana, el PUC y las NIIF para PYMES.\n\nPuedo ayudarte con:\n• Retenciones e IVA\n• Clasificación PUC\n• Vencimientos DIAN\n• Estrategia tributaria\n\n¿Qué necesitas hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoad] = useState(false);
  const bottomRef          = useRef();
  const { empresaActual }  = useEmpresaStore();

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    setMsgs(p => [...p, { rol:'user', contenido: msg }]);
    setLoad(true);
    try {
      const { iaService } = await import('../services/api');
      const { data } = await iaService.chat(msg);
      setMsgs(p => [...p, { rol:'assistant', contenido: data.respuesta }]);
    } catch {
      setMsgs(p => [...p, { rol:'assistant', contenido: 'Lo siento, ocurrió un error. Intenta de nuevo.' }]);
    } finally { setLoad(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 100); }
  };

  const QUICK = [
    '¿Cuál es la tarifa de ReteFuente para honorarios?',
    '¿Cuándo vence el IVA bimestral?',
    '¿Cómo clasifico un gasto de software en el PUC?',
    '¿Qué es el régimen SIMPLE de tributación?',
    'Explícame los indicadores financieros clave',
  ];

  return (
    <div className="h-[calc(100vh-56px)] flex" style={{ maxHeight:'calc(100vh - 56px)' }}>
      {/* CHAT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/7 bg-[#0D1525] flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#00E5B0]/15 flex items-center justify-center text-lg">🤖</div>
          <div>
            <div className="text-sm font-bold text-[#F0F4FF]">Asistente ContaFlow IA</div>
            <div className="flex items-center gap-1.5 text-xs text-[#00E5B0]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00E5B0] animate-pulse" />
              En línea · Normativa colombiana actualizada
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-2.5 max-w-[80%] ${m.rol==='user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1
                ${m.rol==='user' ? 'bg-[#3D7BFF]/20' : 'bg-[#00E5B0]/15'}`}>
                {m.rol==='user' ? '👤' : '🤖'}
              </div>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                ${m.rol==='user'
                  ? 'bg-[#3D7BFF]/15 border border-[#3D7BFF]/20 rounded-tr-sm text-[#F0F4FF]'
                  : 'bg-[#141C2E] border border-white/7 rounded-tl-sm text-[#F0F4FF]'}`}>
                {m.contenido}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2.5 max-w-[80%]">
              <div className="w-7 h-7 rounded-full bg-[#00E5B0]/15 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
              <div className="px-4 py-3 bg-[#141C2E] border border-white/7 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#8892AA]"
                         style={{ animation:`bounce 1s ${i*0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        <div className="px-4 py-2 border-t border-white/4 flex gap-2 overflow-x-auto flex-shrink-0">
          {QUICK.map((q, i) => (
            <button key={i} onClick={() => send(q)}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-[#141C2E] border border-white/7
                               text-[#8892AA] hover:border-[#00E5B0]/25 hover:text-[#00E5B0] transition-all
                               whitespace-nowrap flex-shrink-0">
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/7 bg-[#0D1525] flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Pregunta sobre contabilidad, tributación colombiana, DIAN..."
                      rows={1} className={`flex-1 resize-none ${inputBaseCls}`}
                      style={{ maxHeight:'100px' }} />
            <button onClick={() => send()} disabled={!input.trim() || loading}
                    className="w-10 h-10 rounded-xl bg-[#00E5B0] flex items-center justify-center
                               text-[#0A0E1A] hover:shadow-[0_4px_14px_rgba(0,229,176,0.35)]
                               disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
              {loading ? <Loader2 size={16} className="animate-spin"/> : '➤'}
            </button>
          </div>
        </div>
      </div>

      {/* SIDEBAR ALERTAS */}
      <div className="w-72 border-l border-white/7 bg-[#0D1525] flex flex-col overflow-y-auto flex-shrink-0">
        <div className="px-4 py-3 border-b border-white/7">
          <span className="text-sm font-bold" style={{ fontFamily:'Syne,sans-serif' }}>💡 Alertas IA</span>
        </div>
        <div className="p-4 space-y-3 flex-1">
          {[
            { tipo:'danger', icon:'⚠️', titulo:'IVA vence en 8 días', desc:'$8.320.000 · Form. 300 pre-liquidado' },
            { tipo:'warning',icon:'📉', titulo:'Margen bajó 2.3 pts', desc:'Posible alza en costos de materiales' },
            { tipo:'success',icon:'✅', titulo:'Conciliación 94%',    desc:'Revisar 3 partidas pendientes' },
          ].map((a, i) => (
            <div key={i} className={`p-3 rounded-xl border text-xs
              ${a.tipo==='danger'  ? 'bg-[#FF5078]/5 border-[#FF5078]/15'
              : a.tipo==='warning' ? 'bg-[#FFB800]/5 border-[#FFB800]/15'
              : 'bg-[#00E5B0]/5 border-[#00E5B0]/15'}`}>
              <div className={`font-semibold mb-1 flex items-center gap-1.5
                ${a.tipo==='danger' ? 'text-[#FF5078]' : a.tipo==='warning' ? 'text-[#FFB800]' : 'text-[#00E5B0]'}`}>
                {a.icon} {a.titulo}
              </div>
              <div className="text-[#8892AA]">{a.desc}</div>
            </div>
          ))}

          <div className="border-t border-white/7 pt-3">
            <div className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-3">Normativa reciente</div>
            {[
              { dec:'Decreto 0175/2025', desc:'Nuevos plazos declaración renta personas naturales' },
              { dec:'Resolución DIAN',  desc:'Actualización tarifas ReteICA 2025' },
            ].map((n, i) => (
              <div key={i} className="mb-2.5">
                <div className="text-xs font-semibold text-[#3D7BFF]">{n.dec}</div>
                <div className="text-[10px] text-[#8892AA]">{n.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:0.4}50%{transform:translateY(-4px);opacity:1}}`}</style>
    </div>
  );
}

// ── CONFIG PAGE ───────────────────────────────────────────────────────────────
export function ConfigPage() {
  const { empresaActual } = useEmpresaStore();
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Configuración" highlight="del sistema" sub={empresaActual?.razon_social} />
      <div className="space-y-4">
        {[
          { title:'🏢 Datos de la empresa', desc:'NIT, régimen, dirección, CIIU', action:'Editar' },
          { title:'🔑 Token DIAN',         desc:'Certificado digital y conexión', action:'Gestionar' },
          { title:'👥 Usuarios y roles',   desc:'Invitar contador o auxiliar',    action:'Gestionar' },
          { title:'📊 Plan de cuentas',    desc:'PUC personalizado',              action:'Ver PUC' },
          { title:'🔔 Notificaciones',     desc:'Alertas de vencimientos DIAN',   action:'Configurar' },
          { title:'🔒 Seguridad',          desc:'Contraseña y 2FA',               action:'Cambiar' },
        ].map((s, i) => (
          <div key={i} className="bg-[#141C2E] border border-white/7 rounded-xl p-4
                                   flex items-center justify-between hover:border-white/12 transition-colors">
            <div>
              <div className="text-sm font-semibold text-[#F0F4FF]">{s.title}</div>
              <div className="text-xs text-[#8892AA] mt-0.5">{s.desc}</div>
            </div>
           <button onClick={() => toast.success(`${s.action}: próximamente disponible`)} className="text-xs text-[#00E5B0] font-medium hover:underline">{s.action} →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ONBOARDING PAGE ───────────────────────────────────────────────────────────
export function OnboardingPage(){window.location.replace('/dashboard');return null;}

