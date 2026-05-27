/**
 * fechaLocal.js
 * Utilidades de fecha/hora en zona horaria America/Mexico_City (UTC-6, con horario de verano).
 * Usar SIEMPRE este helper en lugar de new Date() directamente para evitar
 * el desfase UTC vs hora local cuando el servidor corre en Railway u otra nube.
 *
 * Para cambiar la zona, establece la variable de entorno TZ_LOCAL.
 * Ejemplo: TZ_LOCAL=America/Cancun
 */

const ZONA = process.env.TZ_LOCAL || 'America/Mexico_City';

/**
 * Retorna la fecha/hora actual en la zona configurada.
 * @returns {{ hoy: string, hora: string, diaSemana: number }}
 *   - hoy:       "YYYY-MM-DD" en hora local
 *   - hora:      "HH:MM:SS"   en hora local
 *   - diaSemana: 1=Lunes … 7=Domingo  (igual que la BD)
 */
function ahoraLocal() {
  const ahora = new Date();

  // Extraer todas las partes directamente con Intl.
  // NO construir new Date() con el string resultante: Node reinterpreta
  // el string con el offset del servidor, causando un doble desfase.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year:    'numeric',
    month:   '2-digit',
    day:     '2-digit',
    hour:    '2-digit',
    minute:  '2-digit',
    second:  '2-digit',
    weekday: 'long',   // 'Monday', 'Tuesday', etc.
    hour12:  false
  });

  const partes = Object.fromEntries(
    fmt.formatToParts(ahora).map(p => [p.type, p.value])
  );

  const hoy  = `${partes.year}-${partes.month}-${partes.day}`;
  const hora = `${partes.hour}:${partes.minute}:${partes.second}`;

  // Mapear el nombre del día al número de la BD (1=Lun … 7=Dom)
  const MAP_DIA = {
    Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
    Friday: 5, Saturday: 6, Sunday: 7
  };
  const diaSemana = MAP_DIA[partes.weekday];

  return { hoy, hora, diaSemana };
}

module.exports = { ahoraLocal, ZONA };
