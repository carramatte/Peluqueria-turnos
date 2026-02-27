// ═══════════════════════════════════════════════════════
//  Peluquería — Panel de Turnos — Frontend Logic
// ═══════════════════════════════════════════════════════

const API_BASE = '/api';

// ── Estado de la app ──
let currentView = 'dashboard';
let services = [];

// ── Inicialización ──
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initDateDefaults();
    loadServices();
    loadDashboard();
    initForm();
    updateHeaderDate();
});

// ── Navegación entre vistas ──
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });

    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('btn-refresh').addEventListener('click', () => {
        loadDashboard();
        showToast('Datos actualizados', 'info');
    });
}

function switchView(viewName) {
    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Mostrar la vista seleccionada
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');

    const navBtn = document.querySelector(`[data-view="${viewName}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Actualizar título
    const titles = {
        'dashboard': 'Dashboard',
        'appointments': 'Gestión de Turnos',
        'new-appointment': 'Nuevo Turno',
        'availability': 'Disponibilidad'
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'Dashboard';

    currentView = viewName;

    // Cargar datos de la vista
    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'appointments') loadAppointments();
    if (viewName === 'availability') loadServicesGrid();

    // Cerrar sidebar en móvil
    document.getElementById('sidebar').classList.remove('open');
}

// ── Fechas por defecto ──
function initDateDefaults() {
    const today = new Date().toISOString().split('T')[0];
    const filterDate = document.getElementById('filter-date');
    const availDate = document.getElementById('avail-date');
    const inputDate = document.getElementById('input-date');

    if (filterDate) filterDate.value = today;
    if (availDate) availDate.value = today;
    if (inputDate) inputDate.min = today;
}

function updateHeaderDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-AR', options);
    document.getElementById('header-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

// ═══════════════════════════════════════════════════════
//  API Calls
// ═══════════════════════════════════════════════════════

async function apiGet(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('API GET error:', err);
        showToast(`Error al cargar datos: ${err.message}`, 'error');
        return null;
    }
}

async function apiPost(endpoint, data) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
    } catch (err) {
        console.error('API POST error:', err);
        showToast(`Error: ${err.message}`, 'error');
        return null;
    }
}

async function apiDelete(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
    } catch (err) {
        console.error('API DELETE error:', err);
        showToast(`Error: ${err.message}`, 'error');
        return null;
    }
}

// ═══════════════════════════════════════════════════════
//  Dashboard
// ═══════════════════════════════════════════════════════

async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];

    // Cargar turnos de hoy
    const appointmentsRes = await apiGet(`/appointments?date=${today}`);
    const availRes = await apiGet(`/availability?date=${today}`);

    if (appointmentsRes && appointmentsRes.success) {
        const data = appointmentsRes.data;
        const confirmed = data.filter(a => a.status === 'confirmed');

        document.getElementById('stat-today-count').textContent = data.length;
        document.getElementById('stat-confirmed-count').textContent = confirmed.length;

        // Renderizar próximos turnos
        const upcomingEl = document.getElementById('upcoming-list');
        if (confirmed.length === 0) {
            upcomingEl.innerHTML = '<p class="empty-state">No hay turnos confirmados para hoy</p>';
        } else {
            upcomingEl.innerHTML = confirmed.map(a => `
        <div class="upcoming-item">
          <span class="upcoming-time">${a.time}</span>
          <div class="upcoming-info">
            <div class="upcoming-name">${escapeHtml(a.client_name)}</div>
            <div class="upcoming-service">${escapeHtml(a.service)} · ${a.duration_min} min · ${getChannelEmoji(a.client_channel)}</div>
          </div>
          <span class="badge badge-${a.status}">${a.status}</span>
        </div>
      `).join('');
        }
    }

    if (availRes && availRes.success) {
        document.getElementById('stat-available-count').textContent = availRes.available_count;
    }

    // Canales activos (estático por ahora)
    document.getElementById('stat-channels-count').textContent = '3';
}

// ═══════════════════════════════════════════════════════
//  Appointments (Turnos)
// ═══════════════════════════════════════════════════════

async function loadAppointments() {
    const date = document.getElementById('filter-date').value;
    const status = document.getElementById('filter-status').value;

    let endpoint = '/appointments?';
    if (date) endpoint += `date=${date}&`;
    if (status) endpoint += `status=${status}&`;

    const res = await apiGet(endpoint);
    const tbody = document.getElementById('appointments-tbody');

    if (!res || !res.success || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No se encontraron turnos</td></tr>';
        return;
    }

    tbody.innerHTML = res.data.map(a => `
    <tr>
      <td>#${a.id}</td>
      <td>${escapeHtml(a.client_name)}</td>
      <td>${escapeHtml(a.client_phone)}</td>
      <td><span class="badge badge-channel">${getChannelEmoji(a.client_channel)} ${a.client_channel || 'whatsapp'}</span></td>
      <td>${escapeHtml(a.service)}</td>
      <td>${formatDate(a.date)}</td>
      <td><strong>${a.time}</strong></td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
      <td>
        ${a.status === 'confirmed' ? `
          <button class="btn btn-danger btn-sm" onclick="cancelAppointment(${a.id})">Cancelar</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

// Filtros
document.getElementById('btn-filter-apply')?.addEventListener('click', loadAppointments);

// Cancelar turno
async function cancelAppointment(id) {
    if (!confirm(`¿Estás seguro de cancelar el turno #${id}?`)) return;
    const res = await apiDelete(`/appointments/${id}`);
    if (res && res.success) {
        showToast(res.message, 'success');
        loadAppointments();
        loadDashboard();
    }
}
// Exponer globalmente para los onclick inline
window.cancelAppointment = cancelAppointment;

// ═══════════════════════════════════════════════════════
//  New Appointment Form
// ═══════════════════════════════════════════════════════

async function loadServices() {
    const res = await apiGet('/services');
    if (res && res.success) {
        services = res.data;
        const select = document.getElementById('input-service');
        select.innerHTML = '<option value="">Seleccionar servicio...</option>';
        services.forEach(s => {
            const option = document.createElement('option');
            option.value = s.name;
            option.textContent = `${s.name} — $${s.price.toLocaleString('es-AR')} (${s.duration_min} min)`;
            select.appendChild(option);
        });
    }
}

function initForm() {
    // Cuando cambia la fecha, cargar slots disponibles
    document.getElementById('input-date').addEventListener('change', async (e) => {
        const date = e.target.value;
        if (!date) return;
        await loadAvailableSlots(date);
    });

    // Submit del formulario
    document.getElementById('appointment-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            client_name: document.getElementById('input-name').value.trim(),
            client_phone: document.getElementById('input-phone').value.trim(),
            client_channel: document.getElementById('input-channel').value,
            service: document.getElementById('input-service').value,
            date: document.getElementById('input-date').value,
            time: document.getElementById('input-time').value,
        };

        if (!data.client_name || !data.client_phone || !data.service || !data.date || !data.time) {
            showToast('Completá todos los campos', 'error');
            return;
        }

        const btn = document.getElementById('btn-submit-appointment');
        btn.disabled = true;
        btn.textContent = '⏳ Creando...';

        const res = await apiPost('/appointments', data);

        btn.disabled = false;
        btn.textContent = '✅ Confirmar Turno';

        if (res && res.success) {
            showToast(res.message, 'success');
            document.getElementById('appointment-form').reset();
            initDateDefaults();
            document.getElementById('slots-preview').innerHTML = '<p class="empty-state">Seleccioná una fecha para ver disponibilidad</p>';
        }
    });

    // Botones de disponibilidad
    document.getElementById('btn-check-avail')?.addEventListener('click', () => {
        const date = document.getElementById('avail-date').value;
        if (date) loadAvailabilityGrid(date);
    });
}

