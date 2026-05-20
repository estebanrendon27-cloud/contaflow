# ContaFlow 🇨🇴
### Plataforma contable inteligente para Colombia

> Automatiza tu contabilidad: sube tu token DIAN, carga tus Excel y recibe Balance, P&G, IVA, Retenciones, Nómina y formularios DIAN — todo en minutos.

---

## 🚀 Inicio rápido

### Opción A — Docker (recomendado)
```bash
git clone https://github.com/tu-usuario/contaflow.git
cd contaflow

# Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tu ANTHROPIC_API_KEY

# Levantar todo con Docker
docker-compose up -d

# Crear tablas y datos demo
docker-compose exec backend node src/config/migrate.js
docker-compose exec backend node src/config/seed.js
```
Accede a: **http://localhost:5173**
- Email: `demo@contaflow.co`
- Password: `Demo1234!`

---

### Opción B — Desarrollo local

**Requisitos:** Node.js 20+, PostgreSQL 14+

```bash
# 1. Clonar el repo
git clone https://github.com/tu-usuario/contaflow.git
cd contaflow

# 2. Configurar backend
cd backend
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL y ANTHROPIC_API_KEY
npm install

# 3. Crear base de datos
createdb contaflow_db
node src/config/migrate.js
node src/config/seed.js

# 4. Iniciar backend
npm run dev
# API corriendo en http://localhost:3001

# 5. En otra terminal, configurar frontend
cd ../frontend
npm install
npm run dev
# App corriendo en http://localhost:5173
```

---

## 🏗️ Arquitectura

```
contaflow/
├── backend/                    # API REST Node.js + Express
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js     # PostgreSQL pool + transacciones
│   │   │   ├── migrate.js      # Migración de todas las tablas
│   │   │   └── seed.js         # Datos demo (empresa + transacciones)
│   │   ├── controllers/
│   │   │   └── auth.controller.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   # JWT + roles
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── empresa.routes.js   # CRUD empresa + dashboard + PUC
│   │   │   ├── excel.routes.js     # Carga Excel + plantillas
│   │   │   ├── dian.routes.js      # FE + token + vencimientos
│   │   │   ├── iva.routes.js       # IVA bimestral + retenciones
│   │   │   ├── nomina.routes.js    # Nómina + PILA
│   │   │   ├── contabilidad.routes.js  # Transacciones + libro mayor
│   │   │   ├── reportes.routes.js  # Balance + P&G + exportar
│   │   │   └── ia.routes.js        # Chat IA + clasificación
│   │   ├── services/
│   │   │   ├── excel.service.js    # Parseo + clasificación automática
│   │   │   ├── ia.service.js       # Claude API (PUC + chat + alertas)
│   │   │   ├── dian.service.js     # SOAP DIAN + XML + CUFE
│   │   │   └── retenciones.service.js  # ReteFuente + ReteICA + ReteIVA
│   │   └── utils/
│   │       └── logger.js           # Winston logs
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx        # Login + Registro + 4 roles
│   │   │   ├── OnboardingPage.jsx  # 4 pasos: empresa + DIAN + PUC
│   │   │   ├── DashboardPage.jsx   # KPIs + gráfica + vencimientos
│   │   │   ├── ExcelPage.jsx       # Carga ingresos/gastos/nómina/bancos
│   │   │   ├── DIANPage.jsx        # FE recibidas/emitidas + token
│   │   │   ├── IVAPage.jsx         # IVA + Retenciones + Form. 300/350
│   │   │   ├── NominaPage.jsx      # Nómina + PILA
│   │   │   ├── ReportesPage.jsx    # Balance + P&G + Libro Mayor
│   │   │   ├── AsistentePage.jsx   # Chat IA normativa colombiana
│   │   │   └── ConfigPage.jsx      # Configuración empresa + usuarios
│   │   ├── components/
│   │   │   └── layout/
│   │   │       └── AppLayout.jsx   # Sidebar + Topbar + selector empresa
│   │   ├── services/
│   │   │   └── api.js              # Axios + interceptores + servicios
│   │   ├── store/
│   │   │   └── index.js            # Zustand: auth + empresa + UI
│   │   └── utils/
│   │       └── format.js           # fmt.cop, fmt.fecha, calcDV, etc.
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## 🗄️ Base de datos

**18 tablas principales:**

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Autenticación + roles |
| `empresas` | NIT, régimen, CIIU, configuración |
| `usuario_empresa` | Relación M:N con permisos |
| `tokens_dian` | Certificado digital DIAN |
| `puc_cuentas` | Plan Único de Cuentas (450+ cuentas) |
| `periodos_contables` | Mes/año abierto o cerrado |
| `transacciones` | Registro central de movimientos |
| `asientos_contables` | Libro diario (cuadrados siempre) |
| `detalles_asiento` | Líneas del asiento |
| `facturas_electronicas` | FE recibidas y emitidas + CUFE |
| `nomina_periodos` | Resumen de nómina mensual |
| `nomina_empleados` | Detalle por empleado con todos los aportes |
| `iva_periodos` | IVA bimestral por tarifa |
| `retenciones` | ReteFuente + ReteIVA + ReteICA |
| `conciliaciones_bancarias` | Cruce extracto vs libros |
| `archivos_cargados` | Historial de uploads Excel |
| `vencimientos_tributarios` | Calendario DIAN auto-generado |
| `chat_ia` | Historial de conversaciones con IA |

---

## 🤖 IA con Claude

ContaFlow usa **Claude claude-sonnet-4-20250514** para:

- **Clasificación PUC automática** — Detecta el código PUC correcto (4xxx/5xxx/6xxx) de cada transacción al leer el Excel, con caché en BD para mayor velocidad.
- **Asistente contable** — Responde preguntas sobre normativa colombiana (E.T., NIIF para PYMES, retenciones, IVA) con contexto de la empresa actual.
- **Generación de asientos** — Propone asientos contables cuadrados en formato PUC desde descripciones de transacciones.
- **Análisis de indicadores** — Genera alertas inteligentes sobre la situación financiera (margen, liquidez, vencimientos).

---

## 📋 API REST

**Base URL:** `http://localhost:3001/api/v1`

