const db = require("../utils/db");
const ExcelJS = require("exceljs");
const puppeteer = require("puppeteer-core");

// Ruta al ejecutable de Chromium según el entorno
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  "/usr/bin/chromium-browser";

// ── Resumen de hoy ────────────────────────────────────────────────────────────
exports.resumenGeneral = async (req, res, next) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const [stats] = await db.query(
      `
      SELECT
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN tipo = 'permiso'    THEN 1 END) AS permisos,
        COUNT(*) AS total
      FROM asistencias WHERE fecha = ?
    `,
      [hoy],
    );
    res.json({ ok: true, datos: stats, fecha: hoy });
  } catch (e) {
    next(e);
  }
};

// ── Faltas críticas ───────────────────────────────────────────────────────────
exports.faltasCriticas = async (req, res, next) => {
  try {
    const { umbral = 3, dias = 30 } = req.query;
    const desde = new Date(Date.now() - dias * 86400000)
      .toISOString()
      .slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        a.id, a.matricula,
        CONCAT(a.nombre,' ',a.apellido_pat) AS alumno,
        g.nombre AS grupo,
        COUNT(CASE WHEN as2.tipo = 'falta'   THEN 1 END) AS faltas,
        COUNT(CASE WHEN as2.tipo = 'retardo' THEN 1 END) AS retardos,
        COUNT(CASE WHEN as2.tipo = 'permiso' THEN 1 END) AS permisos
      FROM alumnos a
      JOIN grupos g ON g.id = a.grupo_id
      LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha >= ?
      WHERE a.activo = 1
      GROUP BY a.id
      HAVING faltas >= ?
      ORDER BY faltas DESC
    `,
      [desde, parseInt(umbral)],
    );
    res.json({ ok: true, datos: rows, parametros: { umbral, dias, desde } });
  } catch (e) {
    next(e);
  }
};

// ── Por grupo ─────────────────────────────────────────────────────────────────
exports.porGrupo = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const desde =
      fecha_inicio ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const hasta = fecha_fin || new Date().toISOString().slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        g.nombre AS grupo,
        COUNT(CASE WHEN as2.tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN as2.tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN as2.tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN as2.tipo = 'permiso'    THEN 1 END) AS permisos
      FROM grupos g
      LEFT JOIN alumnos a       ON a.grupo_id = g.id AND a.activo = 1
      LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha BETWEEN ? AND ?
      WHERE g.activo = 1
      GROUP BY g.id
      ORDER BY g.nombre
    `,
      [desde, hasta],
    );
    res.json({ ok: true, datos: rows, rango: { desde, hasta } });
  } catch (e) {
    next(e);
  }
};

// ── Tendencia mensual (6 meses) ───────────────────────────────────────────────
exports.tendenciaMensual = async (req, res, next) => {
  try {
    const rows = await db.query(`
      SELECT
        DATE_FORMAT(fecha, '%Y-%m') AS mes,
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas
      FROM asistencias
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes
      ORDER BY mes
    `);
    res.json({ ok: true, datos: rows });
  } catch (e) {
    next(e);
  }
};

// ── Resumen del mes actual ────────────────────────────────────────────────────
exports.resumenMes = async (req, res, next) => {
  try {
    const [stats] = await db.query(`
      SELECT
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN tipo = 'permiso'    THEN 1 END) AS permisos,
        COUNT(*) AS total
      FROM asistencias
      WHERE YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())
    `);
    res.json({ ok: true, datos: stats });
  } catch (e) {
    next(e);
  }
};

