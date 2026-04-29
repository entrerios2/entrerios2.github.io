/**
 * AV Tech SPA - Logic Core
 * Vanilla JS + Graph Traversal + PWA Sync
 */

let API_URL = "";

// State
let db = { equipos: [], cables: [], conexiones: [] };
let currentMode = 'ARMADO'; // 'ARMADO' or 'DESARME'
let html5QrCode = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const qrStartBtn = document.getElementById('qrStartBtn');
const resultsContainer = document.getElementById('resultsContainer');
const modeArmadoBtn = document.getElementById('modeArmado');
const modeDesarmeBtn = document.getElementById('modeDesarme');
const modeAdminBtn = document.getElementById('modeAdmin');
const adminPanel = document.getElementById('adminPanel');
const searchSection = document.querySelector('.search-container');
const offlineStatus = document.querySelector('.offline-status');

/**
 * 1. Inicialización y Datos
 */
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const gasIdParam = urlParams.get('gas_id');

    if (gasIdParam) {
        API_URL = `https://script.google.com/macros/s/${gasIdParam}/exec`;
        localStorage.setItem('gas_api_url', API_URL);
        // Limpiar URL para que no quede expuesto el ID a simple vista
        window.history.replaceState({}, document.title, window.location.pathname);
        startApp();
    } else {
        const storedUrl = localStorage.getItem('gas_api_url');
        if (storedUrl) {
            API_URL = storedUrl;
            startApp();
        } else {
            // Mostrar modal de configuración
            document.getElementById('setupModal').style.display = 'flex';
        }
    }
}

document.getElementById('saveGasIdBtn')?.addEventListener('click', () => {
    const val = document.getElementById('gasIdInput').value.trim();
    if (!val) return;
    if (val.startsWith("http")) {
        API_URL = val;
    } else {
        API_URL = `https://script.google.com/macros/s/${val}/exec`;
    }
    localStorage.setItem('gas_api_url', API_URL);
    document.getElementById('setupModal').style.display = 'none';
    startApp();
});

async function startApp() {
    loadLocalData();
    updateOfflineStatus();
    await fetchData();
    renderResults();
}

function loadLocalData() {
    const saved = localStorage.getItem('av_tech_db');
    if (saved) {
        db = JSON.parse(saved);
    }
}

async function fetchData() {
    if (!navigator.onLine) return;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        db = data;
        localStorage.setItem('av_tech_db', JSON.stringify(db));
        console.log('DB Updated from server');
    } catch (error) {
        console.warn('Could not fetch fresh data, using local cache', error);
    }
}

/**
 * 2. Algoritmo de Grafo
 */
function findFullRoute(targetId) {
    // 1. Build Adjacency Maps
    const forwardMap = {};
    const backwardMap = {};
    const connectionInfo = {};

    db.conexiones.forEach(conn => {
        const src = conn.ID_Origen;
        const dst = conn.ID_Destino;
        
        if (!forwardMap[src]) forwardMap[src] = [];
        forwardMap[src].push(dst);

        if (!backwardMap[dst]) backwardMap[dst] = [];
        backwardMap[dst].push(src);

        connectionInfo[`${src}->${dst}`] = conn;
    });

    // 2. Trace Backward to Source
    let path = [targetId];
    let current = targetId;
    while (backwardMap[current] && backwardMap[current].length > 0) {
        // For simplicity, take the first source if multiple (usually linear)
        current = backwardMap[current][0];
        path.unshift(current);
    }

    // 3. Trace Forward to Destination
    current = targetId;
    while (forwardMap[current] && forwardMap[current].length > 0) {
        current = forwardMap[current][0];
        path.push(current);
    }

    return path;
}

/**
 * 3. Renderizado de Interfaz
 */
