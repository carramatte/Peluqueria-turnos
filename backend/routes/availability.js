const express = require('express');
const router = express.Router();
const db = require('../database');

// ── Configuración del negocio ──
const BUSINESS_HOURS = {
    open: '09:00',
    close: '19:00',
    slotMinutes: 30,
    daysOff: [0], // 0 = Domingo
};

// ── GET /api/availability?date=YYYY-MM-DD ──
// Devuelve los horarios disponibles para una fecha
router.get('/availability', (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Parámetro "date" requerido (formato YYYY-MM-DD)'
            });
        }

        // Validar formato
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de fecha inválido. Usar YYYY-MM-DD'
            });
        }

        // Verificar que no sea día de descanso
        const dayOfWeek = new Date(date + 'T12:00:00').getDay();
        if (BUSINESS_HOURS.daysOff.includes(dayOfWeek)) {
            return res.json({
                success: true,
                date,
                message: 'Ese día no atendemos. Estamos cerrados los domingos.',
                available_slots: [],
                occupied_slots: []
            });
        }

        // Verificar que la fecha no sea pasada
        const today = new Date();
        const requestedDate = new Date(date + 'T23:59:59');
        if (requestedDate < today) {
            return res.json({
                success: true,
                date,
                message: 'No se pueden reservar turnos en fechas pasadas.',
                available_slots: [],
                occupied_slots: []
            });
        }

        // Generar todos los slots del día
        const allSlots = generateTimeSlots(
            BUSINESS_HOURS.open,
            BUSINESS_HOURS.close,
            BUSINESS_HOURS.slotMinutes
        );

        // Obtener turnos ocupados para esa fecha
        const occupied = db.prepare(`
      SELECT time, duration_min, service, client_name
      FROM appointments
      WHERE date = ? AND status != 'cancelled'
      ORDER BY time ASC
    `).all(date);

        const occupiedTimes = occupied.map(a => a.time);

        // Filtrar slots disponibles (excluir ocupados y slots pasados si es hoy)
        const now = new Date();
        const isToday = date === now.toISOString().split('T')[0];

        const availableSlots = allSlots.filter(slot => {
            if (occupiedTimes.includes(slot)) return false;
            if (isToday) {
                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                if (slot <= currentTime) return false;
            }
            return true;
        });

        res.json({
            success: true,
            date,
            business_hours: `${BUSINESS_HOURS.open} - ${BUSINESS_HOURS.close}`,
            total_slots: allSlots.length,
            available_count: availableSlots.length,
            occupied_count: occupied.length,
            available_slots: availableSlots,
            occupied_slots: occupied
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── GET /api/services ──
// Lista servicios disponibles con precio y duración
router.get('/services', (req, res) => {
    try {
        const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name ASC').all();
        res.json({ success: true, data: services });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Función auxiliar: generar slots de tiempo ──
function generateTimeSlots(open, close, intervalMinutes) {
    const slots = [];
    const [openH, openM] = open.split(':').map(Number);
    const [closeH, closeM] = close.split(':').map(Number);

    let currentH = openH;
    let currentM = openM;

    while (
        currentH < closeH ||
        (currentH === closeH && currentM < closeM)
    ) {
        const timeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
        slots.push(timeStr);

        currentM += intervalMinutes;
        if (currentM >= 60) {
            currentH += Math.floor(currentM / 60);
            currentM = currentM % 60;
        }
    }

    return slots;
}

module.exports = router;
