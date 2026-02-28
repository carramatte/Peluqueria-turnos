// ═══════════════════════════════════════════════════════
//  Barbería — Panel de Configuración y Gestión SaaS
//  Frontend Logic
// ═══════════════════════════════════════════════════════

const API_URL = '/api'; // Ajustar según entorno, si corre localmente usar 'http://localhost:3000/api'
let services = [];
let pendingNotifications = [];
let lastNotificationId = null;

// ── Inicialización ──
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initDateDefaults();
    loadServices();
    loadDashboard();
    initForm();
    initNotifications();
    updateHeaderDate();

    // Globals Events
    document.getElementById('btn-refresh-dashboard')?.addEventListener('click', loadDashboard);
    document.getElementById('btn-global-new')?.addEventListener('click', () => switchView('new-appointment'));
});

// ═══════════════════════════════════════════════════════
//  Navegación e Interfaz
// ═══════════════════════════════════════════════════════
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewName = e.currentTarget.dataset.view;
            if (viewName) switchView(viewName);

            // Cerrar sidebar en mobile al clickear un link
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Toggle tables (list / calendar)
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const parent = e.currentTarget.parentElement;
            parent.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            // La lógica específica del toggle dependerá de la vista
        });
    });
}

function switchView(viewName) {
    // 1. Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // 2. Mostrar la vista seleccionada
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // 3. Actualizar estado de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });

    // 4. Cambiar título del header
    const pageTitle = document.getElementById('page-title');
    const titles = {
        'dashboard': 'Dashboard Principal',
        'appointments': 'Gestión de Turnos',
        'new-appointment': 'Crear Nuevo Turno',
        'availability': 'Mapa de Disponibilidad',
        'clients': 'Base de Clientes',
        'inquiries': 'Bandeja de Consultas',
        'settings': 'Configuración del Negocio'
    };
    if (pageTitle && titles[viewName]) {
        pageTitle.textContent = titles[viewName];
    }

    // 5. Cargar datos específicos de la vista
    switch (viewName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'appointments':
            loadAppointments();
            break;
        case 'availability':
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('avail-date').value = today;
            loadAvailabilityGrid(today);
            loadServicesGrid();
            break;
        case 'clients':
            loadClients();
            break;
        case 'inquiries':
            loadInquiriesMock();
            break;
        case 'settings':
            // Logica futura para settings
            break;
    }
}

function initDateDefaults() {
    const today = new Date().toISOString().split('T')[0];

    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = today;

    const inputDate = document.getElementById('input-date');
    if (inputDate) {
        inputDate.min = today;
        inputDate.addEventListener('change', (e) => {
            loadAvailableSlots(e.target.value);
        });
    }

    const availDate = document.getElementById('avail-date');
    if (availDate) availDate.value = today;

    document.getElementById('btn-check-avail')?.addEventListener('click', () => {
        const date = document.getElementById('avail-date').value;
        if (date) {
            loadAvailabilityGrid(date);
        }
    });
}

function updateHeaderDate() {
    const el = document.getElementById('header-date');
    if (!el) return;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-ES', options);
    // Capitalize first letter
    el.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

// ═══════════════════════════════════════════════════════
//  API Helpers
// ═══════════════════════════════════════════════════════
async function apiGet(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error en la petición');
        return data.data || data;
    } catch (error) {
        console.error(`Error GET ${endpoint}:`, error);
        showToast(error.message, 'error');
        return null;
    }
}

async function apiPost(endpoint, body) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al guardar');
        return data; // Retorna mensaje y data
    } catch (error) {
        console.error(`Error POST ${endpoint}:`, error);
        showToast(error.message, 'error');
        return null;
    }
}

async function apiDelete(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al eliminar');
        return data;
    } catch (error) {
        console.error(`Error DELETE ${endpoint}:`, error);
        showToast(error.message, 'error');
        return null;
    }
}

