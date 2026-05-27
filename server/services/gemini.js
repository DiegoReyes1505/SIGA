/**
 * gemini.js — Servicio de sugerencias IA usando Google Gemini
 * Requiere variable de entorno: GEMINI_API_KEY
 */

const https = require('https');

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Llama a Gemini con el contexto de asistencias y retorna un array de sugerencias.
 * @param {object} datos - Datos del reporte (resumen, porGrupo, faltasCriticas, tendenciaMensual, porMateria)
 * @returns {Promise<string[]>} Array de sugerencias (mínimo 5, varían según datos)
 */
async function generarSugerencias(datos) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en variables de entorno');

  const { resumen, porGrupo = [], faltasCriticas = [], tendenciaMensual = [], porMateria = [] } = datos;
  const total = resumen?.total || 1;
  const pctAsistencia = Math.round(((resumen?.asistencias || 0) / total) * 100);

  const grupoMayorFaltas = porGrupo.reduce((a, b) => (b.faltas > (a?.faltas || 0) ? b : a), null);
  const materiaMayorFaltas = porMateria.reduce((a, b) => (b.faltas > (a?.faltas || 0) ? b : a), null);

  const prompt = `Eres un sistema experto en análisis de asistencia escolar. 
Analiza los siguientes datos reales de asistencia y genera EXACTAMENTE 6 sugerencias accionables, específicas y variadas para el personal docente y directivo. 
Cada sugerencia debe ser diferente, relevante a los datos, y empezar con un emoji apropiado.
Responde ÚNICAMENTE con un JSON array de strings. Ejemplo: ["🔍 sugerencia 1", "📊 sugerencia 2", ...]

DATOS DE ASISTENCIA:
- Período analizado: últimos 30 días
- Total de registros: ${resumen?.total || 0}
- Asistencias: ${resumen?.asistencias || 0} (${pctAsistencia}%)
- Retardos: ${resumen?.retardos || 0}
- Faltas: ${resumen?.faltas || 0}
- Permisos: ${resumen?.permisos || 0}
- Alumnos con faltas críticas (≥3 faltas): ${faltasCriticas.length}
${faltasCriticas.length > 0 ? `- Top alumno con más faltas: ${faltasCriticas[0]?.alumno} (${faltasCriticas[0]?.faltas} faltas, grupo ${faltasCriticas[0]?.grupo})` : ''}
${grupoMayorFaltas ? `- Grupo con más faltas: ${grupoMayorFaltas.nombre || grupoMayorFaltas.grupo} (${grupoMayorFaltas.faltas} faltas)` : ''}
${materiaMayorFaltas ? `- Materia con más faltas: ${materiaMayorFaltas.nombre || materiaMayorFaltas.materia} (${materiaMayorFaltas.faltas} faltas)` : ''}
- Asistencia por grupo: ${porGrupo.map(g => `${g.grupo}: ${g.asistencias}A/${g.faltas}F`).join(', ')}
- Tendencia mensual: ${tendenciaMensual.map(m => `${m.mes}: ${m.faltas} faltas`).join(', ')}

Genera sugerencias variadas que incluyan: intervención con alumnos, mejoras de proceso, reconocimiento positivo, alertas tempranas, y estrategias preventivas.`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    });

    const url = new URL(`${GEMINI_URL}?key=${apiKey}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
          // Extraer el array JSON de la respuesta
          const match = text.match(/\[.*\]/s);
          const sugerencias = match ? JSON.parse(match[0]) : [];
          resolve(Array.isArray(sugerencias) ? sugerencias : []);
        } catch (e) {
          reject(new Error('Error al parsear respuesta de Gemini: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { generarSugerencias };