### Autenticación
```
POST /auth/register    Crear cuenta
POST /auth/login       Iniciar sesión (→ JWT)
POST /auth/refresh     Renovar token
GET  /auth/me          Perfil del usuario
```

### Empresas
```
GET    /empresas              Listar mis empresas
POST   /empresas              Crear empresa (+ PUC automático)
GET    /empresas/:id/dashboard  KPIs del mes + gráfica + vencimientos
PUT    /empresas/:id          Actualizar datos
```

### Excel (Header requerido: X-Empresa-Id)
```
POST   /excel/upload/ingresos   Cargar Excel de ingresos
POST   /excel/upload/gastos     Cargar Excel de gastos
POST   /excel/upload/nomina     Cargar Excel de nómina
POST   /excel/upload/bancario   Cargar extracto bancario
GET    /excel/plantilla/:modulo Descargar plantilla Excel vacía
GET    /excel/archivos          Historial de cargas
```

### DIAN
```
GET    /dian/fe           Listar facturas electrónicas
POST   /dian/fe/emitir    Emitir nueva FE (→ XML + DIAN)
GET    /dian/token        Estado del certificado digital
POST   /dian/vencimientos Generar calendario tributario
```

### Tributario
```
POST   /iva/calcular/:bimestre/:anio   Calcular IVA del bimestre
GET    /iva/retenciones/:mes/:anio     Resumen retenciones Form. 350
GET    /nomina/periodos/:id/empleados  Detalle nómina por empleado
POST   /nomina/periodos/:id/generar-pila  Descargar archivo PILA
```

### Reportes
```
GET    /reportes/balance      Balance general con PUC
GET    /reportes/pyg          Estado de resultados + indicadores
GET    /reportes/flujo-caja   Flujo de caja 12 meses
GET    /reportes/exportar/:tipo  Descargar Excel del reporte
```

### IA
```
POST   /ia/chat               Chat con asistente contable
GET    /ia/historial          Historial de conversaciones
POST   /ia/clasificar-cuenta  Clasificar descripción → código PUC
POST   /ia/analizar           Alertas inteligentes de la empresa
```

