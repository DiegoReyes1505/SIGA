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

// ── Socket.io ────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
app.set("io", io); // accesible desde controllers

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.redirect("/alumnos.html");
});

// ── Archivos estáticos ───────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ── Rutas API ────────────────────────────────────────────────
app.use("/api/grupos", require("./routes/grupos"));
app.use("/api/materias", require("./routes/materias"));
app.use("/api/horarios", require("./routes/horarios"));
app.use("/api/alumnos", require("./routes/alumnos"));
app.use("/api/asistencias", require("./routes/asistencias"));
app.use("/api/sensor", require("./routes/sensor"));
app.use("/api/reportes", require("./routes/reportes"));
app.use("/api/agent", require("./routes/agent"));
app.use("/api/reader", require("./routes/reader"));
app.use("/api/permisos", require("./routes/permisos"));

// ── SPA fallback ─────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ── Manejador global de errores ──────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({
    ok: false,
    mensaje: err.message || "Error interno del servidor",
  });
});

// ── Socket.io: eventos ───────────────────────────────────────
io.on("connection", (socket) => {
  logger.info("Cliente conectado", { id: socket.id });
  socket.on("disconnect", () =>
    logger.info("Cliente desconectado", { id: socket.id }),
  );
});

// ── Arranque ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Servidor SIGA corriendo en http://localhost:${PORT}`);
});

module.exports = { app, io };
