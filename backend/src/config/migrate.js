/**
 * ContaFlow — Migración completa de base de datos
 * Ejecutar: node src/config/migrate.js
 *
 * Tablas:
 *  usuarios, empresas, usuario_empresa,
 *  puc_cuentas, periodos_contables,
 *  transacciones, asientos_contables, detalles_asiento,
 *  facturas_electronicas, nomina_periodos, nomina_empleados,
 *  retenciones, iva_periodos, conciliaciones_bancarias,
 *  tokens_dian, vencimientos_tributarios,
 *  archivos_cargados, chat_ia
 */

import { config } from 'dotenv';
config();

import pool from './database.js';

const migrations = [

// ─── USUARIOS ────────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(30)  NOT NULL CHECK (rol IN ('contador','auxiliar','empresario','persona_natural','admin')),
  avatar_url    VARCHAR(500),
  activo        BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── EMPRESAS ────────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS empresas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nit                 VARCHAR(20) UNIQUE NOT NULL,
  digito_verificacion CHAR(1) NOT NULL,
  razon_social        VARCHAR(255) NOT NULL,
  nombre_comercial    VARCHAR(255),
  email               VARCHAR(255),
  telefono            VARCHAR(20),
  direccion           VARCHAR(500),
  departamento        VARCHAR(100),
  municipio           VARCHAR(100),
  codigo_ciiu         VARCHAR(10),
  actividad_economica VARCHAR(500),
  regimen_tributario  VARCHAR(50) NOT NULL DEFAULT 'responsable_iva',
  tipo_empresa        VARCHAR(100),
  estandar_niif       VARCHAR(50) DEFAULT 'niif_pymes',
  moneda_funcional    VARCHAR(10) DEFAULT 'COP',
  fecha_inicio_act    DATE,
  responsabilidades   JSONB DEFAULT '[]',
  configuracion       JSONB DEFAULT '{}',
  activa              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── USUARIO ↔ EMPRESA ───────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS usuario_empresa (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rol_empresa VARCHAR(30) DEFAULT 'contador',
  permisos    JSONB DEFAULT '{"leer":true,"escribir":true,"eliminar":false,"admin":false}',
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_id)
)`,

// ─── TOKEN DIAN ──────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS tokens_dian (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre_archivo  VARCHAR(255),
  tipo_certificado VARCHAR(20) DEFAULT 'p12',
  certificado_enc  TEXT,
  ambiente        VARCHAR(20) DEFAULT 'produccion',
  emisor          VARCHAR(255),
  fecha_inicio    DATE,
  fecha_vence     DATE,
  activo          BOOLEAN DEFAULT TRUE,
  ultimo_uso      TIMESTAMPTZ,
  total_usos      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, activo)
)`,

// ─── PUC CUENTAS ─────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS puc_cuentas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID REFERENCES empresas(id) ON DELETE CASCADE,
  codigo          VARCHAR(20) NOT NULL,
  nombre          VARCHAR(500) NOT NULL,
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('clase','grupo','cuenta','subcuenta','auxiliar')),
  naturaleza      VARCHAR(10) NOT NULL CHECK (naturaleza IN ('debito','credito')),
  codigo_padre    VARCHAR(20),
  nivel           INTEGER NOT NULL,
  permite_mov     BOOLEAN DEFAULT FALSE,
  activa          BOOLEAN DEFAULT TRUE,
  descripcion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, codigo)
)`,

// ─── PERIODOS CONTABLES ───────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS periodos_contables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  anio           INTEGER NOT NULL,
  mes            INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  estado         VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado','ajuste')),
  cerrado_por    UUID REFERENCES usuarios(id),
  fecha_cierre   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, anio, mes)
)`,

