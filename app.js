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
    
    // Check if the route actually exists in connections
    const hasConnections = db.conexiones.some(c => c.ID_Origen === query || c.ID_Destino === query);
    
    // If it's a known ID (equipment/cable) but has no connections, show it alone
    const itemInfo = [...db.equipos, ...db.cables].find(i => i.ID === query);

    if (!hasConnections && !itemInfo) {
        resultsContainer.innerHTML = `<div class="card" style="text-align:center">No se encontró el ID "${query}"</div>`;
        return;
    }

    const card = document.createElement('div');
    card.className = 'card';

    // Header logic
    let headerHTML = `<div class="card-header"><span class="card-id">${query}</span>`;
    
    if (currentMode === 'ARMADO') {
        const conn = db.conexiones.find(c => c.ID_Origen === query || c.ID_Destino === query);
        const statusClass = conn?.Estado_Instalacion === 'Conectado' ? 'badge-done' : 'badge-pending';
        headerHTML += `<span class="badge ${statusClass}">${conn?.Estado_Instalacion || 'S/D'}</span>`;
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
            <button class="action-btn btn-primary" onclick="handleUpdatePatch('${query}')">Marcar como Conectado</button>
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
        const conn = db.conexiones.find(c => c.ID_Origen === action.id || c.ID_Destino === action.id);
        if (conn) conn.Estado_Instalacion = action.value;
    } else {
        const item = [...db.equipos, ...db.cables].find(i => i.ID === action.id);
        if (item) item.Estado_Logistica = action.value;
    }
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
    const response = await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // GAS often needs no-cors for simple posts or careful CORS headers
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
    });
    console.log('Action synced with server');
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
    renderResults();
});

modeDesarmeBtn.addEventListener('click', () => {
    currentMode = 'DESARME';
    modeDesarmeBtn.classList.add('active');
    modeArmadoBtn.classList.remove('active');
    renderResults();
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
