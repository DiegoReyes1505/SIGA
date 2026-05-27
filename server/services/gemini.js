/**
 * gemini.js — Servicio de sugerencias IA usando Google Gemini
 * Requiere variable de entorno: GEMINI_API_KEY
 */

const https = require('https');

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Extrae el primer JSON array válido de un texto que puede contener
 * markdown code blocks, texto libre antes/después, etc.
 */
function extraerArray(text) {
  if (!text) return [];

  // 1. Quitar bloques markdown ```json ... ``` o ``` ... ```
  const sinMarkdown = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

  // 2. Buscar el primer [ ... ] que sea JSON válido
  const match = sinMarkdown.match(/\[.*?\]/s);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (_) {}
  }

  // 3. Fallback: buscar cualquier [ ... ] en el texto original
  const matchOriginal = text.match(/\[.*?\]/s);
  if (matchOriginal) {
    try {
      const parsed = JSON.parse(matchOriginal[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }

  // 4. Fallback final: si el texto contiene líneas con emojis, parsear como lista
  const lineas = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10 && (l.match(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u) || l.match(/^\d+\./)));
  if (lineas.length >= 3) return lineas;

  return [];
}

/**
 * Llama a Gemini con el contexto de asistencias y retorna un array de sugerencias.
 * @param {object} datos - Datos del reporte
 * @returns {Promise<string[]>}
 */
async function generarSugerencias(datos) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en variables de entorno');

  const { resumen, porGrupo = [], faltasCriticas = [], tendenciaMensual = [], porMateria = [] } = datos;
  const total = resumen?.total || 1;
  const pctAsistencia = Math.round(((resumen?.asistencias || 0) / total) * 100);

  const grupoMayorFaltas  = porGrupo.reduce((a, b)  => (b.faltas > (a?.faltas || 0) ? b : a), null);
  const materiaMayorFaltas = porMateria.reduce((a, b) => (b.faltas > (a?.faltas || 0) ? b : a), null);

  const prompt = `Eres un sistema experto en análisis de asistencia escolar.
Analiza los siguientes datos reales y genera EXACTAMENTE 6 sugerencias accionables y variadas para el personal docente y directivo.
Cada sugerencia debe ser diferente, relevante a los datos, y empezar con un emoji apropiado.
Responde ÚNICAMENTE con un JSON array de strings, sin ningún otro texto.
Ejemplo exacto de formato esperado:
["\ud83d\udd0d Sugerencia uno aqui", "\ud83d\udcca Sugerencia dos aqui", "\u26a0\ufe0f Sugerencia tres aqui", "\u2705 Sugerencia cuatro aqui", "\ud83d\udcc5 Sugerencia cinco aqui", "\ud83c\udf93 Sugerencia seis aqui"]

DATOS DE ASISTENCIA:
- Período analizado: últimos 30 días
- Total de registros: ${resumen?.total || 0}
- Asistencias: ${resumen?.asistencias || 0} (${pctAsistencia}%)
- Retardos: ${resumen?.retardos || 0}
- Faltas: ${resumen?.faltas || 0}
- Permisos: ${resumen?.permisos || 0}
- Alumnos con faltas críticas (≥3 faltas): ${faltasCriticas.length}
${faltasCriticas.length > 0 ? `- Top alumno: ${faltasCriticas[0]?.alumno} (${faltasCriticas[0]?.faltas} faltas, grupo ${faltasCriticas[0]?.grupo})` : ''}
${grupoMayorFaltas  ? `- Grupo con más faltas: ${grupoMayorFaltas.grupo  || grupoMayorFaltas.nombre} (${grupoMayorFaltas.faltas} faltas)`  : ''}
${materiaMayorFaltas ? `- Materia con más faltas: ${materiaMayorFaltas.materia || materiaMayorFaltas.nombre} (${materiaMayorFaltas.faltas} faltas)` : ''}
- Asistencia por grupo: ${porGrupo.map(g  => `${g.grupo}: ${g.asistencias}A/${g.faltas}F`).join(', ')}
- Tendencia mensual:    ${tendenciaMensual.map(m => `${m.mes}: ${m.faltas} faltas`).join(', ')}

Genera sugerencias variadas que incluyan: intervención con alumnos, mejoras de proceso, reconocimiento positivo, alertas tempranas y estrategias preventivas.
Recuerda: responde SOLO con el JSON array, sin bloques de código ni texto adicional.`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    });

    const url = new URL(`${GEMINI_URL}?key=${apiKey}`);
    const options = {
      hostname: url.hostname,
      path    : url.pathname + url.search,
      method  : 'POST',
      headers : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          // Log de errores de la API
          if (json.error) {
            console.error('[Gemini] Error de API:', json.error.message);
            return reject(new Error(json.error.message));
          }

          // Extraer texto de la respuesta
          const candidate = json.candidates?.[0];
          if (!candidate) {
            console.error('[Gemini] Sin candidatos en respuesta:', JSON.stringify(json).slice(0, 300));
            return resolve([]);
          }

          const text = candidate.content?.parts?.[0]?.text || '';
          console.log('[Gemini] Respuesta raw (primeros 400 chars):', text.slice(0, 400));

          const sugerencias = extraerArray(text);
          console.log('[Gemini] Sugerencias extraídas:', sugerencias.length);
          resolve(sugerencias);
        } catch (e) {
          console.error('[Gemini] Error al parsear respuesta:', e.message);
          reject(new Error('Error al parsear respuesta de Gemini: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      console.error('[Gemini] Error de red:', e.message);
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

module.exports = { generarSugerencias };