function renderResults() {
    const query = searchInput.value.trim().toUpperCase();
    resultsContainer.innerHTML = '';

    if (!query) return;

    // Filter connections where query matches ID_Origen or ID_Destino
    // OR search in cables/equipos
    const route = findFullRoute(query);
    
    const hasConnections = db.conexiones.some(c => c.ID_Origen === query || c.ID_Destino === query);
    const itemInfo = [...db.equipos, ...db.cables].find(i => (i.ID_Equipo || i.ID_Cable) === query);

    if (!hasConnections && !itemInfo) {
        resultsContainer.innerHTML = `<div class="card" style="text-align:center">No se encontró el ID "${query}"</div>`;
        return;
    }

    // Encontrar la conexión principal para obtener el ID_Patch
    const mainConn = db.conexiones.find(c => c.ID_Origen === query || c.ID_Destino === query);

    const card = document.createElement('div');
    card.className = 'card';

    // Header logic
    let headerHTML = `<div class="card-header"><span class="card-id">${query}</span>`;
    
    if (currentMode === 'ARMADO') {
        const statusClass = mainConn?.Estado_Instalacion === 'Conectado' ? 'badge-done' : 'badge-pending';
        headerHTML += `<span class="badge ${statusClass}">${mainConn?.Estado_Instalacion || 'S/D'}</span>`;
    } else {
        const status = itemInfo?.Estado_Logistica || 'Pendiente';
        const statusClass = (status === 'Guardado' || status === 'Devuelto') ? 'badge-done' : 'badge-pending';
        headerHTML += `<span class="badge ${statusClass}">${status}</span>`;
    }
    headerHTML += `</div>`;

    let bodyHTML = '';
    if (currentMode === 'ARMADO') {
        bodyHTML = `
            <div class="route-path">
                ${route.map((id, index) => `
                    <div class="route-node ${id === query ? 'highlight' : ''}">
                        <span>${index + 1}.</span> <strong>${id}</strong>
                    </div>
                    ${index < route.length - 1 ? '<div class="route-arrow">⬇</div>' : ''}
                `).join('')}
            </div>
            <button class="action-btn btn-primary" onclick="handleUpdatePatch('${mainConn?.ID_Patch}')" ${!mainConn ? 'disabled' : ''}>
                Marcar como Conectado
            </button>
        `;
    } else {
        // MODO DESARME
        const owner = itemInfo?.Propietario || 'Desconocido';
        const storage = itemInfo?.Lugar_Guardado_Final || 'S/D';
        const isOwn = owner.toLowerCase().includes('propio') || owner.toLowerCase().includes('empresa');
        
        bodyHTML = `
            <div style="margin-bottom: 1rem">
                <p><small>Propietario:</small> <strong>${owner}</strong></p>
                <p><small>Guardar en:</small> <strong>${storage}</strong></p>
            </div>
            <button class="action-btn ${isOwn ? 'btn-success' : 'btn-warning'}" 
                    onclick="handleUpdateLogistica('${query}', '${isOwn ? 'Guardado' : 'Devuelto'}')">
                Marcar como ${isOwn ? 'Guardado' : 'Devuelto'}
            </button>
        `;
    }

    card.innerHTML = headerHTML + bodyHTML;
    resultsContainer.appendChild(card);
}

/**
 * 3.1 Funciones de Administración
 */
function showAdminTab(tabId, btn) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    if (btn) btn.classList.add('active');
    
    if (tabId === 'tabEquipo') {
        document.getElementById('formEquipo').style.display = 'flex';
    } else if (tabId === 'tabCable') {
        document.getElementById('formCable').style.display = 'flex';
    } else if (tabId === 'tabRuteo') {
        document.getElementById('formRuteo').style.display = 'flex';
        updateSelects();
    }
}

function updateSelects() {
    const selOrigen = document.getElementById('selectOrigen');
    const selDestino = document.getElementById('selectDestino');
    
    const options = [...db.equipos, ...db.cables].map(item => {
        const id = item.ID_Equipo || item.ID_Cable;
        return `<option value="${id}">${id}</option>`;
    }).join('');

    const placeholder = '<option value="">-- Seleccionar --</option>';
    selOrigen.innerHTML = placeholder + options;
    selDestino.innerHTML = placeholder + options;
}

// Handlers de Formularios
document.getElementById('formEquipo')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    processAction({ action: 'ADD_EQUIPO', ...data, estado: 'Guardado' });
    e.target.reset();
    alert('Equipo encolado/guardado');
});

document.getElementById('formCable')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    processAction({ action: 'ADD_CABLE', ...data, estado: 'Guardado' });
    e.target.reset();
    alert('Cable encolado/guardado');
});

document.getElementById('formRuteo')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    processAction({ action: 'ADD_CONEXION', ...data, estado: 'Pendiente' });
    e.target.reset();
    alert('Conexión encolada/guardada');
});

/**
 * 4. Manejo de Acciones (Online/Offline)
 */
async function handleUpdatePatch(id) {
    const action = {
        action: 'UPDATE_PATCH',
        id: id,
        value: 'Conectado',
        timestamp: Date.now()
    };
    
    processAction(action);
}

async function handleUpdateLogistica(id, value) {
    const action = {
        action: 'UPDATE_LOGISTICA',
        id: id,
        value: value,
        timestamp: Date.now()
    };

    processAction(action);
}