// ── Retardos críticos ─────────────────────────────────────────────────────────
exports.retardosCriticos = async (req, res, next) => {
  try {
    const { umbral = 2, dias = 30 } = req.query;
    const desde = new Date(Date.now() - dias * 86400000)
      .toISOString()
      .slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        a.id, a.matricula,
        CONCAT(a.nombre,' ',a.apellido_pat) AS alumno,
        g.nombre AS grupo,
        COUNT(CASE WHEN as2.tipo = 'retardo' THEN 1 END) AS retardos,
        COUNT(CASE WHEN as2.tipo = 'falta'   THEN 1 END) AS faltas
      FROM alumnos a
      JOIN grupos g ON g.id = a.grupo_id
      LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha >= ?
      WHERE a.activo = 1
      GROUP BY a.id
      HAVING retardos >= ?
      ORDER BY retardos DESC
      LIMIT 10
    `,
      [desde, parseInt(umbral)],
    );
    res.json({ ok: true, datos: rows, parametros: { umbral, dias, desde } });
  } catch (e) {
    next(e);
  }
};

// ── Tendencia por día (últimos N días) ────────────────────────────────────────
exports.tendenciaDiaria = async (req, res, next) => {
  try {
    const { dias = 14 } = req.query;
    const rows = await db.query(
      `
      SELECT
        fecha,
        COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas
      FROM asistencias
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY fecha
      ORDER BY fecha ASC
    `,
      [parseInt(dias)],
    );
    res.json({ ok: true, datos: rows });
  } catch (e) {
    next(e);
  }
};

// ── Asistencia por materia ────────────────────────────────────────────────────
exports.porMateria = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const desde =
      fecha_inicio ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const hasta = fecha_fin || new Date().toISOString().slice(0, 10);
    const rows = await db.query(
      `
      SELECT
        m.nombre AS materia,
        COUNT(CASE WHEN a.tipo = 'asistencia' THEN 1 END) AS asistencias,
        COUNT(CASE WHEN a.tipo = 'retardo'    THEN 1 END) AS retardos,
        COUNT(CASE WHEN a.tipo = 'falta'      THEN 1 END) AS faltas,
        COUNT(CASE WHEN a.tipo = 'permiso'    THEN 1 END) AS permisos,
        COUNT(*) AS total
      FROM asistencias a
      JOIN horarios h  ON h.id = a.horario_id
      JOIN materias m  ON m.id = h.materia_id
      WHERE a.fecha BETWEEN ? AND ?
      GROUP BY m.id
      ORDER BY total DESC
    `,
      [desde, hasta],
    );
    res.json({ ok: true, datos: rows, rango: { desde, hasta } });
  } catch (e) {
    next(e);
  }
};

// ================================================================
// MÓDULO 7 — EXPORTACIÓN
// ================================================================

async function obtenerDatosReporte(query = {}) {
  const { fecha_inicio, fecha_fin, dias = 30, umbral_faltas = 3 } = query;
  const desde =
    fecha_inicio ||
    new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const hasta = fecha_fin || new Date().toISOString().slice(0, 10);

  const [resumen, porGrupo, faltasCriticas, tendenciaMensual] =
    await Promise.all([
      db.query(
        `SELECT
          COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
          COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
          COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas,
          COUNT(CASE WHEN tipo = 'permiso'    THEN 1 END) AS permisos,
          COUNT(*) AS total
        FROM asistencias WHERE fecha BETWEEN ? AND ?`,
        [desde, hasta],
      ),
      db.query(
        `SELECT
          g.nombre AS grupo,
          COUNT(CASE WHEN as2.tipo = 'asistencia' THEN 1 END) AS asistencias,
          COUNT(CASE WHEN as2.tipo = 'retardo'    THEN 1 END) AS retardos,
          COUNT(CASE WHEN as2.tipo = 'falta'      THEN 1 END) AS faltas,
          COUNT(CASE WHEN as2.tipo = 'permiso'    THEN 1 END) AS permisos
        FROM grupos g
        LEFT JOIN alumnos a ON a.grupo_id = g.id AND a.activo = 1
        LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha BETWEEN ? AND ?
        WHERE g.activo = 1
        GROUP BY g.id ORDER BY g.nombre`,
        [desde, hasta],
      ),
      db.query(
        `SELECT
          a.matricula,
          CONCAT(a.nombre,' ',a.apellido_pat) AS alumno,
          g.nombre AS grupo,
          COUNT(CASE WHEN as2.tipo = 'falta'   THEN 1 END) AS faltas,
          COUNT(CASE WHEN as2.tipo = 'retardo' THEN 1 END) AS retardos,
          COUNT(CASE WHEN as2.tipo = 'permiso' THEN 1 END) AS permisos
        FROM alumnos a
        JOIN grupos g ON g.id = a.grupo_id
        LEFT JOIN asistencias as2 ON as2.alumno_id = a.id AND as2.fecha >= ?
        WHERE a.activo = 1
        GROUP BY a.id
        HAVING faltas >= ?
        ORDER BY faltas DESC`,
        [desde, parseInt(umbral_faltas)],
      ),
      db.query(
        `SELECT
          DATE_FORMAT(fecha, '%Y-%m') AS mes,
          COUNT(CASE WHEN tipo = 'asistencia' THEN 1 END) AS asistencias,
          COUNT(CASE WHEN tipo = 'retardo'    THEN 1 END) AS retardos,
          COUNT(CASE WHEN tipo = 'falta'      THEN 1 END) AS faltas
        FROM asistencias
        WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY mes ORDER BY mes`,
      ),
    ]);

  return {
    desde,
    hasta,
    resumen: resumen[0] || {},
    porGrupo,
    faltasCriticas,
    tendenciaMensual,
  };
}

// ── GET /api/reportes/exportar-excel ─────────────────────────────────────────
exports.exportarExcel = async (req, res, next) => {
  try {
    const datos = await obtenerDatosReporte(req.query);
    const { desde, hasta, resumen, porGrupo, faltasCriticas, tendenciaMensual } = datos;

    const wb = new ExcelJS.Workbook();
    wb.creator = "SIGA";
    wb.created = new Date();

    const estiloEncabezado = {
      font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a6e4a" } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: { bottom: { style: "thin", color: { argb: "FFcccccc" } } },
    };
    const estiloNumero = { alignment: { horizontal: "right" }, numFmt: "#,##0" };
    const estiloPct   = { alignment: { horizontal: "right" }, numFmt: "0.0%" };

    const aplicarEncabezado = (row) => {
      row.eachCell((cell) => Object.assign(cell, estiloEncabezado));
      row.height = 22;
    };

    // HOJA 1 — Resumen
    const wsResumen = wb.addWorksheet("Resumen");
    wsResumen.columns = [
      { header: "Concepto",    key: "concepto", width: 28 },
      { header: "Cantidad",    key: "cantidad",  width: 14 },
      { header: "Porcentaje",  key: "pct",       width: 14 },
    ];
    wsResumen.mergeCells("A1:C1");
    const tR = wsResumen.getCell("A1");
    tR.value = `SIGA — Reporte de Asistencias  (${desde} al ${hasta})`;
    tR.font = { bold: true, size: 13, color: { argb: "FF1a6e4a" } };
    tR.alignment = { horizontal: "center" };
    wsResumen.getRow(1).height = 26;
    wsResumen.addRow([]);
    aplicarEncabezado(wsResumen.addRow(["Concepto", "Cantidad", "Porcentaje"]));
    const total = resumen.total || 1;
    [
      ["✅ Asistencias", resumen.asistencias, resumen.asistencias / total],
      ["⚠  Retardos",    resumen.retardos,    resumen.retardos / total],
      ["🚨 Faltas",      resumen.faltas,       resumen.faltas / total],
      ["📋 Permisos",    resumen.permisos,     resumen.permisos / total],
      ["TOTAL",          resumen.total,        1],
    ].forEach(([concepto, cantidad, pct]) => {
      const row = wsResumen.addRow({ concepto, cantidad, pct });
      row.getCell("cantidad").style = estiloNumero;
      row.getCell("pct").style     = estiloPct;
      if (concepto === "TOTAL") {
        row.font = { bold: true };
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf0fdf4" } };
      }
    });

    // HOJA 2 — Por grupo
    const wsGrupos = wb.addWorksheet("Por Grupo");
    wsGrupos.columns = [
      { header: "Grupo",        key: "grupo",       width: 24 },
      { header: "Asistencias",  key: "asistencias",  width: 14 },
      { header: "Retardos",     key: "retardos",     width: 12 },
      { header: "Faltas",       key: "faltas",       width: 10 },
      { header: "Permisos",     key: "permisos",     width: 11 },
      { header: "Total",        key: "tot",          width: 10 },
      { header: "% Asistencia", key: "pct",          width: 14 },
    ];
    wsGrupos.mergeCells("A1:G1");
    const tG = wsGrupos.getCell("A1");
    tG.value = `Asistencia por Grupo  (${desde} al ${hasta})`;
    tG.font = { bold: true, size: 12, color: { argb: "FF1a6e4a" } };
    tG.alignment = { horizontal: "center" };
    wsGrupos.getRow(1).height = 24;
    wsGrupos.addRow([]);
    aplicarEncabezado(
      wsGrupos.addRow(["Grupo", "Asistencias", "Retardos", "Faltas", "Permisos", "Total", "% Asistencia"])
    );
    porGrupo.forEach((r) => {
      const tot = (r.asistencias||0)+(r.retardos||0)+(r.faltas||0)+(r.permisos||0);
      const pct = tot ? r.asistencias / tot : 0;
      const row = wsGrupos.addRow({ grupo: r.grupo, asistencias: r.asistencias, retardos: r.retardos, faltas: r.faltas, permisos: r.permisos, tot, pct });
      ["asistencias","retardos","faltas","permisos","tot"].forEach((k) => (row.getCell(k).style = estiloNumero));
      row.getCell("pct").style = estiloPct;
      const color = pct >= 0.85 ? "FFdcfce7" : pct >= 0.70 ? "FFfef9c3" : "FFffe4e6";
      row.getCell("pct").fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    });

    // HOJA 3 — Faltas críticas
    const wsFaltas = wb.addWorksheet("Faltas Críticas");
    wsFaltas.columns = [
      { header: "Matrícula", key: "matricula", width: 14 },
      { header: "Alumno",    key: "alumno",    width: 30 },
      { header: "Grupo",     key: "grupo",     width: 20 },
      { header: "Faltas",    key: "faltas",    width: 10 },
      { header: "Retardos",  key: "retardos",  width: 11 },
      { header: "Permisos",  key: "permisos",  width: 11 },
    ];
    wsFaltas.mergeCells("A1:F1");
    const tF = wsFaltas.getCell("A1");
    tF.value = `Alumnos con Faltas Críticas  (últimos ${req.query.dias || 30} días, umbral ≥ ${req.query.umbral_faltas || 3})`;
    tF.font = { bold: true, size: 12, color: { argb: "FFb91c1c" } };
    tF.alignment = { horizontal: "center" };
    wsFaltas.getRow(1).height = 24;
    wsFaltas.addRow([]);
    aplicarEncabezado(wsFaltas.addRow(["Matrícula", "Alumno", "Grupo", "Faltas", "Retardos", "Permisos"]));
    if (faltasCriticas.length === 0) {
      wsFaltas.addRow(["—", "Sin alumnos en esta condición", "", 0, 0, 0]);
    } else {
      faltasCriticas.forEach((r) => {
        const row = wsFaltas.addRow({ matricula: r.matricula, alumno: r.alumno, grupo: r.grupo, faltas: r.faltas, retardos: r.retardos, permisos: r.permisos });
        ["faltas","retardos","permisos"].forEach((k) => (row.getCell(k).style = estiloNumero));
        if (r.faltas >= 5) row.getCell("faltas").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFffe4e6" } };
      });
    }

    // HOJA 4 — Tendencia mensual
    const wsTend = wb.addWorksheet("Tendencia Mensual");
    wsTend.columns = [
      { header: "Mes",          key: "mes",         width: 14 },
      { header: "Asistencias",  key: "asistencias",  width: 14 },
      { header: "Retardos",     key: "retardos",     width: 12 },
      { header: "Faltas",       key: "faltas",       width: 10 },
      { header: "Total",        key: "tot",          width: 10 },
      { header: "% Asistencia", key: "pct",          width: 14 },
    ];
    wsTend.mergeCells("A1:F1");
    const tT = wsTend.getCell("A1");
    tT.value = "Tendencia Mensual (últimos 6 meses)";
    tT.font = { bold: true, size: 12, color: { argb: "FF1a6e4a" } };
    tT.alignment = { horizontal: "center" };
    wsTend.getRow(1).height = 24;
    wsTend.addRow([]);
    aplicarEncabezado(wsTend.addRow(["Mes", "Asistencias", "Retardos", "Faltas", "Total", "% Asistencia"]));
    tendenciaMensual.forEach((r) => {
      const tot = (r.asistencias||0)+(r.retardos||0)+(r.faltas||0);
      const pct = tot ? r.asistencias / tot : 0;
      const row = wsTend.addRow({ mes: r.mes, asistencias: r.asistencias, retardos: r.retardos, faltas: r.faltas, tot, pct });
      ["asistencias","retardos","faltas","tot"].forEach((k) => (row.getCell(k).style = estiloNumero));
      row.getCell("pct").style = estiloPct;
    });

    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="SIGA_Reporte_${fecha}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
};

// ── GET /api/reportes/exportar-pdf ────────────────────────────────────────────
exports.exportarPDF = async (req, res, next) => {
  let browser = null;
  try {
    const datos = await obtenerDatosReporte(req.query);
    const { desde, hasta, resumen, porGrupo, faltasCriticas, tendenciaMensual } = datos;
    const total = resumen.total || 1;
    const pctAsistencia = Math.round((resumen.asistencias / total) * 100);

    const filasGrupo = porGrupo.map((r) => {
      const tot = (r.asistencias||0)+(r.retardos||0)+(r.faltas||0)+(r.permisos||0);
      const pct = tot ? Math.round((r.asistencias / tot) * 100) : 0;
      const color = pct >= 85 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
      return `<tr><td>${r.grupo}</td><td class="num">${r.asistencias}</td><td class="num">${r.retardos}</td><td class="num">${r.faltas}</td><td class="num">${r.permisos}</td><td class="num" style="font-weight:600;color:${color}">${pct}%</td></tr>`;
    }).join("");

    const filasFaltas = faltasCriticas.length
      ? faltasCriticas.map((r) => `<tr><td>${r.matricula}</td><td>${r.alumno}</td><td>${r.grupo}</td><td class="num danger">${r.faltas}</td><td class="num">${r.retardos}</td><td class="num">${r.permisos}</td></tr>`).join("")
      : `<tr><td colspan="6" style="text-align:center;color:#6b7280">Sin alumnos en esta condición</td></tr>`;

    const filasTend = tendenciaMensual.map((r) => {
      const tot = (r.asistencias||0)+(r.retardos||0)+(r.faltas||0);
      const pct = tot ? Math.round((r.asistencias / tot) * 100) : 0;
      return `<tr><td>${r.mes}</td><td class="num">${r.asistencias}</td><td class="num">${r.retardos}</td><td class="num">${r.faltas}</td><td class="num">${tot}</td><td class="num">${pct}%</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:11px; color:#111827; padding:32px; }
h1 { font-size:18px; color:#1a6e4a; margin-bottom:2px; }
.subtitle { font-size:11px; color:#6b7280; margin-bottom:24px; }
h2 { font-size:13px; color:#1f2937; margin:20px 0 8px; border-bottom:1px solid #e5e7eb; padding-bottom:4px; }
.kpis { display:flex; gap:12px; margin-bottom:8px; }
.kpi { flex:1; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px 12px; }
.kpi.warn { background:#fffbeb; border-color:#fde68a; }
.kpi.danger { background:#fef2f2; border-color:#fecaca; }
.kpi.info { background:#eff6ff; border-color:#bfdbfe; }
.kpi-val { font-size:22px; font-weight:700; }
.kpi-label { font-size:10px; color:#6b7280; margin-top:2px; }
table { width:100%; border-collapse:collapse; margin-bottom:4px; }
th { background:#1a6e4a; color:#fff; padding:6px 8px; text-align:left; font-size:10px; }
td { padding:5px 8px; border-bottom:1px solid #f3f4f6; }
tr:nth-child(even) td { background:#f9fafb; }
.num { text-align:right; }
.danger { color:#dc2626; font-weight:600; }
.footer { margin-top:28px; font-size:9px; color:#9ca3af; text-align:right; }
</style></head><body>
<h1>SIGA — Reporte de Asistencias</h1>
<p class="subtitle">Período: ${desde} al ${hasta} &nbsp;·&nbsp; Generado el ${new Date().toLocaleString("es-MX")}</p>
<h2>Resumen del período</h2>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${resumen.asistencias??0}</div><div class="kpi-label">Asistencias (${pctAsistencia}%)</div></div>
  <div class="kpi warn"><div class="kpi-val">${resumen.retardos??0}</div><div class="kpi-label">Retardos</div></div>
  <div class="kpi danger"><div class="kpi-val">${resumen.faltas??0}</div><div class="kpi-label">Faltas</div></div>
  <div class="kpi info"><div class="kpi-val">${resumen.permisos??0}</div><div class="kpi-label">Permisos</div></div>
  <div class="kpi"><div class="kpi-val">${resumen.total??0}</div><div class="kpi-label">Total registros</div></div>
</div>
<h2>Asistencia por grupo</h2>
<table><thead><tr><th>Grupo</th><th>Asistencias</th><th>Retardos</th><th>Faltas</th><th>Permisos</th><th>% Asistencia</th></tr></thead><tbody>${filasGrupo}</tbody></table>
<h2>Alumnos con faltas críticas (umbral ≥ ${req.query.umbral_faltas||3})</h2>
<table><thead><tr><th>Matrícula</th><th>Alumno</th><th>Grupo</th><th>Faltas</th><th>Retardos</th><th>Permisos</th></tr></thead><tbody>${filasFaltas}</tbody></table>
<h2>Tendencia mensual (últimos 6 meses)</h2>
<table><thead><tr><th>Mes</th><th>Asistencias</th><th>Retardos</th><th>Faltas</th><th>Total</th><th>% Asistencia</th></tr></thead><tbody>${filasTend}</tbody></table>
<div class="footer">SIGA — Sistema Inteligente de Gestión de Asistencias</div>
</body></html>`;

    browser = await puppeteer.launch({
      headless: "new",
      executablePath: CHROMIUM_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });
    await browser.close();
    browser = null;

    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="SIGA_Reporte_${fecha}.pdf"`);
    res.end(pdf);
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    next(e);
  }
};
