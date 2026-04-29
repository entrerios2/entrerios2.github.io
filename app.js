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
const activeModeDisplay = document.getElementById('activeModeDisplay');
const sideMenu = document.getElementById('sideMenu');
const menuBtn = document.getElementById('menuBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
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
    populateDatalists();
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
 * 2.1 Utilidades de Búsqueda
 */
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function getItemById(id) {
    return [...db.equipos, ...db.cables].find(i => (i.ID_Equipo || i.ID_Cable) === id);
}

/**
 * 3. Renderizado de Interfaz
 */
function renderResults(specificId = null) {
    const rawQuery = searchInput.value.trim().toUpperCase();
    resultsContainer.innerHTML = '';

    // Si el buscador está vacío y no hay ID específico, mostrar inventario
    if (!rawQuery && !specificId) {
        renderInventory();
        return;
    }

    // Si viene de un clic en coincidencia múltiple o inventario
    if (specificId) {
        renderDetailView(specificId);
        return;
    }

    // Buscar coincidencias
    const matches = [...db.equipos, ...db.cables].filter(item => {
        const id = (item.ID_Equipo || item.ID_Cable || '').toUpperCase();
        const nombre = (item.Nombre || item.Tipo_Conector || '').toUpperCase();
        return id.includes(rawQuery) || nombre.includes(rawQuery);
    });

    if (matches.length === 0) {
        resultsContainer.innerHTML = `<div class="card" style="text-align:center">No se encontró el ID o Nombre "${rawQuery}"</div>`;
        return;
    }

    if (matches.length > 1) {
        // Vista de lista (Coincidencias Múltiples)
        resultsContainer.innerHTML = `<p style="margin-bottom:1rem; font-size:0.8rem; color:var(--text-secondary)">${matches.length} coincidencias encontradas:</p>`;
        matches.forEach(item => {
            const id = item.ID_Equipo || item.ID_Cable;
            const nombre = item.Nombre || item.Tipo_Conector || '';
            const card = document.createElement('div');
            card.className = 'card match-card';
            card.innerHTML = `
                <div style="font-weight:700; color:var(--accent-cyan)">${highlightText(id, rawQuery)}</div>
                <div style="font-size:0.9rem">${highlightText(nombre, rawQuery)}</div>
            `;
            card.onclick = () => renderResults(id);
            resultsContainer.appendChild(card);
        });
    } else {
        // Coincidencia Única
        renderDetailView(matches[0].ID_Equipo || matches[0].ID_Cable);
    }
}

function renderInventory() {
    resultsContainer.innerHTML = '<div class="inventory-section"></div>';
    const container = resultsContainer.querySelector('.inventory-section');

    const sections = [
        { title: 'Equipos', data: db.equipos, idKey: 'ID_Equipo', icon: 'settings_input_component' },
        { title: 'Cables', data: db.cables, idKey: 'ID_Cable', icon: 'settings_input_hdmi' }
    ];

    sections.forEach(section => {
        if (section.data.length === 0) return;

        const group = document.createElement('div');
        group.className = 'inventory-group';
        group.innerHTML = `<h3><span class="material-icons" style="font-size:1rem; vertical-align:middle; margin-right:5px">${section.icon}</span> ${section.title}</h3>`;

        section.data.forEach(item => {
            const id = item[section.idKey];
            const nombre = item.Nombre || item.Tipo_Conector || 'S/D';
            
            const itemEl = document.createElement('div');
            itemEl.className = 'inventory-item';
            itemEl.innerHTML = `
                <div>
                    <div class="item-id">${id}</div>
                    <div class="item-info">${nombre}</div>
                </div>
                <span class="material-icons" style="color:var(--text-secondary)">chevron_right</span>
            `;
            itemEl.onclick = () => renderResults(id);
            group.appendChild(itemEl);
        });
        container.appendChild(group);
    });
}

function clearSearch() {
    searchInput.value = '';
    renderResults();
}

function renderDetailView(id) {
    const itemInfo = getItemById(id);
    const inputs = db.conexiones.filter(c => c.ID_Destino === id);
    const outputs = db.conexiones.filter(c => c.ID_Origen === id);

    const card = document.createElement('div');
    card.className = 'card';

    // Header logic: Back button + ID
    const headerHTML = `
        <div class="back-header">
            <button class="back-btn" onclick="clearSearch()">
                <span class="material-icons">arrow_back</span>
            </button>
            <div>
                <span class="card-id" style="font-size:1.4rem">${id}</span>
                <div class="node-metadata">${itemInfo?.Nombre || itemInfo?.Tipo_Conector || ''}</div>
            </div>
        </div>
    `;

    // Center Icon logic
    const isCable = id.startsWith('CBL');
    const centerIcon = isCable ? 'settings_input_hdmi' : 'settings_input_component';

    // Grid: Inputs | Center | Outputs
    const bodyHTML = `
        <div class="node-grid">
            <!-- Columna Izquierda: ENTRADAS -->
            <div class="node-column">
                <h4>Entradas</h4>
                ${inputs.length > 0 ? inputs.map(c => `
                    <div class="conn-item">
                        <span class="conn-port">${c.Puerto_Destino || 'Input'}</span>
                        <span class="conn-type">${c.Tipo_Senial || ''}</span>
                        <div class="jump-btn" onclick="renderResults('${c.ID_Origen}')">
                            <span class="material-icons">link</span> ${c.ID_Origen}
                        </div>
                    </div>
                `).join('') : '<p style="text-align:center; font-size:0.8rem; color:var(--text-secondary)">Sin entradas</p>'}
            </div>

            <!-- Centro: Equipo -->
            <div class="node-center">
                <span class="material-icons">${centerIcon}</span>
                <div style="font-size:0.7rem; margin-top:5px; color:var(--accent-cyan); font-weight:700">
                    ${currentMode}
                </div>
            </div>

            <!-- Columna Derecha: SALIDAS -->
            <div class="node-column">
                <h4>Salidas</h4>
                ${outputs.length > 0 ? outputs.map(c => `
                    <div class="conn-item">
                        <span class="conn-port">${c.Puerto_Origen || 'Output'}</span>
                        <span class="conn-type">${c.Tipo_Senial || ''}</span>
                        <div class="jump-btn" onclick="renderResults('${c.ID_Destino}')">
                            ${c.ID_Destino} <span class="material-icons">link</span>
                        </div>
                        ${currentMode === 'ARMADO' ? `
                            <div style="margin-top:5px; border-top:1px solid var(--border-color); padding-top:5px">
                                <span class="badge ${c.Estado_Instalacion === 'Conectado' ? 'badge-done' : 'badge-pending'}" 
                                      style="cursor:pointer; font-size:0.6rem" 
                                      onclick="handleUpdatePatch('${c.ID_Patch}')">
                                    ${c.Estado_Instalacion}
                                </span>
                            </div>
                        ` : ''}
                    </div>
                `).join('') : '<p style="text-align:center; font-size:0.8rem; color:var(--text-secondary)">Sin salidas</p>'}
            </div>
        </div>

        ${currentMode === 'DESARME' ? `
            <div class="card" style="margin-top:1.5rem; background:rgba(255,255,255,0.02)">
                <p><small>Propietario:</small> <strong>${itemInfo?.Propietario || 'Desconocido'}</strong></p>
                <p><small>Guardar en:</small> <strong>${itemInfo?.Lugar_Guardado_Final || 'S/D'}</strong></p>
                <button class="action-btn btn-primary" style="margin-top:10px" 
                        onclick="handleUpdateLogistica('${id}', '${itemInfo?.Propietario?.toLowerCase().includes('propio') ? 'Guardado' : 'Devuelto'}')">
                    Marcar Logística
                </button>
            </div>
        ` : ''}
    `;

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
        const nombre = item.Nombre || item.Tipo_Conector || '';
        const displayName = nombre ? `${id} (${nombre})` : id;
        return `<option value="${id}">${displayName}</option>`;
    }).join('');

    const placeholder = '<option value="">-- Seleccionar --</option>';
    selOrigen.innerHTML = placeholder + options;
    selDestino.innerHTML = placeholder + options;
}

