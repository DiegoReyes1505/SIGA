require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const logger = require("./utils/logger");

const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
app.set("io", io);

let agenteSocket = null;

io.on("connection", (socket) => {
  const secret = socket.handshake.auth?.secret;
  const esAgente = secret && secret === process.env.AGENT_SECRET;

  if (esAgente) {
    agenteSocket = socket;
    logger.info("Agente local conectado", { id: socket.id });

    socket.on("agente:enroll", async ({ huella_id, alumno_id }) => {
      try {
        const db = require("./utils/db");
        const readerState = require("./services/reader-state");
        await db.query("UPDATE alumnos SET huella_id = ? WHERE id = ?", [huella_id, alumno_id]);
        readerState.startCooldown(3);
        io.emit("reader:cooldown", readerState.getState());
        io.emit("sensor:enroll_ok", { huella_id, alumno_id });
        logger.info("Huella enrollada y guardada en BD", { huella_id, alumno_id });
      } catch (e) {
        logger.error("Error al guardar huella en BD", { msg: e.message });
        io.emit("sensor:enroll_error", { mensaje: "Error al guardar huella en la base de datos" });
      }
    });

    socket.on("agente:delete", async ({ huella_id }) => {
      try {
        const db = require("./utils/db");
        const readerState = require("./services/reader-state");
        await db.query("UPDATE alumnos SET huella_id = NULL WHERE huella_id = ?", [huella_id]);
        readerState.startCooldown(3);
        io.emit("reader:cooldown", readerState.getState());
        io.emit("sensor:delete_ok", { huella_id });
        logger.info("Huella eliminada de BD", { huella_id });
      } catch (e) {
        logger.error("Error al eliminar huella de BD", { msg: e.message });
      }
    });

    socket.on("agente:evento", async (data) => {
      try {
        const { procesarEventoSensor } = require("./services/sensor-eventos");
        await procesarEventoSensor(data, io);
      } catch (e) {
        logger.error("Error en agente:evento", { msg: e.message });
      }
    });

    socket.on("disconnect", () => {
      logger.warn("Agente local desconectado", { id: socket.id });
      if (agenteSocket?.id === socket.id) agenteSocket = null;
    });
  } else {
    logger.info("Cliente web conectado", { id: socket.id });
    socket.on("disconnect", () => logger.info("Cliente web desconectado", { id: socket.id }));
  }
});

app.set("agenteSocket", () => agenteSocket);

// ── Middleware ─────────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => res.redirect("/alumnos.html"));

// ── Archivos estáticos ────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ── Rutas API ────────────────────────────────────────────────────────────────────────
app.use("/api/grupos",      require("./routes/grupos"));
app.use("/api/materias",    require("./routes/materias"));
app.use("/api/horarios",    require("./routes/horarios"));
app.use("/api/alumnos",     require("./routes/alumnos"));
app.use("/api/asistencias", require("./routes/asistencias"));
app.use("/api/sensor",      require("./routes/sensor"));
app.use("/api/reportes",    require("./routes/reportes"));
app.use("/api/agent",       require("./routes/agent"));
app.use("/api/reader",      require("./routes/reader"));
app.use("/api/permisos",    require("./routes/permisos"));
app.use("/api/migracion",   require("./routes/migracion")); // TEMPORAL — eliminar tras ejecutar

// ── SPA fallback ───────────────────────────────────────────────────────────────────────
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

// ── Manejador global de errores ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({ ok: false, mensaje: err.message || "Error interno del servidor" });
});

// ── Arranque ────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Servidor SIGA corriendo en http://localhost:${PORT}`);
  const { iniciarJobFaltas } = require('./services/faltas');
  iniciarJobFaltas(io); // pasa io para emitir eventos en tiempo real
});

module.exports = { app, io };
