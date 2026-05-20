/**
 * ContaFlow — Seed de base de datos
 * Crea un usuario demo, empresa y datos de ejemplo
 * Ejecutar: node src/config/seed.js
 */

import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import pool from './database.js';

const seed = async () => {
  const client = await pool.connect();
  console.log('🌱 Iniciando seed ContaFlow...\n');

  try {
    await client.query('BEGIN');

    // ─── USUARIO DEMO ────────────────────────────────────────────────────────
    const passHash = await bcrypt.hash('Demo1234!', 12);
    const { rows: [user] } = await client.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol)
       VALUES ('Marcela','Cadena','demo@contaflow.co',$1,'contador')
       ON CONFLICT (email) DO UPDATE SET updated_at=NOW()
       RETURNING id`,
      [passHash]
    );
    console.log('  ✅ Usuario demo: demo@contaflow.co / Demo1234!');

    // ─── EMPRESA DEMO ─────────────────────────────────────────────────────────
    const { rows: [emp] } = await client.query(
      `INSERT INTO empresas
       (nit, digito_verificacion, razon_social, nombre_comercial, email,
        telefono, direccion, departamento, municipio, codigo_ciiu,
        actividad_economica, regimen_tributario, tipo_empresa, estandar_niif)
       VALUES
       ('900234567','3','Constructora Andina S.A.S.','Constructora Andina',
        'contabilidad@constructoraandina.co','(4) 234-5678',
        'Calle 10 # 43A-20, El Poblado','Antioquia','Medellín','4120',
        'Construcción de edificios residenciales y no residenciales',
        'responsable_iva','Sociedad por Acciones Simplificada (S.A.S.)','niif_pymes')
       ON CONFLICT (nit) DO UPDATE SET updated_at=NOW()
       RETURNING id`,
      []
    );
    console.log('  ✅ Empresa demo: Constructora Andina S.A.S. NIT 900.234.567-3');

    // Vincular usuario a empresa
    await client.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, rol_empresa)
       VALUES ($1,$2,'contador') ON CONFLICT DO NOTHING`,
      [user.id, emp.id]
    );

    // ─── PERÍODOS CONTABLES ───────────────────────────────────────────────────
    const now = new Date();
    for (let m = 1; m <= now.getMonth() + 1; m++) {
      const inicio = new Date(now.getFullYear(), m - 1, 1);
      const fin    = new Date(now.getFullYear(), m, 0);
      await client.query(
        `INSERT INTO periodos_contables (empresa_id, anio, mes, fecha_inicio, fecha_fin, estado)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [emp.id, now.getFullYear(), m,
         inicio.toISOString().split('T')[0],
         fin.toISOString().split('T')[0],
         m < now.getMonth() + 1 ? 'cerrado' : 'abierto']
      );
    }
    console.log(`  ✅ ${now.getMonth() + 1} períodos contables creados`);

    // ─── TOKEN DIAN ───────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO tokens_dian (empresa_id, nombre_archivo, tipo_certificado, ambiente, emisor, fecha_inicio, fecha_vence)
       VALUES ($1,'certificado_demo.p12','p12','produccion','Certicámara S.A.','2024-03-15','2026-03-15')
       ON CONFLICT DO NOTHING`,
      [emp.id]
    );
    console.log('  ✅ Token DIAN demo configurado');

    // ─── PUC BASE ─────────────────────────────────────────────────────────────
    const cuentasPUC = [
      ['1','ACTIVOS','clase','debito',null,1,false],
      ['11','EFECTIVO Y EQUIVALENTES','grupo','debito','1',2,false],
      ['1105','Caja','cuenta','debito','11',3,true],
      ['1110','Bancos','cuenta','debito','11',3,true],
      ['1115','Remesas en tránsito','cuenta','debito','11',3,true],
      ['13','DEUDORES','grupo','debito','1',2,false],
      ['1305','Clientes','cuenta','debito','13',3,true],
      ['1320','Deudores varios','cuenta','debito','13',3,true],
      ['1325','Cuentas corrientes comerciales','cuenta','debito','13',3,true],
      ['14','INVENTARIOS','grupo','debito','1',2,false],
      ['1405','Materias primas','cuenta','debito','14',3,true],
      ['1430','Productos en proceso','cuenta','debito','14',3,true],
      ['1435','Productos terminados','cuenta','debito','14',3,true],
      ['15','PROPIEDADES PLANTA Y EQUIPO','grupo','debito','1',2,false],
      ['1516','Construcciones en curso','cuenta','debito','15',3,true],
      ['1520','Maquinaria y equipo','cuenta','debito','15',3,true],
      ['1524','Equipo de oficina','cuenta','debito','15',3,true],
      ['1528','Equipo de computación','cuenta','debito','15',3,true],
      ['1540','Flota y equipo de transporte','cuenta','debito','15',3,true],
      ['1592','Depreciación acumulada','cuenta','credito','15',3,true],
      ['19','OTROS ACTIVOS','grupo','debito','1',2,false],
      ['1910','Intangibles','cuenta','debito','19',3,true],
      ['1970','Cargos diferidos','cuenta','debito','19',3,true],
      ['2','PASIVOS','clase','credito',null,1,false],
      ['22','PROVEEDORES','grupo','credito','2',2,false],
      ['2205','Proveedores nacionales','cuenta','credito','22',3,true],
      ['2210','Proveedores del exterior','cuenta','credito','22',3,true],
      ['23','CUENTAS POR PAGAR','grupo','credito','2',2,false],
      ['2335','Costos y gastos por pagar','cuenta','credito','23',3,true],
      ['2360','Dividendos por pagar','cuenta','credito','23',3,true],
      ['2365','Retención en la fuente','cuenta','credito','23',3,true],
      ['2367','Impuesto a las ventas retenido','cuenta','credito','23',3,true],
      ['2368','Impuesto de industria y comercio retenido','cuenta','credito','23',3,true],
      ['24','IMPUESTOS, GRAVÁMENES Y TASAS','grupo','credito','2',2,false],
      ['2404','De renta y complementarios','cuenta','credito','24',3,true],
      ['2408','Impuesto sobre las ventas por pagar','cuenta','credito','24',3,true],
      ['2412','De industria y comercio','cuenta','credito','24',3,true],
      ['25','OBLIGACIONES LABORALES','grupo','credito','2',2,false],
      ['2505','Salarios por pagar','cuenta','credito','25',3,true],
      ['2510','Cesantías consolidadas','cuenta','credito','25',3,true],
      ['2515','Intereses sobre cesantías','cuenta','credito','25',3,true],
      ['2520','Prima de servicios','cuenta','credito','25',3,true],
      ['2525','Vacaciones consolidadas','cuenta','credito','25',3,true],
      ['2530','Prestaciones extralegales','cuenta','credito','25',3,true],
      ['26','PASIVOS ESTIMADOS Y PROVISIONES','grupo','credito','2',2,false],
      ['2610','Anticipos y avances recibidos','cuenta','credito','26',3,true],
      ['2615','Ingresos recibidos para terceros','cuenta','credito','26',3,true],
      ['27','DIFERIDOS','grupo','credito','2',2,false],
      ['2705','Ingresos recibidos por anticipado','cuenta','credito','27',3,true],
      ['29','OTROS PASIVOS','grupo','credito','2',2,false],
      ['2905','Bonos y papeles comerciales','cuenta','credito','29',3,true],
      ['3','PATRIMONIO','clase','credito',null,1,false],
      ['31','CAPITAL SOCIAL','grupo','credito','3',2,false],
      ['3105','Capital suscrito y pagado','cuenta','credito','31',3,true],
      ['3115','Aportes sociales','cuenta','credito','31',3,true],
      ['32','SUPERÁVIT DE CAPITAL','grupo','credito','3',2,false],
      ['3205','Prima en colocación de acciones','cuenta','credito','32',3,true],
      ['33','RESERVAS','grupo','credito','3',2,false],
      ['3305','Reserva legal','cuenta','credito','33',3,true],
      ['3315','Reservas estatutarias','cuenta','credito','33',3,true],
      ['36','RESULTADOS DEL EJERCICIO','grupo','credito','3',2,false],
      ['3605','Utilidad del ejercicio','cuenta','credito','36',3,true],
      ['3610','Pérdida del ejercicio','cuenta','debito','36',3,true],
      ['37','RESULTADOS DE EJERCICIOS ANTERIORES','grupo','credito','3',2,false],
      ['3705','Utilidades acumuladas','cuenta','credito','37',3,true],
      ['3710','Pérdidas acumuladas','cuenta','debito','37',3,true],
      ['4','INGRESOS','clase','credito',null,1,false],
      ['41','OPERACIONALES','grupo','credito','4',2,false],
      ['4105','Agricultura, ganadería, caza y silvicultura','cuenta','credito','41',3,true],
      ['4110','Pesca','cuenta','credito','41',3,true],
      ['4115','Explotación de minas y canteras','cuenta','credito','41',3,true],
      ['4120','Industrias manufactureras','cuenta','credito','41',3,true],
      ['4125','Electricidad, gas y vapor','cuenta','credito','41',3,true],
      ['4130','Construcción','cuenta','credito','41',3,true],
      ['4135','Comercio al por mayor y al por menor','cuenta','credito','41',3,true],
      ['4140','Hoteles y restaurantes','cuenta','credito','41',3,true],
      ['4145','Transporte, almacenamiento y comunicaciones','cuenta','credito','41',3,true],
      ['4150','Intermediación financiera','cuenta','credito','41',3,true],
      ['4155','Actividades inmobiliarias y de alquiler','cuenta','credito','41',3,true],
      ['4160','Servicios sociales y de salud','cuenta','credito','41',3,true],
      ['4165','Otras actividades de servicios comunitarios','cuenta','credito','41',3,true],
      ['4170','Educación','cuenta','credito','41',3,true],
      ['4175','Administración pública y defensa','cuenta','credito','41',3,true],
      ['4180','Hogares privados con servicio doméstico','cuenta','credito','41',3,true],
      ['4185','Servicios','cuenta','credito','41',3,true],
      ['4190','Honorarios','cuenta','credito','41',3,true],
      ['4195','Comisiones','cuenta','credito','41',3,true],
      ['42','NO OPERACIONALES','grupo','credito','4',2,false],
      ['4205','Financieros','cuenta','credito','42',3,true],
      ['4210','Dividendos','cuenta','credito','42',3,true],
      ['4215','Participaciones','cuenta','credito','42',3,true],
      ['4220','Arrendamientos','cuenta','credito','42',3,true],
      ['4225','Comisiones','cuenta','credito','42',3,true],
      ['4230','Honorarios','cuenta','credito','42',3,true],
      ['4235','Servicios','cuenta','credito','42',3,true],
      ['4240','Utilidad en venta de inversiones','cuenta','credito','42',3,true],
      ['4245','Utilidad en venta de propiedades','cuenta','credito','42',3,true],
      ['4295','Otros','cuenta','credito','42',3,true],
      ['5','GASTOS','clase','debito',null,1,false],
      ['51','OPERACIONALES DE ADMINISTRACIÓN','grupo','debito','5',2,false],
      ['5105','Gastos de personal','cuenta','debito','51',3,true],
      ['5110','Honorarios','cuenta','debito','51',3,true],
      ['5115','Impuestos','cuenta','debito','51',3,true],
      ['5120','Arrendamientos','cuenta','debito','51',3,true],
      ['5125','Contribuciones y afiliaciones','cuenta','debito','51',3,true],
      ['5130','Seguros','cuenta','debito','51',3,true],
      ['5135','Servicios','cuenta','debito','51',3,true],
      ['5140','Gastos legales','cuenta','debito','51',3,true],
      ['5145','Mantenimiento y reparaciones','cuenta','debito','51',3,true],
      ['5150','Adecuación e instalación','cuenta','debito','51',3,true],
      ['5155','Gastos de viaje','cuenta','debito','51',3,true],
      ['5160','Depreciaciones','cuenta','debito','51',3,true],
      ['5165','Amortizaciones','cuenta','debito','51',3,true],
      ['5170','Diversos','cuenta','debito','51',3,true],
      ['5195','Provisiones','cuenta','debito','51',3,true],
      ['52','OPERACIONALES DE VENTAS','grupo','debito','5',2,false],
      ['5205','Gastos de personal','cuenta','debito','52',3,true],
      ['5210','Honorarios','cuenta','debito','52',3,true],
      ['5215','Impuestos','cuenta','debito','52',3,true],
      ['5220','Arrendamientos','cuenta','debito','52',3,true],
      ['5240','Seguros','cuenta','debito','52',3,true],
      ['5245','Servicios','cuenta','debito','52',3,true],
      ['5295','Servicios públicos','cuenta','debito','52',3,true],
      ['53','NO OPERACIONALES','grupo','debito','5',2,false],
      ['5305','Financieros','cuenta','debito','53',3,true],
      ['5310','Pérdida en venta y retiro de bienes','cuenta','debito','53',3,true],
      ['5315','Gastos extraordinarios','cuenta','debito','53',3,true],
      ['5320','Gastos diversos','cuenta','debito','53',3,true],
      ['6','COSTOS DE VENTAS Y DE PRESTACIÓN DE SERVICIOS','clase','debito',null,1,false],
      ['61','COSTO DE VENTAS Y DE PRESTACIÓN DE SERVICIOS','grupo','debito','6',2,false],
      ['6105','Agricultura','cuenta','debito','61',3,true],
      ['6120','Industrias manufactureras','cuenta','debito','61',3,true],
      ['6135','Comercio al por mayor y al por menor','cuenta','debito','61',3,true],
      ['6145','Hoteles y restaurantes','cuenta','debito','61',3,true],
      ['6155','Servicios','cuenta','debito','61',3,true],
      ['6160','Honorarios','cuenta','debito','61',3,true],
      ['62','COMPRAS','grupo','debito','6',2,false],
      ['6205','Compras de mercancías','cuenta','debito','62',3,true],
      ['6225','Devoluciones en compras','cuenta','credito','62',3,true],
      ['7','COSTOS DE PRODUCCIÓN O DE OPERACIÓN','clase','debito',null,1,false],
      ['71','MATERIA PRIMA','grupo','debito','7',2,false],
      ['7105','Materias primas','cuenta','debito','71',3,true],
      ['72','MANO DE OBRA DIRECTA','grupo','debito','7',2,false],
      ['7205','Sueldos y salarios','cuenta','debito','72',3,true],
      ['73','COSTOS INDIRECTOS','grupo','debito','7',2,false],
      ['7305','Arrendamientos','cuenta','debito','73',3,true],
      ['7310','Seguros','cuenta','debito','73',3,true],
    ];

    let pucOk = 0;
    for (const c of cuentasPUC) {
      await client.query(
        `INSERT INTO puc_cuentas (empresa_id,codigo,nombre,tipo,naturaleza,codigo_padre,nivel,permite_mov)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (empresa_id,codigo) DO NOTHING`,
        [emp.id, ...c]
      ).then(() => pucOk++).catch(() => {});
    }
    console.log(`  ✅ ${pucOk} cuentas PUC cargadas`);

    // ─── TRANSACCIONES DEMO ───────────────────────────────────────────────────
    const anio = now.getFullYear();
    const transacciones = [
      // INGRESOS MAYO
      ['ingreso', `${anio}-05-02`, 'Servicios construcción — Inversiones Alfa SAS', '901234567', 'Inversiones Alfa SAS', '4130', 0, 28400000, 19, 5396000, 0, 0],
      ['ingreso', `${anio}-05-05`, 'Anticipo obra Torres del Rio', '800145223', 'Constructores XYZ Ltda', '4130', 0, 45000000, 0, 0, 0, 0],
      ['ingreso', `${anio}-05-08`, 'Arrendamiento Local 301', null, 'Arrendatario Local', '4155', 0, 3200000, 19, 608000, 0, 0],
      ['ingreso', `${anio}-05-12`, 'Consultoría técnica estructural', '830018111', 'Empresa Estatal ABC', '4190', 0, 18200000, 0, 0, 0, 0],
      ['ingreso', `${anio}-05-15`, 'Venta materiales sobrantes', null, 'Varios clientes', '4135', 0, 8500000, 19, 1615000, 0, 0],
      ['ingreso', `${anio}-05-20`, 'Servicios diseño arquitectónico', '900789123', 'Constructora Norte SAS', '4190', 0, 22000000, 19, 4180000, 0, 0],
      ['ingreso', `${anio}-05-25`, 'Comisión intermediación inmobiliaria', '79234567', 'Carlos Ramírez', '4195', 0, 12000000, 0, 0, 0, 0],
      // GASTOS MAYO
      ['gasto',`${anio}-05-03`, 'Cemento Argos x100 bultos', '860006797', 'Argos S.A.', '6205', 9870000, 0, 19, 1875300, 3.5, 345450],
      ['gasto',`${anio}-05-05`, 'Energía eléctrica EPM — mayo', '890000046', 'EPM', '5295', 1240000, 0, 0, 0, 0, 0],
      ['gasto',`${anio}-05-06`, 'Póliza todo riesgo construcción', '890903938', 'Seguros Bolívar', '5240', 3400000, 0, 0, 0, 11, 374000],
      ['gasto',`${anio}-05-08`, 'Herramientas y equipos menores', '812001445', 'Ferreterías del Valle', '1524', 2100000, 0, 19, 399000, 3.5, 73500],
      ['gasto',`${anio}-05-10`, 'Agua y alcantarillado EPM', '890000046', 'EPM', '5295', 420000, 0, 0, 0, 0, 0],
      ['gasto',`${anio}-05-12`, 'Gasolina y ACPM maquinaria', '830028503', 'Organización Terpel', '6205', 1850000, 0, 5, 92500, 3.5, 64750],
      ['gasto',`${anio}-05-15`, 'Honorarios contador — mayo', '79567890', 'Pedro Gómez Contador', '5110', 2500000, 0, 0, 0, 11, 275000],
      ['gasto',`${anio}-05-18`, 'Arriendo bodega materiales', '12345678', 'Propietario Bodega', '5120', 1800000, 0, 0, 0, 3.5, 63000],
      ['gasto',`${anio}-05-20`, 'Alquiler grúa telescópica', '900345678', 'Equipos Construcción SAS', '5135', 4200000, 0, 19, 798000, 4, 168000],
      ['gasto',`${anio}-05-22`, 'Papelería y útiles oficina', null, 'Office Depot', '5195', 380000, 0, 19, 72200, 0, 0],
      ['gasto',`${anio}-05-28`, 'Mantenimiento montacargas', '800345210', 'Tecni-Elevadores Ltda', '5145', 1600000, 0, 19, 304000, 4, 64000],
      // NÓMINA
      ['nomina',`${anio}-05-15`, 'Nómina mayo 2025 — 14 empleados', null, null, '5105', 12400000, 0, 0, 0, 0, 0],
    ];

    let txOk = 0;
    for (const tx of transacciones) {
      await client.query(
        `INSERT INTO transacciones
         (empresa_id,tipo,fecha,descripcion,tercero_nit,tercero_nombre,cuenta_puc,
          debito,credito,iva_tarifa,iva_valor,retefuente_tarifa,retefuente_valor,
          origen,clasificado_ia,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'seed',true,$14)`,
        [emp.id, ...tx, user.id]
      ).then(() => txOk++).catch(() => {});
    }
    console.log(`  ✅ ${txOk} transacciones demo creadas`);

    // ─── FACTURAS ELECTRÓNICAS DEMO ───────────────────────────────────────────
    const fes = [
      ['recibida','FE-2025-0421','a8f2c9e4d1b7f3a5',`${anio}-05-02`,'901234567','Inversiones Alfa SAS','900234567','Constructora Andina',28400000,5396000,33796000,'aceptada'],
      ['recibida','FE-2025-0389','b7e3f1a9c5d2g4h8',`${anio}-05-03`,'860006797','Argos S.A.','900234567','Constructora Andina',9870000,1875300,11745300,'aceptada'],
      ['emitida', 'FV-2025-0089','c9d4e8f2a6b1g3h7',`${anio}-05-05`,'900234567','Constructora Andina','800145223','Constructores XYZ',45000000,8550000,53550000,'aceptada'],
      ['emitida', 'FV-2025-0088','d1e5f9g3h7a2b6c4',`${anio}-05-06`,'900234567','Constructora Andina','901234567','Inversiones Alfa',28400000,5396000,33796000,'aceptada'],
      ['recibida','FE-2025-0401','e3f7g1h5a9b4c8d2',`${anio}-05-05`,'890903938','Seguros Bolívar','900234567','Constructora Andina',3400000,0,3400000,'aceptada'],
      ['emitida', 'FV-2025-0087','f5g9h3a7b2c6d1e8',`${anio}-05-07`,'900234567','Constructora Andina','79234567','Arrendatario A3',3200000,608000,3808000,'pendiente'],
    ];

    let feOk = 0;
    for (const fe of fes) {
      await client.query(
        `INSERT INTO facturas_electronicas
         (empresa_id,tipo,numero_fe,cufe,fecha_emision,emisor_nit,emisor_nombre,
          receptor_nit,receptor_nombre,subtotal,iva_19,total,estado_dian)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
        [emp.id, ...fe]
      ).then(() => feOk++).catch(() => {});
    }
    console.log(`  ✅ ${feOk} facturas electrónicas demo creadas`);

    // ─── NÓMINA DEMO ──────────────────────────────────────────────────────────
    const { rows: [nomPer] } = await client.query(
      `INSERT INTO nomina_periodos
       (empresa_id,mes,anio,total_empleados,total_salarios,total_salud,total_pension,
        total_arl,total_parafiscales,total_prima,total_cesantias,total_vacaciones,
        total_retefuente,total_neto,costo_total,estado)
       VALUES ($1,5,$2,14,12400000,1054000,1488000,64688,1116000,1033333,1033333,516667,476000,11340000,18605354,'calculado')
       ON CONFLICT DO NOTHING RETURNING id`,
      [emp.id, anio]
    );

    if (nomPer) {
      const empleados = [
        ['12345678','Carlos Andrés Martínez','Ingeniero Civil','Obras',3200000],
        ['23456789','Luisa Fernanda Torres','Contadora','Administración',2800000],
        ['34567890','Pedro Alberto Aguirre','Maestro de obra','Obras',1300000],
        ['45678901','Ana María Rodríguez','Aux. Administrativa','Administración',1160000],
        ['56789012','Jorge Luis Gómez','Electricista','Obras',1400000],
        ['67890123','María Cecilia López','Residente de obra','Obras',2200000],
      ];
      for (const [ced, nom, car, dep, sal] of empleados) {
        const base = sal; const dias = 30;
        const sE = Math.round(base*0.04), pE = Math.round(base*0.04);
        const sP = Math.round(base*0.085), pP = Math.round(base*0.12);
        const arl = Math.round(base*0.00522);
        const sena = Math.round(base*0.02), icbf = Math.round(base*0.03), ccf = Math.round(base*0.04);
        const prima = Math.round(base/12), ces = Math.round(base/12), vac = Math.round(base/24);
        const rte = base > 2000000 ? Math.round((base - sE - pE) * 0.04) : 0;
        await client.query(
          `INSERT INTO nomina_empleados
           (empresa_id,nomina_periodo_id,cedula,nombre,cargo,departamento,salario_basico,dias_trabajados,
            total_devengado,salud_empleado,pension_empleado,retefuente,total_deducciones,neto_pagar,
            salud_patronal,pension_patronal,arl,sena,icbf,ccf,prima_prov,cesantias_prov,vacaciones_prov)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
           ON CONFLICT DO NOTHING`,
          [emp.id,nomPer.id,ced,nom,car,dep,sal,dias,sal,sE,pE,rte,sE+pE+rte,sal-sE-pE-rte,sP,pP,arl,sena,icbf,ccf,prima,ces,vac]
        ).catch(() => {});
      }
      console.log('  ✅ Nómina demo con 6 empleados creada');
    }

    // ─── VENCIMIENTOS ─────────────────────────────────────────────────────────
    const vencimientos = [
      ['iva_bimestral',`Declaración IVA bimestral Mar–Abr ${anio}`,'300',`${anio}-05-15`, 8320000],
      ['retefuente',   `Retención en la fuente Abril ${anio}`,      '350',`${anio}-05-22`, 4218000],
      ['exogena',      `Exógena medios magnéticos ${anio}`,          '631',`${anio}-06-10`, null],
      ['renta',        `Declaración de renta ${anio-1}`,             '110',`${anio}-08-12`, null],
    ];
    for (const [tipo,desc,form,fecha,monto] of vencimientos) {
      await client.query(
        `INSERT INTO vencimientos_tributarios (empresa_id,tipo,descripcion,formulario,fecha_vence,monto_estimado)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [emp.id,tipo,desc,form,fecha,monto]
      ).catch(() => {});
    }
    console.log('  ✅ Vencimientos tributarios creados');

    // ─── IVA BIMESTRAL ────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO iva_periodos
       (empresa_id,bimestre,anio,fecha_inicio,fecha_fin,fecha_vencimiento,
        base_0,base_5,base_19,iva_generado_5,iva_generado_19,iva_descontable,iva_pagar,saldo_favor)
       VALUES ($1,2,$2,'2025-03-01','2025-04-30','2025-05-15',
               13400000,24200000,98400000,1210000,18696000,13820000,6086000,0)
       ON CONFLICT DO NOTHING`,
      [emp.id, anio]
    ).catch(() => {});
    console.log('  ✅ IVA bimestral Mar–Abr calculado');

    await client.query('COMMIT');
    console.log('\n🎉 Seed completado exitosamente');
    console.log('─────────────────────────────────────────');
    console.log('📧 Email:    demo@contaflow.co');
    console.log('🔑 Password: Demo1234!');
    console.log('🏢 Empresa:  Constructora Andina S.A.S.');
    console.log('─────────────────────────────────────────\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error en seed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
};

seed().catch(err => { console.error(err); process.exit(1); });