// ─── TRANSACCIONES ────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS transacciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  periodo_id        UUID REFERENCES periodos_contables(id),
  tipo              VARCHAR(30) NOT NULL CHECK (tipo IN ('ingreso','gasto','costo','nomina','impuesto','bancario','otro')),
  subtipo           VARCHAR(50),
  fecha             DATE NOT NULL,
  descripcion       TEXT NOT NULL,
  tercero_nit       VARCHAR(20),
  tercero_nombre    VARCHAR(255),
  cuenta_puc        VARCHAR(20),
  debito            NUMERIC(18,2) DEFAULT 0,
  credito           NUMERIC(18,2) DEFAULT 0,
  iva_tarifa        NUMERIC(5,2) DEFAULT 0,
  iva_valor         NUMERIC(18,2) DEFAULT 0,
  retefuente_tarifa NUMERIC(5,2) DEFAULT 0,
  retefuente_valor  NUMERIC(18,2) DEFAULT 0,
  reteica_tarifa    NUMERIC(8,4) DEFAULT 0,
  reteica_valor     NUMERIC(18,2) DEFAULT 0,
  moneda            VARCHAR(10) DEFAULT 'COP',
  tasa_cambio       NUMERIC(12,4) DEFAULT 1,
  estado            VARCHAR(20) DEFAULT 'pendiente',
  conciliada        BOOLEAN DEFAULT FALSE,
  origen            VARCHAR(30) DEFAULT 'manual',
  archivo_origen_id UUID,
  fe_numero         VARCHAR(100),
  notas             TEXT,
  clasificado_ia    BOOLEAN DEFAULT FALSE,
  created_by        UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── ASIENTOS CONTABLES ───────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS asientos_contables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  periodo_id     UUID REFERENCES periodos_contables(id),
  numero         VARCHAR(30) NOT NULL,
  tipo           VARCHAR(30) NOT NULL,
  fecha          DATE NOT NULL,
  descripcion    TEXT NOT NULL,
  total_debito   NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credito  NUMERIC(18,2) NOT NULL DEFAULT 0,
  cuadra         BOOLEAN GENERATED ALWAYS AS (total_debito = total_credito) STORED,
  estado         VARCHAR(20) DEFAULT 'borrador',
  aprobado_por   UUID REFERENCES usuarios(id),
  created_by     UUID REFERENCES usuarios(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
)`,

`CREATE TABLE IF NOT EXISTS detalles_asiento (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asiento_id   UUID NOT NULL REFERENCES asientos_contables(id) ON DELETE CASCADE,
  linea        INTEGER NOT NULL,
  cuenta_codigo VARCHAR(20) NOT NULL,
  cuenta_nombre VARCHAR(500),
  tercero_nit   VARCHAR(20),
  tercero_nombre VARCHAR(255),
  descripcion   TEXT,
  debito        NUMERIC(18,2) DEFAULT 0,
  credito       NUMERIC(18,2) DEFAULT 0
)`,

// ─── FACTURAS ELECTRÓNICAS ────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS facturas_electronicas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo              VARCHAR(20) NOT NULL CHECK (tipo IN ('recibida','emitida','nota_credito','nota_debito')),
  numero_fe         VARCHAR(100) NOT NULL,
  cufe              VARCHAR(500),
  fecha_emision     DATE NOT NULL,
  fecha_vencimiento DATE,
  emisor_nit        VARCHAR(20),
  emisor_nombre     VARCHAR(255),
  receptor_nit      VARCHAR(20),
  receptor_nombre   VARCHAR(255),
  subtotal          NUMERIC(18,2) DEFAULT 0,
  descuento         NUMERIC(18,2) DEFAULT 0,
  iva_5             NUMERIC(18,2) DEFAULT 0,
  iva_19            NUMERIC(18,2) DEFAULT 0,
  iva_otros         NUMERIC(18,2) DEFAULT 0,
  retefuente        NUMERIC(18,2) DEFAULT 0,
  reteiva           NUMERIC(18,2) DEFAULT 0,
  reteica           NUMERIC(18,2) DEFAULT 0,
  total             NUMERIC(18,2) NOT NULL DEFAULT 0,
  moneda            VARCHAR(10) DEFAULT 'COP',
  estado_dian       VARCHAR(30) DEFAULT 'pendiente',
  xml_dian          TEXT,
  pdf_url           VARCHAR(500),
  procesada         BOOLEAN DEFAULT FALSE,
  transaccion_id    UUID REFERENCES transacciones(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── NÓMINA ───────────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS nomina_periodos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  periodo_id        UUID REFERENCES periodos_contables(id),
  mes               INTEGER NOT NULL,
  anio              INTEGER NOT NULL,
  total_empleados   INTEGER DEFAULT 0,
  total_salarios    NUMERIC(18,2) DEFAULT 0,
  total_salud       NUMERIC(18,2) DEFAULT 0,
  total_pension     NUMERIC(18,2) DEFAULT 0,
  total_arl         NUMERIC(18,2) DEFAULT 0,
  total_parafiscales NUMERIC(18,2) DEFAULT 0,
  total_prima       NUMERIC(18,2) DEFAULT 0,
  total_cesantias   NUMERIC(18,2) DEFAULT 0,
  total_vacaciones  NUMERIC(18,2) DEFAULT 0,
  total_retefuente  NUMERIC(18,2) DEFAULT 0,
  total_neto        NUMERIC(18,2) DEFAULT 0,
  costo_total       NUMERIC(18,2) DEFAULT 0,
  estado            VARCHAR(20) DEFAULT 'borrador',
  pila_generado     BOOLEAN DEFAULT FALSE,
  ne_enviada        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
)`,

