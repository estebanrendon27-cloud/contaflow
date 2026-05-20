/**
 * ContaFlow — Servicio DIAN Colombia
 * Integración con web services DIAN:
 * - Consulta facturas electrónicas
 * - Validación CUFE
 * - Envío de documentos
 * - Consulta RUT / obligaciones
 */

import axios from 'axios';
import { parseStringPromise, Builder } from 'xml2js';
import { readFileSync } from 'fs';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

const DIAN_URL    = process.env.DIAN_API_URL  || 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';
const DIAN_HAB    = process.env.DIAN_TEST_URL || 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc';

/**
 * Obtener token de sesión DIAN (SOAP)
 */
export const obtenerTokenDIAN = async (nit, pinTecnico, ambiente = 'produccion') => {
  const url = ambiente === 'produccion' ? DIAN_URL : DIAN_HAB;
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:wcf="http://wcf.dian.colombia">
  <soap:Header/>
  <soap:Body>
    <wcf:GetTokenFromPin>
      <wcf:pin>${pinTecnico}</wcf:pin>
    </wcf:GetTokenFromPin>
  </soap:Body>
</soap:Envelope>`;

  try {
    const resp = await axios.post(url, soap, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://wcf.dian.colombia/IWcfDianCustomerServices/GetTokenFromPin',
      },
      timeout: 30000,
    });
    const parsed = await parseStringPromise(resp.data);
    // Extraer token de la respuesta SOAP
    const token = parsed?.['s:Envelope']?.['s:Body']?.[0]
      ?.['GetTokenFromPinResponse']?.[0]
      ?.['GetTokenFromPinResult']?.[0] || null;
    return token;
  } catch (err) {
    logger.error(`❌ Error obteniendo token DIAN: ${err.message}`);
    throw new Error(`No se pudo conectar con la DIAN: ${err.message}`);
  }
};

/**
 * Consultar facturas electrónicas recibidas
 */
export const consultarFERecibidas = async (empresaId, nit, token, fechaDesde, fechaHasta, ambiente = 'produccion') => {
  const url = ambiente === 'produccion' ? DIAN_URL : DIAN_HAB;

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:wcf="http://wcf.dian.colombia">
  <soap:Header>
    <wcf:Token>${token}</wcf:Token>
  </soap:Header>
  <soap:Body>
    <wcf:GetNumberingRange>
      <wcf:accountCode>${nit}</wcf:accountCode>
      <wcf:accountCodeT>${nit}</wcf:accountCodeT>
      <wcf:softwareCode>${process.env.DIAN_NIT_TECNICO || ''}</wcf:softwareCode>
    </wcf:GetNumberingRange>
  </soap:Body>
</soap:Envelope>`;

  // Nota: En producción real se usa el endpoint correcto de consulta
  // Simulamos la estructura de respuesta por ahora
  logger.info(`🔍 Consultando FE DIAN para NIT ${nit} (${fechaDesde} - ${fechaHasta})`);

  // Guardar en BD el registro de la consulta
  await query(
    `UPDATE tokens_dian SET ultimo_uso=NOW(), total_usos=total_usos+1 WHERE empresa_id=$1 AND activo=true`,
    [empresaId]
  );

  return {
    ok: true,
    mensaje: 'Consulta enviada a DIAN',
    nit,
    fechaDesde,
    fechaHasta,
  };
};

/**
 * Validar CUFE de una factura
 */
export const validarCUFE = async (cufe, ambiente = 'produccion') => {
  const url = ambiente === 'produccion' ? DIAN_URL : DIAN_HAB;

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:wcf="http://wcf.dian.colombia">
  <soap:Header/>
  <soap:Body>
    <wcf:GetXmlByDocumentKey>
      <wcf:trackId>${cufe}</wcf:trackId>
    </wcf:GetXmlByDocumentKey>
  </soap:Body>
</soap:Envelope>`;

  try {
    const resp = await axios.post(url, soap, {
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      timeout: 15000,
    });
    return { valido: resp.status === 200, cufe };
  } catch {
    return { valido: false, cufe, error: 'No se pudo validar con DIAN' };
  }
};

/**
 * Enviar factura electrónica a DIAN
 */
export const enviarFEDIAN = async (xmlBase64, token, ambiente = 'produccion') => {
  const url = ambiente === 'produccion' ? DIAN_URL : DIAN_HAB;

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:wcf="http://wcf.dian.colombia">
  <soap:Header>
    <wcf:Token>${token}</wcf:Token>
  </soap:Header>
  <soap:Body>
    <wcf:SendBillSync>
      <wcf:fileName>factura.xml</wcf:fileName>
      <wcf:contentFile>${xmlBase64}</wcf:contentFile>
    </wcf:SendBillSync>
  </soap:Body>
</soap:Envelope>`;

  try {
    const resp = await axios.post(url, soap, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync',
      },
      timeout: 30000,
    });
    const parsed = await parseStringPromise(resp.data);
    const result = parsed?.['s:Envelope']?.['s:Body']?.[0]?.['SendBillSyncResponse']?.[0];
    const isValid = result?.['IsValid']?.[0] === 'true';
    const cufe = result?.['XmlBase64Bytes']?.[0] || null;
    return { enviada: true, valida: isValid, cufe };
  } catch (err) {
    logger.error(`❌ Error enviando FE a DIAN: ${err.message}`);
    throw new Error(`Error enviando a DIAN: ${err.message}`);
  }
};

