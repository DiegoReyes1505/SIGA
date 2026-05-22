/**
 * SIGA — Agente Local
 * Lee el puerto serial del AS608 y reenvía eventos al servidor en la nube.
 * Corre en la PC de la escuela donde está conectado el Arduino.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const axios = require("axios");
const logger = require("../server/utils/logger");

const SERIAL_PORT = process.env.SERIAL_PORT || "COM3";
const SERIAL_BAUD = parseInt(process.env.SERIAL_BAUD || "9600");
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const AGENT_SECRET = process.env.AGENT_SECRET || "cambiar_en_produccion";

const headers = {
  "x-agent-secret": AGENT_SECRET,
  "Content-Type": "application/json",
};

// ── Pending enrolls: alumno_id esperando confirmación ────────
const pendingEnroll = new Map(); // huella_id (temporal) → alumno_id

// ── Función para enviar al servidor ──────────────────────────
async function enviar(endpoint, data) {
  try {
    const res = await axios.post(`${SERVER_URL}/api/sensor/${endpoint}`, data, {
      headers,
    });
    logger.info(`→ ${endpoint}`, res.data);
    return res.data;
  } catch (err) {
    logger.error(`Error enviando ${endpoint}`, { msg: err.message });
  }
}

// ── Parsear línea del serial ──────────────────────────────────
function parsearLinea(linea) {
  linea = linea.trim();
  logger.debug("Serial:", { linea });

  if (linea === "STATUS:SENSOR_OK")
    return enviar("evento", { tipo: "SENSOR_OK", raw: linea });
  if (linea === "STATUS:SENSOR_ERROR")
    return enviar("evento", { tipo: "SENSOR_ERROR", raw: linea });
  if (linea === "VERIFY:NOT_FOUND")
    return enviar("evento", { tipo: "NOT_FOUND", raw: linea });

  if (linea.startsWith("VERIFY:MATCH:")) {
    const huella_id = parseInt(linea.split(":")[2]);
    return enviar("evento", { tipo: "MATCH", huella_id, raw: linea });
  }

  if (linea.startsWith("ENROLL:SUCCESS:")) {
    const huella_id = parseInt(linea.split(":")[2]);
    const alumno_id = pendingEnroll.get(huella_id);
    pendingEnroll.delete(huella_id);
    if (alumno_id) return enviar("enroll", { huella_id, alumno_id });
    else logger.warn("ENROLL:SUCCESS sin alumno_id pendiente", { huella_id });
  }

  if (linea.startsWith("DELETE:SUCCESS:")) {
    const huella_id = parseInt(linea.split(":")[2]);
    return enviar("delete", { huella_id });
  }

  if (linea.startsWith("COUNT:")) {
    logger.info("Huellas en sensor:", { count: linea.split(":")[1] });
  }

  // Estados intermedios de enroll — solo log
  if (linea === "ENROLL:PLACE_FINGER") {
    enviar("evento", {
      tipo: "ENROLL_STATUS",
      estado: "place_finger",
      mensaje: "Coloca el dedo en el sensor",
      raw: linea,
    });
    return;
  }

  if (linea === "ENROLL:REMOVE_FINGER") {
    enviar("evento", {
      tipo: "ENROLL_STATUS",
      estado: "remove_finger",
      mensaje: "Retira el dedo del sensor",
      raw: linea,
    });
    return;
  }

  if (linea === "ENROLL:PLACE_AGAIN") {
    enviar("evento", {
      tipo: "ENROLL_STATUS",
      estado: "place_again",
      mensaje: "Coloca el mismo dedo nuevamente",
      raw: linea,
    });
    return;
  }

  if (linea === "ENROLL:ERROR") {
    enviar("evento", {
      tipo: "ENROLL_ERROR",
      mensaje: "Ocurrió un error al registrar la huella",
      raw: linea,
    });
    return;
  }
}

// ── Puerto serial ─────────────────────────────────────────────
function iniciarSerial() {
  logger.info(`Abriendo serial: ${SERIAL_PORT} @ ${SERIAL_BAUD} baud`);

  const port = new SerialPort({ path: SERIAL_PORT, baudRate: SERIAL_BAUD });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  port.on("open", () => logger.info("✅ Puerto serial abierto"));
  port.on("error", (err) => logger.error("Error serial", { msg: err.message }));
  port.on("close", () => {
    logger.warn("Puerto serial cerrado. Reintentando en 5s…");
    setTimeout(iniciarSerial, 5000);
  });

  parser.on("data", parsearLinea);

  // ── API para comandos desde el servidor (HTTP local) ─────
  const express = require("express");
  const app = express();
  app.use(express.json());

  // El servidor en la nube puede mandar comandos al agente
  app.post("/cmd", (req, res) => {
    const { cmd } = req.body; // ej: "ENROLL:5" o "DELETE:5"
    if (!cmd) return res.status(400).json({ ok: false });
    // Si es enroll, registrar alumno_id pendiente
    if (cmd.startsWith("ENROLL:")) {
      const parts = cmd.split(":");
      const huella_id = parseInt(parts[1]);
      const alumno_id = parseInt(parts[2]);
      if (alumno_id) pendingEnroll.set(huella_id, alumno_id);
      port.write(`ENROLL:${huella_id}\n`);
    } else {
      port.write(`${cmd}\n`);
    }
    logger.info("Comando enviado al sensor:", { cmd });
    res.json({ ok: true });
  });

  app.post("/cancel-enroll", (req, res) => {
    if (port && port.isOpen) {
      port.write("CANCEL\n");
    }
    res.json({ ok: true });
  });

  const AGENT_PORT = process.env.AGENT_PORT || 3001;
  app.listen(AGENT_PORT, () =>
    logger.info(`Agente HTTP escuchando en :${AGENT_PORT}`),
  );
}

iniciarSerial();