`CREATE TABLE IF NOT EXISTS nomina_empleados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nomina_periodo_id UUID REFERENCES nomina_periodos(id) ON DELETE CASCADE,
  cedula            VARCHAR(20) NOT NULL,
  nombre            VARCHAR(255) NOT NULL,
  cargo             VARCHAR(255),
  departamento      VARCHAR(100),
  salario_basico    NUMERIC(18,2) NOT NULL,
  dias_trabajados   INTEGER DEFAULT 30,
  horas_extras      NUMERIC(8,2) DEFAULT 0,
  otros_ingresos    NUMERIC(18,2) DEFAULT 0,
  total_devengado   NUMERIC(18,2) DEFAULT 0,
  salud_empleado    NUMERIC(18,2) DEFAULT 0,
  pension_empleado  NUMERIC(18,2) DEFAULT 0,
  retefuente        NUMERIC(18,2) DEFAULT 0,
  otras_deducciones NUMERIC(18,2) DEFAULT 0,
  total_deducciones NUMERIC(18,2) DEFAULT 0,
  neto_pagar        NUMERIC(18,2) DEFAULT 0,
  salud_patronal    NUMERIC(18,2) DEFAULT 0,
  pension_patronal  NUMERIC(18,2) DEFAULT 0,
  arl               NUMERIC(18,2) DEFAULT 0,
  sena              NUMERIC(18,2) DEFAULT 0,
  icbf              NUMERIC(18,2) DEFAULT 0,
  ccf               NUMERIC(18,2) DEFAULT 0,
  prima_prov        NUMERIC(18,2) DEFAULT 0,
  cesantias_prov    NUMERIC(18,2) DEFAULT 0,
  vacaciones_prov   NUMERIC(18,2) DEFAULT 0,
  eps               VARCHAR(100),
  afp               VARCHAR(100),
  arl_nombre        VARCHAR(100),
  nivel_riesgo      INTEGER DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── IVA ─────────────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS iva_periodos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  bimestre          INTEGER NOT NULL CHECK (bimestre BETWEEN 1 AND 6),
  anio              INTEGER NOT NULL,
  fecha_inicio      DATE NOT NULL,
  fecha_fin         DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  base_0            NUMERIC(18,2) DEFAULT 0,
  base_5            NUMERIC(18,2) DEFAULT 0,
  base_19           NUMERIC(18,2) DEFAULT 0,
  base_excluido     NUMERIC(18,2) DEFAULT 0,
  iva_generado_5    NUMERIC(18,2) DEFAULT 0,
  iva_generado_19   NUMERIC(18,2) DEFAULT 0,
  iva_descontable   NUMERIC(18,2) DEFAULT 0,
  iva_pagar         NUMERIC(18,2) DEFAULT 0,
  saldo_favor       NUMERIC(18,2) DEFAULT 0,
  estado            VARCHAR(20) DEFAULT 'pendiente',
  presentado_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, bimestre, anio)
)`,