function populateDatalists() {
    const lists = {
        'list_categorias': new Set(db.equipos.map(e => e.Categoria)),
        'list_ubicaciones': new Set(db.equipos.map(e => e.Ubicacion_Uso)),
        'list_propietarios': new Set([...db.equipos, ...db.cables].map(i => i.Propietario)),
        'list_lugares': new Set([...db.equipos, ...db.cables].map(i => i.Lugar_Guardado_Final)),
        'list_conectores': new Set(db.cables.map(c => c.Tipo_Conector))
    };

    for (const [id, values] of Object.entries(lists)) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.innerHTML = Array.from(values).filter(v => v).map(v => `<option value="${v}">`).join('');
    }
}

function autoGenerateId(formType) {
    let prefix = '';
    if (formType === 'equipo') {
        const cat = document.getElementById('equip_cat').value.substring(0, 3).toUpperCase();
        const nom = document.getElementById('equip_nombre').value.substring(0, 3).toUpperCase();
        if (cat && nom) prefix = `${cat}-${nom}`;
    } else {
        const tip = document.getElementById('cable_tipo').value.substring(0, 3).toUpperCase();
        if (tip) prefix = `CBL-${tip}`;
    }

    if (!prefix) return;

    const existing = [...db.equipos, ...db.cables].filter(i => (i.ID_Equipo || i.ID_Cable || '').startsWith(prefix));
    let max = 0;
    existing.forEach(i => {
        const num = parseInt((i.ID_Equipo || i.ID_Cable).split('-').pop());
        if (!isNaN(num) && num > max) max = num;
    });

    const newId = `${prefix}-${String(max + 1).padStart(3, '0')}`;
    const targetInput = formType === 'equipo' ? document.getElementById('equip_id') : document.getElementById('cable_id');
    if (targetInput && !targetInput.value.includes(prefix)) {
        targetInput.value = newId;
    }
}

