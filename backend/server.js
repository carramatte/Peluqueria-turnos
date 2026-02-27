const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// ── Inicializar base de datos ──
require('./database');

const appointmentsRouter = require('./routes/appointments');
const availabilityRouter = require('./routes/availability');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// ── Rutas ──
app.use('/api/appointments', appointmentsRouter);
app.use('/api', availabilityRouter);

// ── Health check ──
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Peluquería Turnos API',
        timestamp: new Date().toISOString()
    });
});

// ── Manejo de errores global ──
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: err.message
    });
});

// ── Iniciar servidor ──
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend API corriendo en http://0.0.0.0:${PORT}`);
    console.log(`📋 Endpoints disponibles:`);
    console.log(`   GET  /api/health`);
    console.log(`   GET  /api/services`);
    console.log(`   GET  /api/availability?date=YYYY-MM-DD`);
    console.log(`   GET  /api/appointments`);
    console.log(`   POST /api/appointments`);
    console.log(`   PUT  /api/appointments/:id`);
    console.log(`   DELETE /api/appointments/:id`);
});
