/**
 * fechaLocal.js
 * Utilidades de fecha/hora en zona horaria local del servidor (America/Cancun).
 * Usar SIEMPRE este helper en lugar de new Date() directamente,
 * para evitar el desfase UTC vs hora local cuando el servidor corre en la nube.
 */

const ZONA = process.env.TZ_LOCAL || 'America/Cancun';

/**
 * Retorna la fecha/hora actual en la zona configurada.
 * @returns {{ ahora: Date, hoy: string, hora: string, diaSemana: number }}
 *   - ahora:     objeto Date con la hora real del servidor (UTC internamente)
 *   - hoy:       "YYYY-MM-DD" en hora local
 *   - hora:      "HH:MM:SS"   en hora local
 *   - diaSemana: 1=Lunes … 6=Sábado, 7=Domingo  (igual que la BD)
 */
function ahoraLocal() {
  const ahora = new Date();

  // Obtener partes en la zona local usando Intl
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const partes = Object.fromEntries(
    fmt.formatToParts(ahora).map(p => [p.type, p.value])
  );

  const hoy  = `${partes.year}-${partes.month}-${partes.day}`;
  const hora = `${partes.hour}:${partes.minute}:${partes.second}`;

  // Día de la semana en zona local
  const fechaLocal = new Date(
    `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}`
  );
  const jsDay     = fechaLocal.getDay();          // 0=Dom … 6=Sáb
  const diaSemana = jsDay === 0 ? 7 : jsDay;      // 1=Lun … 7=Dom

  return { ahora, hoy, hora, diaSemana };
}

module.exports = { ahoraLocal, ZONA };
