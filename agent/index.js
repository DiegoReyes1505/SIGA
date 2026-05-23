/**
 * SIGA — Agente Local
 * Lee el puerto serial del AS608 y reenvía eventos al servidor en la nube.
 * Corre en la PC de la escuela donde está conectado el Arduino.
 *
 * Comunicación bidireccional via Socket.io:
 * - Agente → Servidor: eventos del sensor (match, enroll, delete)
 * - Servidor → Agente: comandos (ENROLL, DELETE, COUNT)
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { io } = require("socket.io-client");
const logger = require("../server/utils/logger");

const SERIAL_PORT = process.env.SERIAL_PORT || "COM3";
const SERIAL_BAUD = parseInt(process.env.SERIAL_BAUD || "9600");
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const AGENT_SECRET = process.env.AGENT_SECRET || "cambiar_en_produccion";

// ── Pending enrolls: huella_id → alumno_id ───────────────────
const pendingEnroll = new Map();

// ── Conexión Socket.io al servidor ───────────────────────────
const socket = io(SERVER_URL, {
  auth: { secret: AGENT_SECRET },
  reconnection: true,
  reconnectionDelay: 3000,
  reconnectionAttempts: Infinity,
});

socket.on("connect", () => {
  logger.info(`✅ Conectado al servidor: ${SERVER_URL} (id: ${socket.id})`);
});

socket.on("disconnect", (reason) => {
  logger.warn(`⚠️  Desconectado del servidor: ${reason}. Reconectando...`);
});

socket.on("connect_error", (err) => {
  logger.error(`❌ Error de conexión: ${err.message}`);
});

// ── Comandos que llegan desde el servidor via Socket.io ──────
socket.on("agente:comando", ({ cmd }) => {
  if (!cmd || !port || !port.isOpen) return;
  logger.info("Comando recibido del servidor:", { cmd });

  if (cmd.startsWith("ENROLL:")) {
    const parts = cmd.split(":");
    const huella_id = parseInt(parts[1]);
    const alumno_id = parseInt(parts[2]);
    if (alumno_id) pendingEnroll.set(huella_id, alumno_id);
    port.write(`ENROLL:${huella_id}\n`);
  } else {
    port.write(`${cmd}\n`);
  }
});

// ── Enviar evento al servidor via Socket.io ──────────────────
function enviar(evento, data) {
  if (!socket.connected) {
    logger.warn("Socket desconectado, evento perdido:", { evento, data });
    return;
  }
  socket.emit(evento, data);
  logger.info(`→ ${evento}`, data);
}

// ── Parsear línea del serial ──────────────────────────────────
let port; // referencia global para usarla en el handler de socket

function parsearLinea(linea) {
  linea = linea.trim();
  logger.debug("Serial:", { linea });

  if (linea === "STATUS:SENSOR_OK")
    return enviar("agente:evento", { tipo: "SENSOR_OK", raw: linea });

  if (linea === "STATUS:SENSOR_ERROR")
    return enviar("agente:evento", { tipo: "SENSOR_ERROR", raw: linea });

  if (linea === "VERIFY:NOT_FOUND")
    return enviar("agente:evento", { tipo: "NOT_FOUND", raw: linea });

  if (linea.startsWith("VERIFY:MATCH:")) {
    const huella_id = parseInt(linea.split(":")[2]);
    return enviar("agente:evento", { tipo: "MATCH", huella_id, raw: linea });
  }

  if (linea.startsWith("ENROLL:SUCCESS:")) {
    const huella_id = parseInt(linea.split(":")[2]);
    const alumno_id = pendingEnroll.get(huella_id);
    pendingEnroll.delete(huella_id);
    if (alumno_id) return enviar("agente:enroll", { huella_id, alumno_id });
    else logger.warn("ENROLL:SUCCESS sin alumno_id pendiente", { huella_id });
  }

  if (linea.startsWith("DELETE:SUCCESS:")) {
    const huella_id = parseInt(linea.split(":")[2]);
    return enviar("agente:delete", { huella_id });
  }

  if (linea.startsWith("COUNT:")) {
    logger.info("Huellas en sensor:", { count: linea.split(":")[1] });
  }

  // Estados intermedios de enroll
  const estadosEnroll = {
    "ENROLL:PLACE_FINGER": {
      estado: "place_finger",
      mensaje: "Coloca el dedo en el sensor",
    },
    "ENROLL:REMOVE_FINGER": {
      estado: "remove_finger",
      mensaje: "Retira el dedo del sensor",
    },
    "ENROLL:PLACE_AGAIN": {
      estado: "place_again",
      mensaje: "Coloca el mismo dedo nuevamente",
    },
  };

  if (estadosEnroll[linea]) {
    return enviar("agente:evento", {
      tipo: "ENROLL_STATUS",
      ...estadosEnroll[linea],
      raw: linea,
    });
  }

  if (linea === "ENROLL:ERROR") {
    return enviar("agente:evento", {
      tipo: "ENROLL_ERROR",
      mensaje: "Ocurrió un error al registrar la huella",
      raw: linea,
    });
  }
}

// ── Puerto serial ─────────────────────────────────────────────
function iniciarSerial() {
  logger.info(`Abriendo serial: ${SERIAL_PORT} @ ${SERIAL_BAUD} baud`);

  port = new SerialPort({ path: SERIAL_PORT, baudRate: SERIAL_BAUD });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  port.on("open", () => logger.info("✅ Puerto serial abierto"));
  port.on("error", (err) => logger.error("Error serial", { msg: err.message }));
  port.on("close", () => {
    logger.warn("Puerto serial cerrado. Reintentando en 5s…");
    setTimeout(iniciarSerial, 5000);
  });

  parser.on("data", parsearLinea);
}

iniciarSerial();
