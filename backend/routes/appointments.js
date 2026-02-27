const express = require('express');
const router = express.Router();
const db = require('../database');

// ── GET /api/appointments ──
// Lista turnos con filtros opcionales: ?date=YYYY-MM-DD&status=confirmed
router.get('/', (req, res) => {
    try {
        const { date, status, phone } = req.query;
        let query = 'SELECT * FROM appointments WHERE 1=1';
        const params = [];

        if (date) {
            query += ' AND date = ?';
            params.push(date);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (phone) {
            query += ' AND client_phone = ?';
            params.push(phone);
        }

        query += ' ORDER BY date ASC, time ASC';

        const appointments = db.prepare(query).all(...params);
        res.json({ success: true, data: appointments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── GET /api/appointments/pending-reminders ──
// Turnos en los próximos 15 min sin recordatorio enviado
router.get('/pending-reminders', (req, res) => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMin = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHour}:${currentMin}`;

        // Calcular hora +15 minutos
        const future = new Date(now.getTime() + 15 * 60 * 1000);
        const futureHour = future.getHours().toString().padStart(2, '0');
        const futureMin = future.getMinutes().toString().padStart(2, '0');
        const futureTime = `${futureHour}:${futureMin}`;

        const appointments = db.prepare(`
      SELECT * FROM appointments
      WHERE date = ?
        AND time > ?
        AND time <= ?
        AND status = 'confirmed'
        AND reminder_sent = 0
      ORDER BY time ASC
    `).all(today, currentTime, futureTime);

        res.json({ success: true, data: appointments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── GET /api/appointments/:id ──
router.get('/:id', (req, res) => {
    try {
        const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
        if (!appointment) {
            return res.status(404).json({ success: false, error: 'Turno no encontrado' });
        }
        res.json({ success: true, data: appointment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── POST /api/appointments ──
// Crea un nuevo turno
router.post('/', (req, res) => {
    try {
        const { client_name, client_phone, client_channel, service, date, time } = req.body;

        // Validación básica
        if (!client_name || !client_phone || !service || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: client_name, client_phone, service, date, time'
            });
        }

        // Validar formato de fecha
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de fecha inválido. Usar YYYY-MM-DD'
            });
        }

        // Validar formato de hora
        if (!/^\d{2}:\d{2}$/.test(time)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de hora inválido. Usar HH:MM'
            });
        }

        // Buscar duración del servicio
        const serviceData = db.prepare('SELECT duration_min FROM services WHERE name = ?').get(service);
        const duration = serviceData ? serviceData.duration_min : 30;

        // Verificar que el horario no esté ocupado
        const conflict = db.prepare(`
      SELECT id FROM appointments
      WHERE date = ? AND time = ? AND status != 'cancelled'
    `).get(date, time);

        if (conflict) {
            return res.status(409).json({
                success: false,
                error: 'Ese horario ya está ocupado. Por favor elegí otro.'
            });
        }

        // Insertar turno
        const channel = client_channel || 'whatsapp';
        const result = db.prepare(`
      INSERT INTO appointments (client_name, client_phone, client_channel, service, date, time, duration_min, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `).run(client_name, client_phone, channel, service, date, time, duration);

        const newAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: `✅ Turno confirmado para ${client_name} el ${date} a las ${time}`,
            data: newAppointment
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── PUT /api/appointments/:id ──
// Actualiza un turno existente
router.put('/:id', (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Turno no encontrado' });
        }

        const {
            client_name = existing.client_name,
            client_phone = existing.client_phone,
            service = existing.service,
            date = existing.date,
            time = existing.time,
            status = existing.status,
        } = req.body;

        db.prepare(`
      UPDATE appointments
      SET client_name = ?, client_phone = ?, service = ?, date = ?, time = ?, status = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(client_name, client_phone, service, date, time, status, req.params.id);

        const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── PUT /api/appointments/:id/reminder-sent ──
// Marca el recordatorio como enviado
router.put('/:id/reminder-sent', (req, res) => {
    try {
        db.prepare(`
      UPDATE appointments SET reminder_sent = 1, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(req.params.id);

        res.json({ success: true, message: 'Recordatorio marcado como enviado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── DELETE /api/appointments/:id ──
// Cancela un turno (soft delete)
router.delete('/:id', (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Turno no encontrado' });
        }

        db.prepare(`
      UPDATE appointments SET status = 'cancelled', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(req.params.id);

        res.json({
            success: true,
            message: `Turno #${req.params.id} cancelado correctamente`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