---

## ⚙️ Variables de entorno

```env
# Backend (.env)
PORT=3001
DB_HOST=localhost
DB_NAME=contaflow_db
DB_USER=contaflow_user
DB_PASSWORD=tu_password

JWT_SECRET=minimo_64_caracteres_aleatorios_aqui
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx

# DIAN (opcional para desarrollo)
DIAN_API_URL=https://vpfe.dian.gov.co/WcfDianCustomerServices.svc
DIAN_TEST_URL=https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc
```

---

## 🛠️ Comandos útiles

```bash
# Backend
npm run dev          # Desarrollo con hot-reload
npm run migrate      # Crear/actualizar tablas
npm run seed         # Cargar datos demo

# Frontend
npm run dev          # Desarrollo Vite
npm run build        # Build para producción

# Docker
docker-compose up -d            # Levantar todos los servicios
docker-compose logs -f backend  # Ver logs del API
docker-compose exec postgres psql -U contaflow_user -d contaflow_db  # Consola DB
```

---

## 🔐 Roles de usuario

| Rol | Acceso |
|-----|--------|
| `contador` | Acceso completo a todas las funciones, multi-empresa |
| `auxiliar` | Carga de archivos, consulta de reportes |
| `empresario` | Dashboard, carga de documentos, reportes básicos |
| `persona_natural` | Declaración de renta, ingresos, gastos personales |

---

## 📜 Normativa colombiana implementada

- ✅ PUC según Decreto 2649/1993 y actualizaciones
- ✅ NIIF para PYMES (Grupo 2) y NIIF Plenas (Grupo 1)
- ✅ ReteFuente: Arts. 383, 392, 401, 439 E.T.
- ✅ IVA bimestral: Arts. 468 y ss. E.T.
- ✅ Nómina: CST + Ley 100/1993 + UVT 2025 ($47.065)
- ✅ SMMLV 2025: $1.300.000
- ✅ Facturación electrónica: Res. DIAN 000042/2020
- ✅ Nómina electrónica: Res. DIAN 000013/2021
- ✅ ICA: Tarifas por municipio (Bogotá, Medellín, Cali)

---

## 🗺️ Roadmap

### ✅ Completado (Frontend + Backend)
- [x] Landing page, Login/Registro, Onboarding 4 pasos
- [x] Dashboard con KPIs, gráficas y vencimientos DIAN
- [x] Carga Excel: Ingresos, Gastos, Nómina, Extracto bancario
- [x] Clasificación PUC automática con IA (Claude)
- [x] Módulo DIAN: FE recibidas/emitidas, token, CUFE
- [x] IVA bimestral por tarifa + Formularios 300/350 pre-diligenciados
- [x] Nómina: liquidación + aportes + PILA automático
- [x] Retenciones: ReteFuente + ReteICA + ReteIVA por Art. E.T.
- [x] Balance General PUC + Estado de Resultados + Libro Mayor
- [x] Asistente IA contable con normativa colombiana
- [x] API REST completa con 40+ endpoints
- [x] Base de datos PostgreSQL con 18 tablas y migración
- [x] Docker + Docker Compose para despliegue

### 🔜 Próximas versiones
- [ ] Integración real API DIAN MUISCA (Web Services SOAP)
- [ ] Conciliación bancaria automática (Bancolombia, Davivienda, BBVA)
- [ ] Exógena medios magnéticos (Art. 631 E.T.) automática
- [ ] App móvil React Native
- [ ] Multi-empresa: panel contador con todos sus clientes
- [ ] Firma digital y presentación directa ante DIAN
- [ ] Integración bancaria Open Banking
- [ ] OCR de facturas en papel (scan → Excel automático)

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea tu rama: `git checkout -b feature/mi-funcionalidad`
3. Commit: `git commit -m 'feat: agregar X módulo'`
4. Push: `git push origin feature/mi-funcionalidad`
5. Abre un Pull Request

---

**Hecho con ❤️ en Colombia 🇨🇴 — Medellín, Antioquia**

*ContaFlow © 2025 — Todos los derechos reservados*
