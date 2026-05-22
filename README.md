# SIGA — Sistema Inteligente de Gestión de Asistencias

Sistema web para control de asistencias escolares mediante sensor de huella digital AS608.

## Stack Tecnológico
- **Backend**: Node.js + Express
- **Base de datos**: MySQL
- **Tiempo real**: Socket.io
- **Sensor**: AS608 via Arduino (serialport)
- **Exportación**: ExcelJS + Puppeteer (PDF)
- **Nube**: Railway / Render

## Arquitectura

```
[Arduino AS608] ──USB──► [Agente Local :3001]
                                │
                         HTTPS + x-agent-secret
                                ▼
                    [Servidor Node.js en Railway]
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                  MySQL     Socket.io    API REST
                                │
                                ▼
                    [Dashboard Web (navegador)]
```

## Módulos
| # | Módulo | Estado |
|---|--------|--------|
| 0 | Setup, DB, estructura | ✅ Completo |
| 1 | Agente serial local   | ✅ Completo |
| 2 | Alta de alumnos       | 🔜 Pendiente |
| 3 | Registro de asistencia| 🔜 Pendiente |
| 4 | Historial             | 🔜 Pendiente |
| 5 | Dashboard en tiempo real | 🔜 Pendiente |
| 6 | Inteligencia de negocios | 🔜 Pendiente |
| 7 | Exportación PDF/Excel | 🔜 Pendiente |
| 8 | Despliegue Railway    | 🔜 Pendiente |

## Instalación

### Prerrequisitos
- Node.js 18+
- MySQL 8+
- Arduino con AS608 conectado

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Crear tablas
npm run db:migrate

# 4. Insertar datos de prueba
npm run db:seed

# 5. Arrancar servidor
npm run dev

# En otra terminal — arrancar agente local (PC con Arduino)
npm run agent
```

## Protocolo Serial AS608

El Arduino envía líneas de texto terminadas en `\r\n`:

| Línea | Significado |
|-------|-------------|
| `STATUS:SENSOR_OK` | Sensor inicializado correctamente |
| `STATUS:SENSOR_ERROR` | Error de comunicación |
| `VERIFY:MATCH:{id}` | Huella encontrada con ID {id} |
| `VERIFY:NOT_FOUND` | Huella no reconocida |
| `ENROLL:SUCCESS:{id}` | Huella registrada con ID {id} |
| `DELETE:SUCCESS:{id}` | Huella eliminada |

El agente envía comandos al Arduino:

| Comando | Efecto |
|---------|--------|
| `ENROLL:{id}\n` | Iniciar registro de huella en slot {id} |
| `DELETE:{id}\n` | Eliminar huella del slot {id} |
| `COUNT\n` | Contar huellas almacenadas |

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (default 3000) |
| `DB_*` | Credenciales MySQL |
| `SERIAL_PORT` | Puerto COM (Windows: `COM3`, Linux: `/dev/ttyUSB0`) |
| `SERVER_URL` | URL del servidor en la nube |
| `AGENT_SECRET` | Clave compartida agente↔servidor |