async function processAction(action) {
    // UI Feedback immediate
    if (action.action === 'UPDATE_PATCH') {
        const conn = db.conexiones.find(c => c.ID_Patch === action.id);
        if (conn) conn.Estado_Instalacion = action.value;
    } else if (action.action === 'UPDATE_LOGISTICA') {
        const item = [...db.equipos, ...db.cables].find(i => (i.ID_Equipo || i.ID_Cable) === action.id);
        if (item) item.Estado_Logistica = action.value;
    } else if (action.action === 'ADD_EQUIPO') {
        db.equipos.push({
            ID_Equipo: action.id, Nombre: action.nombre, Categoria: action.categoria,
            Ubicacion_Uso: action.ubicacion, Propietario: action.propietario,
            Lugar_Guardado_Final: action.lugar, Estado_Logistica: action.estado, Notas: action.notas
        });
    } else if (action.action === 'ADD_CABLE') {
        db.cables.push({
            ID_Cable: action.id, Tipo_Conector: action.tipo, Longitud_m: action.longitud,
            Propietario: action.propietario, Lugar_Guardado_Final: action.lugar,
            Estado_Logistica: action.estado, Notas: action.notas
        });
    } else if (action.action === 'ADD_CONEXION') {
        db.conexiones.push({
            ID_Patch: action.id_patch, ID_Origen: action.id_origen, Puerto_Origen: action.puerto_origen,
            ID_Destino: action.id_destino, Puerto_Destino: action.puerto_destino,
            Tipo_Senial: action.tipo_senial, Estado_Instalacion: action.estado
        });
    }
    
    // Guardar estado local para reactividad inmediata post-reinicio
    localStorage.setItem('av_tech_db', JSON.stringify(db));
    renderResults();

    if (navigator.onLine) {
        try {
            await sendToServer(action);
        } catch (e) {
            queueAction(action);
        }
    } else {
        queueAction(action);
    }
}

async function sendToServer(action) {
    // Para Google Apps Script, usamos 'no-cors' y enviamos como texto plano 
    // para evitar preflight OPTIONS, pero GAS recibirá el JSON en postData.contents
    await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(action)
    });
    console.log('Action sent to server (no-cors mode)');
}

function queueAction(action) {
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    queue.push(action);
    localStorage.setItem('offline_queue', JSON.stringify(queue));
    alert('Sin conexión. La acción se sincronizará automáticamente al volver online.');
}

async function syncQueue() {
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} actions...`);
    for (const action of queue) {
        try {
            await sendToServer(action);
        } catch (e) {
            console.error('Failed to sync action', action);
        }
    }
    localStorage.setItem('offline_queue', '[]');
    alert('Sincronización completada con éxito.');
}

/**
 * 5. Event Listeners y Utilidades
 */
searchInput.addEventListener('input', renderResults);

qrStartBtn.addEventListener('click', () => {
    const readerDiv = document.getElementById('reader');
    if (readerDiv.style.display === 'block') {
        readerDiv.style.display = 'none';
        if (html5QrCode) html5QrCode.stop();
        return;
    }

    readerDiv.style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            searchInput.value = decodedText;
            readerDiv.style.display = 'none';
            html5QrCode.stop();
            renderResults();
        },
        (errorMessage) => { /* Ignore errors */ }
    ).catch(err => {
        alert('Error al abrir cámara: ' + err);
        readerDiv.style.display = 'none';
    });
});

modeArmadoBtn.addEventListener('click', () => {
    currentMode = 'ARMADO';
    modeArmadoBtn.classList.add('active');
    modeDesarmeBtn.classList.remove('active');
    modeAdminBtn.classList.remove('active');
    adminPanel.style.display = 'none';
    searchSection.style.display = 'flex';
    resultsContainer.style.display = 'block';
    renderResults();
});

modeDesarmeBtn.addEventListener('click', () => {
    currentMode = 'DESARME';
    modeDesarmeBtn.classList.add('active');
    modeArmadoBtn.classList.remove('active');
    modeAdminBtn.classList.remove('active');
    adminPanel.style.display = 'none';
    searchSection.style.display = 'flex';
    resultsContainer.style.display = 'block';
    renderResults();
});

modeAdminBtn.addEventListener('click', () => {
    currentMode = 'ADMIN';
    modeAdminBtn.classList.add('active');
    modeArmadoBtn.classList.remove('active');
    modeDesarmeBtn.classList.remove('active');
    
    adminPanel.style.display = 'block';
    searchSection.style.display = 'none';
    resultsContainer.style.display = 'none';
});

window.addEventListener('online', () => {
    updateOfflineStatus();
    syncQueue();
});

window.addEventListener('offline', updateOfflineStatus);

function updateOfflineStatus() {
    if (navigator.onLine) {
        document.body.classList.remove('is-offline');
    } else {
        document.body.classList.add('is-offline');
    }
}

// Start
init();
