/**
 * ContaFlow — AuthPage.jsx
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';

const ROLES = [
  { id: 'contador',       icon: '🧮', label: 'Contador',        hint: 'Manejo varios clientes' },
  { id: 'auxiliar',       icon: '📂', label: 'Auxiliar',        hint: 'Apoyo contable' },
  { id: 'empresario',     icon: '🏢', label: 'Empresario',      hint: 'Tengo mi empresa' },
  { id: 'persona_natural',icon: '💼', label: 'Persona natural', hint: 'Independiente' },
];

export default function AuthPage() {
  const [tab, setTab]         = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [rol, setRol]         = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register: registerUser } = useAuthStore();

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const pass = watch('password', '');

  const strength = (p) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strengthColor = ['', '#FF5078', '#FFB800', '#3D7BFF', '#00E5B0'];
  const strengthLabel = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];

  const onLogin = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('¡Bienvenido de vuelta!');
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  const onRegister = async (data) => {
    if (!rol) return toast.error('Selecciona tu rol');
    setLoading(true);
    try {
      await registerUser({ ...data, rol });
      toast.success('¡Cuenta creada! Configura tu empresa.');
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al registrarse');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex" style={{
      backgroundImage: 'linear-gradient(rgba(61,123,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(61,123,255,0.03) 1px,transparent 1px)',
      backgroundSize: '50px 50px'
    }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-[420px] flex-shrink-0 bg-[#0D1525] border-r border-white/7
                      flex-col p-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(0,229,176,0.07) 0%, transparent 70%)' }} />
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(61,123,255,0.07) 0%, transparent 70%)' }} />
        </div>

        <div className="flex items-center gap-2.5 mb-auto relative z-10">
          <div className="w-9 h-9 rounded-xl bg-[#00E5B0] flex items-center justify-center
                          font-black text-[#0A0E1A] text-base">CF</div>
          <span className="font-bold text-lg text-[#F0F4FF]" style={{ fontFamily: 'Syne, sans-serif' }}>ContaFlow</span>
        </div>

        <div className="relative z-10 mb-8">
          <h2 className="text-3xl font-black leading-tight mb-3 text-[#F0F4FF]"
              style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px' }}>
            Tu contabilidad,<br />
            <span className="text-[#00E5B0]">automatizada</span><br />
            en minutos
          </h2>
          <p className="text-[#8892AA] text-sm leading-relaxed font-light">
            Sube tu token DIAN y tus archivos Excel. ContaFlow genera automáticamente tus libros contables y declaraciones.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {[
              { icon: '🔑', title: 'Token DIAN integrado', desc: 'FE descargadas automáticamente' },
              { icon: '📊', title: 'Excel → Contabilidad', desc: 'Clasificación PUC con IA' },
              { icon: '📋', title: 'Formularios pre-diligenciados', desc: '300, 350, 110 listos' },
            ].map((f) => (
              <div key={f.title} className="flex gap-3 p-3 bg-white/3 border border-white/7
                                            rounded-xl hover:border-[#00E5B0]/20 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#00E5B0]/12 flex items-center
                                justify-center text-sm flex-shrink-0">{f.icon}</div>
                <div>
                  <div className="text-sm font-medium text-[#F0F4FF]">{f.title}</div>
                  <div className="text-xs text-[#8892AA]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 bg-white/3 border border-white/7 rounded-xl p-4">
          <p className="text-xs text-[#8892AA] italic leading-relaxed mb-3">
            "Pasé de demorarme 3 días cerrando el mes a hacerlo en 2 horas. ContaFlow es lo que todo contador en Colombia necesitaba."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#00E5B0] flex items-center justify-center
                            text-[#0A0E1A] text-xs font-bold">MC</div>
            <div>
              <div className="text-xs font-medium text-[#F0F4FF]">Marcela Cadena</div>
              <div className="text-[10px] text-[#8892AA]">Contadora Pública · Medellín</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Tabs */}
          <div className="flex gap-1 bg-[#141C2E] border border-white/7 rounded-xl p-1 mb-7">
            {[['login','Ingresar'],['register','Crear cuenta']].map(([t,l]) => (
              <button key={t} onClick={() => setTab(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                        ${tab===t ? 'bg-[#1E2A42] text-[#F0F4FF]' : 'text-[#8892AA] hover:text-[#F0F4FF]'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleSubmit(onLogin)}>
              <h2 className="text-2xl font-black mb-1 text-[#F0F4FF]"
                  style={{ fontFamily:'Syne,sans-serif', letterSpacing:'-0.3px' }}>
                Bienvenido de vuelta
              </h2>
              <p className="text-sm text-[#8892AA] mb-6 font-light">Ingresa a tu cuenta de ContaFlow</p>

              <Field label="Correo electrónico" error={errors.email?.message}>
                <input type="email" placeholder="tucorreo@empresa.com"
                       className={inputCls(errors.email)}
                       {...register('email', { required: 'Email requerido' })} />
              </Field>

              <Field label="Contraseña" error={errors.password?.message}>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••"
                         className={inputCls(errors.password) + ' pr-10'}
                         {...register('password', { required: 'Contraseña requerida' })} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892AA] hover:text-[#F0F4FF]">
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </Field>

              <div className="flex justify-end mb-5">
                <button type="button" className="text-xs text-[#8892AA] hover:text-[#F0F4FF]">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <Btn loading={loading}>
                <ArrowRight size={16}/> Ingresar a ContaFlow
              </Btn>

              <p className="text-center text-xs text-[#8892AA] mt-4">
                ¿No tienes cuenta?{' '}
                <button type="button" onClick={() => setTab('register')}
                        className="text-[#00E5B0] font-medium hover:underline">
                  Regístrate gratis
                </button>
              </p>
            </form>
          )}

          {/* REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleSubmit(onRegister)}>
              <h2 className="text-2xl font-black mb-1 text-[#F0F4FF]"
                  style={{ fontFamily:'Syne,sans-serif', letterSpacing:'-0.3px' }}>
                Crea tu cuenta
              </h2>
              <p className="text-sm text-[#8892AA] mb-5 font-light">Gratis 14 días · Sin tarjeta</p>

              {/* Rol */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-[#8892AA] mb-2">¿Cuál es tu rol? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <button key={r.id} type="button" onClick={() => setRol(r.id)}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border text-left
                              transition-all text-sm
                              ${rol===r.id
                                ? 'border-[#00E5B0] bg-[#00E5B0]/8 text-[#00E5B0]'
                                : 'border-white/7 hover:border-white/15 text-[#F0F4FF]'}`}>
                      <span className="text-lg">{r.icon}</span>
                      <div>
                        <div className="font-medium text-xs">{r.label}</div>
                        <div className="text-[10px] text-[#8892AA]">{r.hint}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre *" error={errors.nombre?.message}>
                  <input placeholder="Juan" className={inputCls(errors.nombre)}
                         {...register('nombre', { required: 'Requerido' })} />
                </Field>
                <Field label="Apellido *" error={errors.apellido?.message}>
                  <input placeholder="Pérez" className={inputCls(errors.apellido)}
                         {...register('apellido', { required: 'Requerido' })} />
                </Field>
              </div>

              <Field label="Correo electrónico *" error={errors.email?.message}>
                <input type="email" placeholder="juan@empresa.com" className={inputCls(errors.email)}
                       {...register('email', { required: 'Email requerido',
                         pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email inválido' } })} />
              </Field>

              <Field label="Contraseña *" error={errors.password?.message}>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                         className={inputCls(errors.password) + ' pr-10'}
                         {...register('password', {
                           required: 'Contraseña requerida',
                           minLength: { value: 8, message: 'Mínimo 8 caracteres' }
                         })} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892AA]">
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                {pass && (
                  <div className="mt-1.5">
                    <div className="h-1 bg-white/7 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300"
                           style={{ width: `${strength(pass)*25}%`, background: strengthColor[strength(pass)] }} />
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: strengthColor[strength(pass)] }}>
                      {strengthLabel[strength(pass)]}
                    </div>
                  </div>
                )}
              </Field>

              <Btn loading={loading}>
                <ArrowRight size={16}/> Crear cuenta gratis
              </Btn>

              <p className="text-center text-[10px] text-[#8892AA]/60 mt-3 leading-relaxed">
                Al registrarte aceptas los{' '}
                <span className="text-[#8892AA] cursor-pointer hover:text-[#F0F4FF]">Términos de uso</span>
                {' '}y la{' '}
                <span className="text-[#8892AA] cursor-pointer hover:text-[#F0F4FF]">Política de privacidad</span>
              </p>

              <p className="text-center text-xs text-[#8892AA] mt-3">
                ¿Ya tienes cuenta?{' '}
                <button type="button" onClick={() => setTab('login')}
                        className="text-[#00E5B0] font-medium hover:underline">
                  Ingresa aquí
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
const inputCls = (err) =>
  `w-full bg-[#0D1525] border rounded-lg px-3 py-2.5 text-sm text-[#F0F4FF] outline-none
   transition-all placeholder:text-[#8892AA]/50
   ${err ? 'border-[#FF5078]/50 focus:border-[#FF5078]'
          : 'border-white/7 focus:border-[#00E5B0]/40 focus:shadow-[0_0_0_3px_rgba(0,229,176,0.08)]'}`;

function Field({ label, error, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-[#8892AA] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[10px] text-[#FF5078] mt-1">{error}</p>}
    </div>
  );
}

function Btn({ loading, children }) {
  return (
    <button type="submit" disabled={loading}
            className="w-full bg-[#00E5B0] text-[#0A0E1A] py-3 rounded-xl font-semibold text-sm
                       flex items-center justify-center gap-2 transition-all
                       hover:shadow-[0_8px_24px_rgba(0,229,176,0.3)] hover:-translate-y-0.5
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
      {loading ? <Loader2 size={16} className="animate-spin"/> : children}
    </button>
  );
}