// Handlers de Formularios
document.getElementById('equip_cat')?.addEventListener('input', () => autoGenerateId('equipo'));
document.getElementById('equip_nombre')?.addEventListener('input', () => autoGenerateId('equipo'));
document.getElementById('cable_tipo')?.addEventListener('input', () => autoGenerateId('cable'));

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

    const originalText = searchInput.placeholder;
    searchInput.placeholder = "Enviando a la base...";
    searchInput.disabled = true;

    if (navigator.onLine) {
        try {
            await sendToServer(action);
            // Feedback visual exitoso
            const btns = document.querySelectorAll('.card .action-btn, #adminPanel .action-btn');
            btns.forEach(btn => {
                const oldText = btn.innerText;
                btn.innerText = "¡Enviado!";
                btn.classList.add('btn-success');
                setTimeout(() => { btn.innerText = oldText; btn.classList.remove('btn-success'); }, 2000);
            });
        } catch (e) {
            queueAction(action);
        }
    } else {
        queueAction(action);
    }

    searchInput.placeholder = originalText;
    searchInput.disabled = false;
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
function setMode(mode) {
    currentMode = mode;
    activeModeDisplay.innerText = mode;
    sideMenu.classList.remove('active');
    
    if (mode === 'ADMIN') {
        adminPanel.style.display = 'block';
        searchSection.style.display = 'none';
        resultsContainer.style.display = 'none';
    } else {
        adminPanel.style.display = 'none';
        searchSection.style.display = 'flex';
        resultsContainer.style.display = 'block';
        renderResults();
    }
}

function shareApp() {
    const url = new URL(window.location.origin + window.location.pathname);
    const gasUrl = localStorage.getItem('gas_api_url');
    if (gasUrl) {
        const id = gasUrl.split('/s/')[1].split('/exec')[0];
        url.searchParams.set('gas_id', id);
    }
    
    const finalUrl = url.toString();
    
    if (navigator.share) {
        navigator.share({
            title: 'Circuito AV Tech',
            text: 'Accede a la base de datos de montaje AV',
            url: finalUrl
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(finalUrl);
        alert('URL copiada al portapapeles: ' + finalUrl);
    }
}

// Sidebar listeners
menuBtn.addEventListener('click', () => sideMenu.classList.add('active'));
closeMenuBtn.addEventListener('click', () => sideMenu.classList.remove('active'));
window.addEventListener('click', (e) => { if (e.target === sideMenu) sideMenu.classList.remove('active'); });

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

searchInput.addEventListener('input', () => renderResults());

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
