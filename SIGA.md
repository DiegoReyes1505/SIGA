SIGA
├── .env
├── .env.example
├── .gitignore
├── agent/
│   └── index.js
├── database/
│   ├── migrations/
│   │   ├── run.js
│   │   └── schema.sql
│   └── seeds/
│       └── run.js
├── diag.js
├── package-lock.json
├── package.json
├── public/
│   ├── alumnos.html
│   ├── analisis.html
│   ├── css/
│   │   ├── alumnos.css
│   │   ├── analisis.css
│   │   ├── app.css
│   │   └── dashboard.css
│   ├── dashboard.html
│   ├── historial.html
│   ├── huellas-asistencias.html
│   ├── js/
│   │   ├── alumnos.js
│   │   ├── analisis.js
│   │   ├── common.js
│   │   ├── dashboard.js
│   │   ├── historial.js
│   │   ├── huellas-asistencias.js
│   │   └── permisos.js
│   ├── pages/
│   └── permisos.html
├── README.md
└── server/
    ├── controllers/
    │   ├── agent.js
    │   ├── alumnos.js
    │   ├── asistencias.js
    │   ├── grupos.js
    │   ├── horarios.js
    │   ├── materias.js
    │   ├── permisos.js
    │   ├── reader.js
    │   ├── reportes.js
    │   ├── sensor.js
    │   └── sync-permisos.js
    ├── index.js
    ├── middleware/
    │   ├── auth.js
    │   └── validate.js
    ├── routes/
    │   ├── agent.js
    │   ├── alumnos.js
    │   ├── asistencias.js
    │   ├── grupos.js
    │   ├── horarios.js
    │   ├── materias.js
    │   ├── permisos.js
    │   ├── reader.js
    │   ├── reportes.js
    │   └── sensor.js
    ├── services/
    │   ├── permisos.js
    │   └── reader-state.js
    └── utils/
        ├── db.js
        └── logger.js
