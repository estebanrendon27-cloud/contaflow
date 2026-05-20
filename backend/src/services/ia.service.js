import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

const GROQ_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_CONTABLE = `Eres un experto contador publico colombiano. Conoces el PUC (Decreto 2649), NIIF para PYMES, Estatuto Tributario, retencion en la fuente (Art. 383, 392, 401 E.T.), IVA (Art. 468 E.T.), nomina (CST, Ley 100). UVT 2025: $47.065. SMMLV 2025: $1.300.000. Responde en espanol, preciso y practico.`;

async function llamarGroq(messages, maxTokens = 1000) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.3 })
  });
  if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

export async function clasificarCuentaPUC(descripcion, monto, tipo, empresaId) {
  try {
    const content = await llamarGroq([
      { role: 'system', content: SYSTEM_CONTABLE },
      { role: 'user', content: `Clasifica en PUC colombiano: "${descripcion}", monto $${monto}, tipo ${tipo}. Responde SOLO JSON: {"codigo_puc":"XXXX","nombre_cuenta":"nombre","naturaleza":"debito o credito","categoria":"ingreso|gasto|activo|pasivo","iva_aplica":false,"tarifa_iva":0,"retefuente_aplica":false,"tarifa_retefuente":0,"explicacion":"razon"}` }
    ]);
    return JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    logger.error('Error PUC:', error.message);
    return { codigo_puc: tipo === 'ingreso' ? '4135' : '5295', nombre_cuenta: tipo === 'ingreso' ? 'Ingresos' : 'Gastos', naturaleza: tipo === 'ingreso' ? 'credito' : 'debito', categoria: tipo === 'ingreso' ? 'ingreso' : 'gasto', iva_aplica: false, tarifa_iva: 0, retefuente_aplica: false, tarifa_retefuente: 0, explicacion: 'Clasificacion por defecto' };
  }
}

export async function chatContable(mensaje, historial = [], empresaId = null) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_CONTABLE },
      ...historial.slice(-6).map(h => ({ role: h.rol === 'user' ? 'user' : 'assistant', content: h.contenido })),
      { role: 'user', content: mensaje }
    ];
    const respuesta = await llamarGroq(messages, 1500);
    if (empresaId) {
      try { await query(`INSERT INTO chat_ia (empresa_id, pregunta, respuesta, modelo) VALUES ($1,$2,$3,$4)`, [empresaId, mensaje, respuesta, MODEL]); } catch(e) {}
    }
    return { respuesta, modelo: MODEL };
  } catch (error) {
    logger.error('Error chat:', error.message);
    throw new Error('Error al procesar tu consulta.');
  }
}

export async function generarAlertasIA(empresaId) {
  return { alertas: [{ tipo: 'info', titulo: 'Sistema listo', descripcion: 'ContaFlow IA activo con Groq.', accion: 'Hacer una pregunta' }] };
}

export async function analizarIndicadores(empresaId) {
  return { mensaje: 'Carga tus datos del mes para ver el analisis.' };
}