// ─── RETENCIONES ──────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS retenciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  transaccion_id    UUID REFERENCES transacciones(id),
  mes               INTEGER NOT NULL,
  anio              INTEGER NOT NULL,
  tipo              VARCHAR(20) NOT NULL CHECK (tipo IN ('retefuente','reteiva','reteica')),
  concepto          VARCHAR(255) NOT NULL,
  articulo_et       VARCHAR(50),
  tarifa            NUMERIC(8,4) NOT NULL,
  base              NUMERIC(18,2) NOT NULL,
  valor             NUMERIC(18,2) NOT NULL,
  tercero_nit       VARCHAR(20),
  tercero_nombre    VARCHAR(255),
  estado            VARCHAR(20) DEFAULT 'pendiente',
  created_at        TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── CONCILIACIÓN BANCARIA ────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS conciliaciones_bancarias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  banco             VARCHAR(100) NOT NULL,
  cuenta_numero     VARCHAR(30),
  mes               INTEGER NOT NULL,
  anio              INTEGER NOT NULL,
  saldo_extracto    NUMERIC(18,2) DEFAULT 0,
  saldo_libro       NUMERIC(18,2) DEFAULT 0,
  diferencia        NUMERIC(18,2) DEFAULT 0,
  conciliada        BOOLEAN DEFAULT FALSE,
  total_transac     INTEGER DEFAULT 0,
  conciliadas       INTEGER DEFAULT 0,
  pendientes        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, banco, mes, anio)
)`,

// ─── ARCHIVOS CARGADOS ────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS archivos_cargados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id      UUID REFERENCES usuarios(id),
  nombre_original VARCHAR(255) NOT NULL,
  nombre_storage  VARCHAR(255) NOT NULL,
  tipo_archivo    VARCHAR(20) NOT NULL,
  modulo          VARCHAR(30) NOT NULL,
  tamanio_bytes   INTEGER,
  mime_type       VARCHAR(100),
  filas_procesadas INTEGER DEFAULT 0,
  filas_ok        INTEGER DEFAULT 0,
  filas_error     INTEGER DEFAULT 0,
  estado          VARCHAR(20) DEFAULT 'pendiente',
  errores         JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── VENCIMIENTOS TRIBUTARIOS ─────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS vencimientos_tributarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo            VARCHAR(50) NOT NULL,
  descripcion     VARCHAR(255) NOT NULL,
  formulario      VARCHAR(20),
  fecha_vence     DATE NOT NULL,
  
  monto_estimado  NUMERIC(18,2),
  presentado      BOOLEAN DEFAULT FALSE,
  presentado_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── CHAT IA ──────────────────────────────────────────────────────────────────
`CREATE TABLE IF NOT EXISTS chat_ia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  rol         VARCHAR(10) NOT NULL CHECK (rol IN ('user','assistant')),
  contenido   TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
)`,

// ─── ÍNDICES DE RENDIMIENTO ───────────────────────────────────────────────────
`CREATE INDEX IF NOT EXISTS idx_transacciones_empresa_fecha ON transacciones(empresa_id, fecha DESC)`,
`CREATE INDEX IF NOT EXISTS idx_transacciones_tipo ON transacciones(empresa_id, tipo)`,
`CREATE INDEX IF NOT EXISTS idx_fe_empresa ON facturas_electronicas(empresa_id, tipo, fecha_emision DESC)`,
`CREATE INDEX IF NOT EXISTS idx_fe_cufe ON facturas_electronicas(cufe)`,
`CREATE INDEX IF NOT EXISTS idx_puc_empresa ON puc_cuentas(empresa_id, codigo)`,
`CREATE INDEX IF NOT EXISTS idx_asientos_empresa ON asientos_contables(empresa_id, fecha DESC)`,
`CREATE INDEX IF NOT EXISTS idx_retenciones_empresa ON retenciones(empresa_id, mes, anio)`,
`CREATE INDEX IF NOT EXISTS idx_chat_usuario ON chat_ia(usuario_id, created_at DESC)`,

// ─── FUNCIÓN updated_at automático ─────────────────────────────────────────
`CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql`,

`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_usuarios_updated_at') THEN
    CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$`,

`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_empresas_updated_at') THEN
    CREATE TRIGGER trg_empresas_updated_at BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$`,

`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transacciones_updated_at') THEN
    CREATE TRIGGER trg_transacciones_updated_at BEFORE UPDATE ON transacciones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$`,
`ALTER TABLE vencimientos_tributarios DROP COLUMN IF EXISTS dias_restantes`,

];

const run = async () => {
  const client = await pool.connect();
  console.log('🚀 Iniciando migración ContaFlow...\n');
  let ok = 0, fail = 0;
  for (const [i, sql] of migrations.entries()) {
    try {
      await client.query(sql);
      const name = sql.trim().split('\n')[0].replace('--','').trim().slice(0, 70);
      console.log(`  ✅ [${i+1}/${migrations.length}] ${name}`);
      ok++;
    } catch (err) {
      console.error(`  ❌ [${i+1}] Error: ${err.message.split('\n')[0]}`);
      fail++;
    }
  }
  client.release();
  await pool.end();
  console.log(`\n📊 Migración completada: ${ok} OK · ${fail} errores`);
  process.exit(fail > 0 ? 1 : 0);
};

run().catch(err => { console.error(err); process.exit(1); });
