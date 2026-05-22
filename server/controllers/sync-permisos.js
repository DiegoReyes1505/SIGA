// ================================================================
// SIGA — Re-sincronización de permisos → asistencias
// GET /api/permisos/sync
// ================================================================
const { aplicarPermiso } = require("../services/permisos");
const db = require("../utils/db");

exports.sync = async (req, res, next) => {
  try {
    const permisos = await db.query(
      `SELECT id FROM permisos WHERE activo = 1 ORDER BY id ASC`,
    );

    if (!permisos.length) {
      return res.json({
        ok: true,
        mensaje: "No hay permisos activos para sincronizar.",
        sincronizados: 0,
      });
    }

    const resultados = [];

    for (const permiso of permisos) {
      try {
        await aplicarPermiso(permiso.id);
        resultados.push({ id: permiso.id, ok: true });
      } catch (e) {
        resultados.push({ id: permiso.id, ok: false, error: e.message });
      }
    }

    const exitosos = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.filter((r) => !r.ok).length;

    res.json({
      ok: true,
      mensaje: `Sincronización completa. ${exitosos} permiso(s) aplicado(s), ${fallidos} con error.`,
      sincronizados: exitosos,
      errores: fallidos,
      detalle: resultados,
    });
  } catch (e) {
    next(e);
  }
};