async function loadAvailableSlots(date) {
    const res = await apiGet(`/availability?date=${date}`);
    const timeSelect = document.getElementById('input-time');
    const preview = document.getElementById('slots-preview');

    if (!res || !res.success) {
        timeSelect.innerHTML = '<option value="">Error al cargar horarios</option>';
        return;
    }

    if (res.available_slots.length === 0) {
        timeSelect.innerHTML = '<option value="">No hay horarios disponibles</option>';
        preview.innerHTML = `<p class="empty-state">${res.message || 'Sin horarios disponibles para esta fecha'}</p>`;
        return;
    }

    // Llenar select de horarios
    timeSelect.innerHTML = '<option value="">Seleccionar hora...</option>';
    res.available_slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = slot;
        timeSelect.appendChild(option);
    });

    // Preview visual de slots
    const allSlots = [...res.available_slots.map(s => ({ time: s, available: true }))];
    res.occupied_slots.forEach(o => {
        allSlots.push({ time: o.time, available: false, info: `${o.client_name} - ${o.service}` });
    });
    allSlots.sort((a, b) => a.time.localeCompare(b.time));

    preview.innerHTML = `
    <p style="margin-bottom: 12px; font-size: 0.82rem; color: var(--text-muted);">
      ${res.available_count} disponibles / ${res.total_slots} totales
    </p>
    <div class="availability-grid">
      ${allSlots.map(s => `
        <div class="slot-item ${s.available ? 'slot-available' : 'slot-occupied'}"
             title="${s.info || 'Disponible'}">
          ${s.time}
        </div>
      `).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
//  Availability View
// ═══════════════════════════════════════════════════════

async function loadAvailabilityGrid(date) {
    const res = await apiGet(`/availability?date=${date}`);
    const grid = document.getElementById('availability-grid');

    if (!res || !res.success) {
        grid.innerHTML = '<p class="empty-state">Error al cargar disponibilidad</p>';
        return;
    }

    if (res.available_slots.length === 0 && res.occupied_slots.length === 0) {
        grid.innerHTML = `<p class="empty-state">${res.message || 'No hay horarios para esta fecha'}</p>`;
        return;
    }

    const allSlots = [
        ...res.available_slots.map(s => ({ time: s, available: true })),
        ...res.occupied_slots.map(o => ({ time: o.time, available: false, info: `${o.client_name} — ${o.service}` }))
    ];
    allSlots.sort((a, b) => a.time.localeCompare(b.time));

    grid.innerHTML = allSlots.map(s => `
    <div class="slot-item ${s.available ? 'slot-available' : 'slot-occupied'}"
         title="${s.info || 'Disponible'}">
      ${s.time}
      ${!s.available ? `<div style="font-size: 0.65rem; margin-top: 4px;">${s.info}</div>` : ''}
    </div>
  `).join('');
}

async function loadServicesGrid() {
    const res = await apiGet('/services');
    const container = document.getElementById('services-list');

    if (!res || !res.success || res.data.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay servicios disponibles</p>';
        return;
    }

    container.innerHTML = res.data.map(s => `
    <div class="service-card">
      <div class="service-name">✂️ ${escapeHtml(s.name)}</div>
      <div class="service-meta">
        <span>⏱ ${s.duration_min} min</span>
        <span class="service-price">$${s.price.toLocaleString('es-AR')}</span>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════
//  Utilidades
// ═══════════════════════════════════════════════════════

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getChannelEmoji(channel) {
    const emojis = {
        'whatsapp': '📱',
        'instagram': '📷',
        'facebook': '📘',
        'presencial': '🏪'
    };
    return emojis[channel] || '💬';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