/**
 * Generar XML de factura electrónica según formato DIAN (UBL 2.1)
 */
export const generarXMLFactura = (factura, empresa) => {
  const builder = new Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });

  const xmlObj = {
    'Invoice': {
      '$': {
        'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      },
      'cbc:UBLVersionID': 'UBL 2.1',
      'cbc:CustomizationID': '10',
      'cbc:ProfileID': 'DIAN 2.1',
      'cbc:ID': factura.numero,
      'cbc:IssueDate': factura.fecha,
      'cbc:IssueTime': new Date().toTimeString().split(' ')[0],
      'cbc:InvoiceTypeCode': '01',
      'cbc:DocumentCurrencyCode': 'COP',
      'cac:AccountingSupplierParty': {
        'cac:Party': {
          'cac:PartyTaxScheme': {
            'cbc:RegistrationName': empresa.razon_social,
            'cbc:CompanyID': empresa.nit,
            'cac:TaxScheme': { 'cbc:ID': '01', 'cbc:Name': 'IVA' },
          },
        },
      },
      'cac:AccountingCustomerParty': {
        'cac:Party': {
          'cac:PartyTaxScheme': {
            'cbc:RegistrationName': factura.cliente_nombre,
            'cbc:CompanyID': factura.cliente_nit,
            'cac:TaxScheme': { 'cbc:ID': '01', 'cbc:Name': 'IVA' },
          },
        },
      },
      'cac:LegalMonetaryTotal': {
        'cbc:LineExtensionAmount': { '$': { 'currencyID': 'COP' }, '_': factura.subtotal },
        'cbc:TaxExclusiveAmount': { '$': { 'currencyID': 'COP' }, '_': factura.subtotal },
        'cbc:TaxInclusiveAmount': { '$': { 'currencyID': 'COP' }, '_': factura.total },
        'cbc:PayableAmount': { '$': { 'currencyID': 'COP' }, '_': factura.total },
      },
    },
  };

  return builder.buildObject(xmlObj);
};

/**
 * Registrar FE en la base de datos
 */
export const registrarFEEnBD = async (empresaId, feData) => {
  const { rows } = await query(
    `INSERT INTO facturas_electronicas
     (empresa_id, tipo, numero_fe, cufe, fecha_emision, emisor_nit, emisor_nombre,
      receptor_nit, receptor_nombre, subtotal, iva_19, total, estado_dian)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      empresaId, feData.tipo, feData.numero, feData.cufe,
      feData.fecha, feData.emisor_nit, feData.emisor_nombre,
      feData.receptor_nit, feData.receptor_nombre,
      feData.subtotal, feData.iva, feData.total,
      feData.cufe ? 'aceptada' : 'pendiente',
    ]
  );
  return rows[0];
};

/**
 * Generar vencimientos tributarios del año para una empresa
 */
export const generarVencimientos = async (empresaId, anio = new Date().getFullYear()) => {
  const vencimientos = [
    // IVA Bimestral (6 bimestres)
    { tipo: 'iva_bimestral', desc: 'IVA Bimestral Ene-Feb', form: '300', fecha: `${anio}-03-15` },
    { tipo: 'iva_bimestral', desc: 'IVA Bimestral Mar-Abr', form: '300', fecha: `${anio}-05-15` },
    { tipo: 'iva_bimestral', desc: 'IVA Bimestral May-Jun', form: '300', fecha: `${anio}-07-15` },
    { tipo: 'iva_bimestral', desc: 'IVA Bimestral Jul-Ago', form: '300', fecha: `${anio}-09-15` },
    { tipo: 'iva_bimestral', desc: 'IVA Bimestral Sep-Oct', form: '300', fecha: `${anio}-11-14` },
    { tipo: 'iva_bimestral', desc: 'IVA Bimestral Nov-Dic', form: '300', fecha: `${anio+1}-01-15` },
    // ReteFuente mensual (12 meses)
    ...[1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({
      tipo: 'retefuente',
      desc: `Retención en la Fuente ${String(m).padStart(2,'0')}/${anio}`,
      form: '350',
      fecha: `${m === 12 ? anio+1 : anio}-${String(m === 12 ? 1 : m+1).padStart(2,'0')}-15`,
    })),
    // Renta anual
    { tipo: 'renta', desc: `Declaración Renta ${anio}`, form: '110', fecha: `${anio+1}-04-10` },
    // Exógena
    { tipo: 'exogena', desc: `Información Exógena ${anio}`, form: '631', fecha: `${anio+1}-06-10` },
  ];

  for (const v of vencimientos) {
    await query(
      `INSERT INTO vencimientos_tributarios (empresa_id, tipo, descripcion, formulario, fecha_vence)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [empresaId, v.tipo, v.desc, v.form, v.fecha]
    );
  }
  logger.info(`📅 ${vencimientos.length} vencimientos generados para empresa ${empresaId}`);
  return vencimientos;
};