// ═══════════════════════════════════════════════════════
//  Dashboard
// ═══════════════════════════════════════════════════════
async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const data = await apiGet(`/appointments?date=${today}`);

    if (!data) return;

    const appointments = data;
    const confirmed = appointments.filter(a => a.status === 'confirmed');

    // Stats
    document.getElementById('stat-today-count').textContent = appointments.length;
    document.getElementById('stat-confirmed-count').textContent = confirmed.length;

    // Channels Mock Stats
    document.getElementById('dash-wa-count').textContent = '2';
    document.getElementById('stat-pending-inquiries-count').textContent = '2';

    const availData = await apiGet(`/availability?date=${today}`);
    if (availData && availData.available_count !== undefined) {
        document.getElementById('stat-available-count').textContent = availData.available_count;
    } else {
        document.getElementById('stat-available-count').textContent = '-';
    }

    // Upcoming List
    const listEl = document.getElementById('upcoming-list');
    if (confirmed.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <svg><use href="#icon-empty-state"></use></svg>
                No hay turnos confirmados para hoy.
            </div>`;
        return;
    }

    // Filtrar los que ya pasaron
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMin = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMin}`;

    const upcoming = confirmed.filter(a => a.time >= currentTime).slice(0, 5); // Max 5

    if (upcoming.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <svg><use href="#icon-check-circle"></use></svg>
                No quedan más turnos para hoy.
            </div>`;
        return;
    }

    let html = '';
    upcoming.forEach(a => {
        // Chequear si el turno es inminente (próximos 15 min)
        let isSoon = false;
        const [aHour, aMin] = a.time.split(':').map(Number);
        const [nHour, nMin] = currentTime.split(':').map(Number);

        const aTotalMins = aHour * 60 + aMin;
        const nTotalMins = nHour * 60 + nMin;
        const diff = aTotalMins - nTotalMins;

        if (diff >= 0 && diff <= 15) {
            isSoon = true;
        }

        html += `
            <div class="upcoming-item ${isSoon ? 'is-soon' : ''}">
                <div class="upcoming-time">${a.time}</div>
                <div class="upcoming-info">
                    <div class="upcoming-name">${escapeHtml(a.client_name)}</div>
                    <div class="upcoming-service">${escapeHtml(a.service)}</div>
                </div>
                <div class="upcoming-badges">
                    ${isSoon ? '<span class="badge badge-soon">Próximo</span>' : ''}
                    <span class="badge badge-channel">
                        <svg style="width:10px; height:10px; margin-right:3px; vertical-align:text-top;"><use href="#icon-${a.client_channel || 'whatsapp'}"></use></svg>
                        ${a.client_channel || 'whatsapp'}
                    </span>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  Appointments (Turnos)
// ═══════════════════════════════════════════════════════
async function loadAppointments() {
    const tbody = document.getElementById('appointments-tbody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>';

    const date = document.getElementById('filter-date')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';

    let query = '?';
    if (date) query += `date=${date}&`;
    if (status) query += `status=${status}`;

    const data = await apiGet(`/appointments${query}`);

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <svg><use href="#icon-empty-state"></use></svg>
                        No se encontraron turnos para esta fecha.
                    </div>
                </td>
            </tr>`;
        return;
    }

    let html = '';

    // Configuración actual de la hora para highlight
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    data.forEach(a => {
        let isSoonClass = '';
        if (a.status === 'confirmed' && a.date === today && a.time >= currentTime) {
            const [aH, aM] = a.time.split(':').map(Number);
            const [nH, nM] = currentTime.split(':').map(Number);
            if ((aH * 60 + aM) - (nH * 60 + nM) <= 15) {
                isSoonClass = 'row-soon';
            }
        }

        html += `
            <tr class="${isSoonClass}">
                <td style="font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums;">
                    ${a.time}
                </td>
                <td style="font-weight: 500; color: var(--text-primary);">
                    ${escapeHtml(a.client_name)}
                </td>
                <td>${escapeHtml(a.service)}</td>
                <td style="font-feature-settings: 'tnum';">${escapeHtml(a.client_phone)}</td>
                <td>
                    <span class="badge badge-${a.client_channel || 'whatsapp'}">
                        <svg style="width:12px; height:12px; margin-right:4px; vertical-align:text-top;"><use href="#icon-${a.client_channel || 'whatsapp'}"></use></svg>
                        ${a.client_channel || 'whatsapp'}
                    </span>
                </td>
                <td><span class="badge badge-${a.status}">${translateStatus(a.status)}</span></td>
                <td>
                    <div class="cell-actions" style="justify-content: flex-end;">
                        ${a.status === 'confirmed' ? `
                            <button class="btn btn-icon btn-outline" onclick="window.confirmComplete(${a.id})" title="Marcar completado">
                                <svg><use href="#icon-check-circle"></use></svg>
                            </button>
                            <button class="btn btn-icon btn-outline" style="color: var(--danger); border-color: rgba(248,113,113,0.3);" onclick="window.cancelAppointment(${a.id})" title="Cancelar">
                                <svg><use href="#icon-x-circle"></use></svg>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Filtros
document.getElementById('btn-filter-apply')?.addEventListener('click', loadAppointments);

// Cancelar/Completar turno
async function cancelAppointment(id) {
    if (!confirm('¿Estás seguro de cancelar este turno?')) return;
    const res = await apiDelete(`/appointments/${id}`);
    if (res && res.success) {
        showToast(res.message, 'success');
        loadAppointments();
        loadDashboard();
    }
}

async function confirmComplete(id) {
    if (!confirm('¿Marcar este turno como completado?')) return;

    // Dado que el backend actual permite PUT /appointments/:id
    // vamos a obtenerlo y pisar el estado.
    const turno = await apiGet(`/appointments/${id}`);
    if (!turno) return;

    turno.status = 'completed';

    const res = await apiPost(`/appointments/${id}`, turno); // Asumiendo que POST puede actuar en vez de PUT, o necesitas corregir el fetch a PUT.
    // Usaremos un fetch nativo con PUT para asegurarnos:

    try {
        const fetchRes = await fetch(`${API_URL}/appointments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        const data = await fetchRes.json();
        if (data.success) {
            showToast('Turno marcado como completado', 'success');
            loadAppointments();
        }
    } catch (e) {
        showToast('Error al completar turno', 'error');
    }
}

window.cancelAppointment = cancelAppointment;
window.confirmComplete = confirmComplete;

function translateStatus(status) {
    const map = {
        'confirmed': 'Confirmado',
        'cancelled': 'Cancelado',
        'completed': 'Completado',
        'pending': 'Pendiente'
    };
    return map[status] || status;
}

// ═══════════════════════════════════════════════════════
//  New Appointment Form
// ═══════════════════════════════════════════════════════
async function loadServices() {
    const data = await apiGet('/services');
    if (data) {
        services = data;
        const select = document.getElementById('input-service');
        if (!select) return;

        let html = '<option value="">Selecciona un servicio...</option>';
        data.forEach(s => {
            html += `<option value="${s.name}">${s.name} (${s.duration_min} min — $${s.price})</option>`;
        });
        select.innerHTML = html;
    }
}

function initForm() {
    const form = document.getElementById('appointment-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSubmit = document.getElementById('btn-submit-appointment');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="loading-spinner" style="padding:0; height:20px; width:20px;"></span> Guardando...';

        const payload = {
            client_name: document.getElementById('input-name').value,
            client_phone: document.getElementById('input-phone').value,
            client_channel: document.getElementById('input-channel').value,
            service: document.getElementById('input-service').value,
            date: document.getElementById('input-date').value,
            time: document.getElementById('input-time').value,
        };

        const res = await apiPost('/appointments', payload);

        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Confirmar Reserva';

        if (res && res.success) {
            showToast(res.message, 'success');
            form.reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('input-date').value = today;
            document.getElementById('input-time').innerHTML = '<option value="">Elige una fecha primero</option>';
            document.getElementById('slots-preview').innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 10px;">
                    <svg><use href="#icon-calendar"></use></svg>
                    Turno guardado correctamente. Selecciona otra fecha para seguir cargando.
                </div>`;

            // recargar stats de fondo
            loadDashboard();
        }
    });
}

async function loadAvailableSlots(date) {
    const timeSelect = document.getElementById('input-time');
    const previewGrid = document.getElementById('slots-preview');

    timeSelect.innerHTML = '<option value="">Cargando horarios...</option>';
    timeSelect.disabled = true;
    previewGrid.innerHTML = '<div class="loading-spinner" style="grid-column: 1 / -1;"></div>';

    const data = await apiGet(`/availability?date=${date}`);
    if (!data) return;

    // Poblar Selector y Grid a la vez
    let selectHtml = '<option value="">Selecciona la hora...</option>';
    let gridHtml = '';

    if (data.available_slots?.length === 0) {
        selectHtml = '<option value="">No hay horarios disponibles</option>';
        gridHtml = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 30px;">
                <svg><use href="#icon-x-circle"></use></svg>
                <div style="margin-top:10px;">${data.message || 'Agenda completa para este día'}</div>
            </div>`;
    } else {
        // Para poder interaccionar con el form renderemos la matriz
        const allSlotsMap = new Map();

        data.available_slots.forEach(t => allSlotsMap.set(t, 'available'));
        if (data.occupied_slots) {
            data.occupied_slots.forEach(o => allSlotsMap.set(o.time, 'occupied'));
        }

        const sortedSlots = Array.from(allSlotsMap.keys()).sort();

        sortedSlots.forEach(time => {
            const status = allSlotsMap.get(time);
            if (status === 'available') {
                selectHtml += `<option value="${time}">${time}</option>`;
                gridHtml += `<div class="slot-item slot-available" onclick="setFormTime('${time}')" style="cursor:pointer;" title="Seleccionar las ${time}">${time}</div>`;
            } else {
                gridHtml += `<div class="slot-item slot-occupied" title="Ocupado">${time}</div>`;
            }
        });

        timeSelect.disabled = false;
    }

    timeSelect.innerHTML = selectHtml;
    previewGrid.innerHTML = gridHtml;
}

window.setFormTime = function (timeStr) {
    const select = document.getElementById('input-time');
    if (!select) return;
    const options = Array.from(select.options);
    const target = options.find(o => o.value === timeStr);

    if (target) {
        select.value = timeStr;
        // Visual feedback
        const btnSubmit = document.getElementById('btn-submit-appointment');
        btnSubmit.classList.add('btn-glow');
        setTimeout(() => btnSubmit.classList.remove('btn-glow'), 1000);
    }
};

// ═══════════════════════════════════════════════════════
//  Availability View
// ═══════════════════════════════════════════════════════
async function loadAvailabilityGrid(date) {
    const gridEl = document.getElementById('availability-grid');
    gridEl.innerHTML = '<div class="loading-spinner" style="grid-column: 1 / -1; padding: 60px;"></div>';

    const data = await apiGet(`/availability?date=${date}`);
    if (!data) return;

    if (data.available_slots?.length === 0 && data.occupied_slots?.length === 0) {
        gridEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg><use href="#icon-x-circle"></use></svg>
                ${data.message || 'No hay horarios configurados para este día.'}
            </div>`;
        return;
    }

    // Merge slots into a sorted array
    const allSlots = [];

    data.available_slots.forEach(time => {
        allSlots.push({ time, status: 'available' });
    });

    data.occupied_slots.forEach(occ => {
        allSlots.push({
            time: occ.time,
            status: 'occupied',
            service: occ.service,
            client: occ.client_name
        });
    });

    // Ordenar por hora (09:00, 09:30, ...)
    allSlots.sort((a, b) => a.time.localeCompare(b.time));

    // Revisar proximidad
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMin = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMin}`;
    const today = now.toISOString().split('T')[0];

    let html = '';
    allSlots.forEach(slot => {
        let isSoon = false;
        if (slot.status === 'occupied' && date === today && slot.time >= currentTime) {
            const [aH, aM] = slot.time.split(':').map(Number);
            const [nH, nM] = currentTime.split(':').map(Number);
            if ((aH * 60 + aM) - (nH * 60 + nM) <= 15) {
                isSoon = true;
            }
        }

        const cssClass = slot.status === 'available' ? 'slot-available' : (isSoon ? 'slot-soon' : 'slot-occupied');
        const tooltip = slot.status === 'available'
            ? 'Libre'
            : `Ocupado: ${escapeHtml(slot.client || '')} - ${escapeHtml(slot.service || '')}`;

        html += `
            <div class="slot-item ${cssClass}" title="${tooltip}">
                ${slot.time}
            </div>
        `;
    });

    gridEl.innerHTML = html;
}

function loadServicesGrid() {
    const listEl = document.getElementById('services-list');
    if (services.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No hay servicios configurados.</div>';
        return;
    }

    let html = '';
    services.forEach(s => {
        html += `
            <div class="service-card">
                <div class="service-name">${escapeHtml(s.name)}</div>
                <div class="service-meta">
                    <span>${s.duration_min} min</span>
                    <span class="service-price">$${s.price?.toLocaleString('es-AR') || '0'}</span>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  Clients (Data Layer & UI Reactivity)
// ═══════════════════════════════════════════════════════
async function loadClients() {
    const tbody = document.getElementById('clients-tbody');
    const loadingOverlay = document.getElementById('clients-loading');

    // 1. Mostrar estado de carga (UI State)
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (tbody.innerHTML.trim() === '') {
        // Fallback skeleton if empty
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;"><div class="loading-spinner"></div></td></tr>';
    }

    // 2. Fetch Data (Data Layer)
    const data = await apiGet('/appointments');

    // 3. Ocultar estado de carga
    if (loadingOverlay) loadingOverlay.style.display = 'none';

    if (!data) return;

    // 4. Transformar Datos (Controller Layer)
    const clientMap = new Map();
    data.forEach(a => {
        if (!a.client_phone) return;
        if (!clientMap.has(a.client_phone)) {
            clientMap.set(a.client_phone, {
                name: a.client_name,
                phone: a.client_phone,
                count: 1,
                lastDate: a.date,
                channel: a.client_channel || 'whatsapp'
            });
        } else {
            const c = clientMap.get(a.client_phone);
            c.count++;
            if (a.date > c.lastDate) c.lastDate = a.date;
        }
    });

    const clientsArray = Array.from(clientMap.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));

    // Stats
    document.getElementById('stat-clients-total').textContent = clientsArray.length;

    // 5. Renderizar Vista (View Layer)
    if (clientsArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No hay datos de clientes aún.</div></td></tr>`;
        return;
    }

    let html = '';
    clientsArray.forEach(c => {
        html += `
            <tr>
                <td>
                    <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${escapeHtml(c.name)}</div>
                    <span class="badge badge-${c.channel}" style="font-size: 0.65rem;">${c.channel}</span>
                </td>
                <td>${escapeHtml(c.phone)}</td>
                <td>
                    <span class="badge" style="background:rgba(255,255,255,0.1); color:var(--text-primary);">
                        ${c.count} turnos
                    </span>
                </td>
                <td>${formatDate(c.lastDate)}</td>
                <td>
                    <div class="cell-actions" style="justify-content: flex-end;">
                        <button class="btn btn-sm btn-outline" style="border:none;" onclick="showToast('Historial próximamente disponible')">
                            Ver Detalle
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  Inquiries (Data Layer Wrapper & Grid View)
// ═══════════════════════════════════════════════════════
function loadInquiriesMock() {
    const listEl = document.getElementById('inquiries-list');

    // Set some badges
    const totalNew = 2; // Mock
    const nnavb = document.getElementById('nav-badge-inquiries');
    if (nnavb) {
        nnavb.textContent = totalNew;
        nnavb.style.display = totalNew > 0 ? 'inline-block' : 'none';
    }
    document.getElementById('inq-wa-count').textContent = '2';

    // Inquiries HTML - Usando el nuevo componente InquiryCard (.inquiry-card)
    const html = `
        <div class="inquiry-card">
            <div class="inquiry-header">
                <div class="inquiry-sender">
                    <div class="inquiry-avatar"><svg><use href="#icon-whatsapp"></use></svg></div>
                    <div>
                        <div class="inquiry-name">+54 9 11 4455-8899</div>
                        <div class="inquiry-channel">WhatsApp</div>
                    </div>
                </div>
                <span class="badge badge-soon">Nuevo</span>
            </div>
            <div class="inquiry-message">Hola, quería saber si tienen turnos para hoy a la tarde para un corte de barba.</div>
            <div class="inquiry-actions">
                <span class="inquiry-time">Hace 10 min</span>
                <button class="btn btn-sm btn-outline" onclick="showToast('Respuesta rápida')">Responder</button>
            </div>
        </div>

        <div class="inquiry-card">
            <div class="inquiry-header">
                <div class="inquiry-sender">
                    <div class="inquiry-avatar"><svg><use href="#icon-whatsapp"></use></svg></div>
                    <div>
                        <div class="inquiry-name">Martín Domínguez</div>
                        <div class="inquiry-channel">WhatsApp</div>
                    </div>
                </div>
                <span class="badge badge-soon">Nuevo</span>
            </div>
            <div class="inquiry-message">Cancelame el turno de las 18hs por favor, se me complicó con el trabajo. Mañana vuelvo a pedir.</div>
            <div class="inquiry-actions">
                <span class="inquiry-time">Hace 45 min</span>
                <button class="btn btn-sm btn-outline" onclick="showToast('Respuesta rápida')">Responder</button>
            </div>
        </div>

        <div class="inquiry-card" style="opacity: 0.6;">
            <div class="inquiry-header">
                <div class="inquiry-sender">
                    <div class="inquiry-avatar"><svg><use href="#icon-instagram"></use></svg></div>
                    <div>
                        <div class="inquiry-name">@juancito_99</div>
                        <div class="inquiry-channel">Instagram</div>
                    </div>
                </div>
                <span class="badge badge-completed">Respondida</span>
            </div>
            <div class="inquiry-message">Cuánto me cobrás para hacerme unas mechas blancas? (Respondido: ¡Hola Juan! Te pasamos los precios...)</div>
            <div class="inquiry-actions">
                <span class="inquiry-time">Ayer 19:30</span>
                <button class="btn btn-sm btn-outline" disabled>Archivada</button>
            </div>
        </div>
    `;

    listEl.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  Notificaciones (Bell + Polling)
// ═══════════════════════════════════════════════════════
function initNotifications() {
    const btn = document.getElementById('notification-toggle');
    const dropdown = document.getElementById('notification-dropdown');

    if (btn && dropdown) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            // Al abrir, marcamos como vistas actualizando badge
            document.getElementById('notification-badge').setAttribute('data-count', '0');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== btn) {
                dropdown.classList.remove('open');
            }
        });

        document.getElementById('btn-clear-notifications')?.addEventListener('click', () => {
            document.getElementById('notification-list').innerHTML = '<div class="notification-empty">No hay notificaciones recientes</div>';
            pendingNotifications = [];
        });
    }

    // Arrancar polling cada minuto
    setInterval(pollNotifications, 60000);
    // Ejecutar una vez al inicio deferido
    setTimeout(pollNotifications, 3000);
}

async function pollNotifications() {
    // Endpoint para obtener turnos próximos
    const data = await apiGet('/appointments/pending-reminders');
    if (!data) return;

    if (data.length > 0) {
        let addedNew = false;

        data.forEach(a => {
            // Evitar duplicados simples
            const notifId = `rem_${a.id}_${a.time}`;
            if (!pendingNotifications.includes(notifId)) {
                pendingNotifications.push(notifId);
                addNotificationToList(a);

                // Mostrar Toast visible solo la primera vez que entra en la ventana de 15 min
                showToast(`Turno próximo: ${a.client_name} a las ${a.time}`, 'warning');
                addedNew = true;
            }
        });

        if (addedNew) {
            const badge = document.getElementById('notification-badge');
            const current = parseInt(badge.getAttribute('data-count') || '0');
            badge.setAttribute('data-count', current + data.length);
            badge.textContent = current + data.length;

            // Icon animation
            document.getElementById('notification-toggle').style.color = 'var(--warning)';
            document.getElementById('notification-toggle').style.borderColor = 'var(--warning)';
        }
    }
}

function addNotificationToList(appointment) {
    const list = document.getElementById('notification-list');

    // Quitar el empty state si existe
    const empty = list.querySelector('.notification-empty');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = 'notification-item';
    div.innerHTML = `
        <div class="notification-item-icon warning"><svg><use href="#icon-clock"></use></svg></div>
        <div class="notification-item-body">
            <div class="notification-item-text">
                <strong style="color:var(--text-primary);">${appointment.client_name}</strong> tiene un turno para <strong>${appointment.service}</strong> en breve (${appointment.time}).
            </div>
            <div class="notification-item-time">Faltan menos de 15 minutos</div>
        </div>
    `;

    // Insertar arriba
    list.prepend(div);
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
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle'; // Not defined but generic fallback
    if (type === 'warning') icon = 'clock';

    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;"><use href="#icon-${icon}"></use></svg>
            ${escapeHtml(message)}
        </div>
    `;
    container.appendChild(toast);

    // Auto eliminar
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 250); // duración animación
    }, 4000);
}
