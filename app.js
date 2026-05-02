/**
 * AV Tech SPA - Logic Core
 * Vanilla JS + Graph Traversal + PWA Sync
 */

// --- Utilidades ---
function escapeHTML(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

function showToast(message, type = 'info', duration = 3000) {
    let host = document.getElementById('toastHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toastHost';
        host.className = 'toast-host';
        document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 200);
    }, duration);
}

function alertModal(message, title = 'Aviso') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay app-modal';
        overlay.innerHTML = `
            <div class="app-modal-card">
                <h3 class="app-modal-title"></h3>
                <p class="app-modal-msg"></p>
                <div class="app-modal-actions">
                    <button class="action-btn btn-primary" data-action="ok">Aceptar</button>
                </div>
            </div>`;
        overlay.querySelector('.app-modal-title').textContent = title;
        overlay.querySelector('.app-modal-msg').textContent = message;
        document.body.appendChild(overlay);
        const close = () => { overlay.remove(); resolve(); };
        overlay.querySelector('[data-action=ok]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    });
}

function confirmModal(message, title = 'Confirmar') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay app-modal';
        overlay.innerHTML = `
            <div class="app-modal-card">
                <h3 class="app-modal-title"></h3>
                <p class="app-modal-msg"></p>
                <div class="app-modal-actions">
                    <button class="action-btn app-modal-cancel" data-action="cancel">Cancelar</button>
                    <button class="action-btn btn-primary" data-action="ok">Aceptar</button>
                </div>
            </div>`;
        overlay.querySelector('.app-modal-title').textContent = title;
        overlay.querySelector('.app-modal-msg').textContent = message;
        document.body.appendChild(overlay);
        const close = (val) => { overlay.remove(); resolve(val); };
        overlay.querySelector('[data-action=ok]').addEventListener('click', () => close(true));
        overlay.querySelector('[data-action=cancel]').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
}

function inputModal(label, { title = 'Ingresar valor', placeholder = '', defaultValue = '' } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay app-modal';
        overlay.innerHTML = `
            <div class="app-modal-card">
                <h3 class="app-modal-title"></h3>
                <label class="app-modal-label"></label>
                <input type="text" class="app-modal-input" autocomplete="off">
                <div class="app-modal-actions">
                    <button class="action-btn app-modal-cancel" data-action="cancel">Cancelar</button>
                    <button class="action-btn btn-primary" data-action="ok">Aceptar</button>
                </div>
            </div>`;
        overlay.querySelector('.app-modal-title').textContent = title;
        overlay.querySelector('.app-modal-label').textContent = label;
        const input = overlay.querySelector('.app-modal-input');
        input.placeholder = placeholder;
        input.value = defaultValue;
        document.body.appendChild(overlay);
        setTimeout(() => input.focus(), 50);
        const close = (val) => { overlay.remove(); resolve(val); };
        overlay.querySelector('[data-action=ok]').addEventListener('click', () => close(input.value.trim()));
        overlay.querySelector('[data-action=cancel]').addEventListener('click', () => close(null));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') close(input.value.trim());
            if (e.key === 'Escape') close(null);
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    });
}

let API_URL = "";

// State
let db = { equipos: [], cables: [], conexiones: [] };
let currentMode = 'OPERACION';
let techName = localStorage.getItem('tech_name') || "";
let currentSort = { type: '', column: '', direction: 'asc' };
let selectedBranches = {}; // nodeId -> choiceId (for tree navigation)
let treeMaxDepth = 1; // Default depth for tree expansion
let activeGroupings = { equipos: '', cables: '', conexiones: '' };
let sectionsOpenState = { equipos: false, cables: false, conexiones: false };
let html5QrCode = null;
let originalBatchIds = []; // Tracking IDs for batch patching deletions

// DOM Elements
const searchInput = document.getElementById('searchInput');
const qrStartBtn = document.getElementById('qrStartBtn');
const resultsContainer = document.getElementById('resultsContainer');
const activeModeDisplay = document.getElementById('activeModeDisplay');
const sideMenu = document.getElementById('sideMenu');
const menuBtn = document.getElementById('menuBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const adminPanel = document.getElementById('adminPanel');
const adminTableHead = document.getElementById('adminTableHead');
const adminTableBody = document.getElementById('adminTableBody');
const adminFormContainer = document.getElementById('adminModal');
const formContainerInner = document.getElementById('formContainerInner');
const searchSection = document.querySelector('.search-container');
const offlineStatus = document.querySelector('.offline-status');
const searchToggleBtn = document.getElementById('searchToggleBtn');
const searchContainer = document.getElementById('searchContainer');
const offlineIcon = document.getElementById('offlineIcon');

// Navigation History
window.addEventListener('popstate', (e) => {
    if (e.state) {
        if (e.state.view === 'detail') {
            searchInput.value = '';
            renderResults(e.state.id, false);
        } else if (e.state.mode) {
            setMode(e.state.mode, false);
        } else {
            clearSearch(false);
        }
    } else {
        clearSearch(false);
    }
});

// Search Toggle
searchToggleBtn?.addEventListener('click', () => {
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'flex';
        searchInput.focus();
    } else {
        searchContainer.style.display = 'none';
    }
});

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
    migrateOfflineQueue();
    updateOfflineStatus();

    // Identidad
    if (!techName) {
        techName = await inputModal('Tu nombre quedará registrado en cada cambio.', {
            title: 'Identificación',
            placeholder: 'Ej: Juan Pérez'
        });
        if (!techName) techName = "Técnico Anónimo";
        localStorage.setItem('tech_name', techName);
    }

    // Skeletons
    resultsContainer.innerHTML = `
        <div class="inventory-section">
            <div class="skeleton" style="height: 300px; width: 100%; margin-bottom: 20px;"></div>
            <div class="skeleton" style="height: 300px; width: 100%;"></div>
        </div>
    `;

    await fetchData();
    populateDatalists();
    updateSelects();
    
    // Check if there is an id or mode in URL for history state
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    const modeParam = urlParams.get('mode');
    
    if (modeParam && ['OPERACION', 'ADMIN', 'MAPA'].includes(modeParam)) {
        setMode(modeParam, false);
    } else {
        setMode('OPERACION', false);
    }
    
    if (idParam) {
        searchInput.value = idParam;
        renderResults(idParam, false);
    } else {
        renderResults(null, false);
    }
}

function loadLocalData() {
    const saved = localStorage.getItem('av_tech_db');
    if (saved) {
        db = JSON.parse(saved);
        applyConfig();
    }
}

async function fetchData() {
    if (!navigator.onLine) return;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        db = data;
        localStorage.setItem('av_tech_db', JSON.stringify(db));
        console.log('Base de datos actualizada');
        applyConfig();
    } catch (error) {
        console.warn('No se pudo obtener datos frescos, usando caché local', error);
        applyConfig();
    }
}

async function refreshDatabase() {
    const btn = document.getElementById('refreshBtn');
    const icon = btn?.querySelector('.material-icons');
    if (btn && icon) {
        btn.disabled = true;
        icon.classList.add('spin-animation');
    }

    try {
        await fetchData();
        populateDatalists();
        updateSelects();
        
        // Re-render current view
        const currentMode = localStorage.getItem('av_tech_mode') || 'OPERACION';
        if (currentMode === 'ADMIN') {
            renderAdminTable(currentSort.type || 'equipos');
        } else if (currentMode === 'MAPA') {
            if (typeof renderMapTopology === 'function') renderMapTopology();
        } else {
            const centralNode = document.querySelector('.tree-node.central .badge-id');
            if (centralNode) {
                renderTree(centralNode.innerText);
            } else {
                renderInventory();
            }
        }
    } catch (e) {
        console.error("Refresh failed:", e);
    } finally {
        if (btn && icon) {
            btn.disabled = false;
            icon.classList.remove('spin-animation');
        }
    }
}

function applyConfig() {
    if (!db.configuracion) return;

    // 1. Título de la App
    const titleConfig = db.configuracion.find(c => c.ID_Configuracion === 'nombre_pagina');
    if (titleConfig && titleConfig.Valor) {
        const titleEl = document.getElementById('appTitle');
        if (titleEl) titleEl.innerText = titleConfig.Valor;
        document.title = titleConfig.Valor;
    }

    // 2. Referencias en Sidebar (Metadatos: { "Titulo": { "icono": "...", "url": "..." } })
    const refsConfig = db.configuracion.find(c => c.ID_Configuracion === 'referencias');
    if (refsConfig && refsConfig.Metadatos) {
        try {
            const refsObj = JSON.parse(refsConfig.Metadatos);
            const container = document.getElementById('sidebarReferences');
            if (container) {
                container.innerHTML = Object.entries(refsObj).map(([label, info]) => {
                    const icon = info.icono || 'link';
                    const url = info.url || '#';
                    return `
                        <a href="${url}" target="_blank" class="menu-item">
                            <span class="material-icons">${icon}</span> ${label}
                        </a>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error("Error parsing references config", e);
        }
    }
}

/**
 * 1.1 Trazabilidad y Metadatos
 */
async function logActivity(itemId, type, detail) {
    console.log(`Logging ${type} for ${itemId}: ${detail}`);
    const item = getItemById(itemId) || db.conexiones.find(c => String(c.ID_Patch) === String(itemId));
    if (!item) return;

    let meta = { historial: [], notas: [] };
    try {
        if (item.Metadatos) {
            const parsed = JSON.parse(item.Metadatos);
            meta = {
                historial: Array.isArray(parsed.historial) ? parsed.historial : [],
                notas: Array.isArray(parsed.notas) ? parsed.notas : []
            };
        }
    } catch(e) { console.error("Error parsing Metadatos", e); }

    const entry = {
        timestamp: Date.now(),
        nombre: techName,
        detalle: detail
    };

    if (type === 'NOTE') {
        meta.notas.push(entry);
    } else {
        meta.historial.push(entry);
    }

    const metaStr = JSON.stringify(meta);
    item.Metadatos = metaStr; // Update local state

    await handleAction('UPDATE_METADATOS', { id: itemId, value: metaStr });
}

function formatRelativeDate(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    // Formato 24h: HH:mm
    const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (isToday) return timeStr;
    
    // Fecha y hora: DD/MM/AAAA HH:mm
    const dateStr = d.toLocaleDateString('es-AR');
    return `${dateStr} ${timeStr}`;
}

async function addNote(id) {
    const text = document.getElementById(`note_input_${id}`)?.value.trim();
    if (!text) return;
    logActivity(id, 'NOTE', text);
    renderResults(id, false); // Re-render to show new note
}

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
    const safeText = escapeHTML(text);
    if (!query) return safeText;
    const escapedQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return safeText.replace(regex, '<span class="search-highlight">$1</span>');
}

function migrateOfflineQueue() {
    try {
        const legacy = localStorage.getItem('av_tech_queue');
        if (!legacy) return;
        const legacyArr = JSON.parse(legacy);
        if (Array.isArray(legacyArr) && legacyArr.length) {
            const current = JSON.parse(localStorage.getItem('offline_queue') || '[]');
            localStorage.setItem('offline_queue', JSON.stringify(current.concat(legacyArr)));
        }
        localStorage.removeItem('av_tech_queue');
    } catch (e) {
        localStorage.removeItem('av_tech_queue');
    }
}

function getItemById(id) {
    return [...db.equipos, ...db.cables].find(i => String(i.ID_Equipo || i.ID_Cable) === String(id));
}

/**
 * 3. Renderizado de Interfaz
 */
function clearSearch(pushState = true) {
    searchInput.value = '';
    if (pushState) history.pushState({ view: 'inventory' }, '', window.location.pathname);
    renderResults(null, false);
}

function renderInventory() {
    const targetContainer = currentMode === 'ADMIN' ? document.getElementById('adminInventoryContainer') : resultsContainer;
    targetContainer.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'inventory-section';

    const sections = [
        { 
            type: 'equipos', title: 'Equipos', icon: 'speaker',
            groups: [{val: '', label: 'Sin Agrupar'}, {val: 'Categoria', label: 'Categoría'}, {val: 'Ubicacion', label: 'Ubicación'}, {val: 'Contenedor', label: 'Contenedor'}, {val: 'Propietario', label: 'Propietario'}, {val: 'Estado', label: 'Estado'}]
        },
        { 
            type: 'cables', title: 'Cables', icon: 'cable',
            groups: [{val: '', label: 'Sin Agrupar'}, {val: 'Tipo', label: 'Tipo'}, {val: 'Largo', label: 'Longitud'}, {val: 'Ubicacion', label: 'Ubicación'}, {val: 'Categoria', label: 'Categoría'}, {val: 'Propietario', label: 'Propietario'}, {val: 'Contenedor', label: 'Contenedor'}, {val: 'Estado', label: 'Estado'}]
        },
        { 
            type: 'conexiones', title: 'Conexiones', icon: 'settings_input_component',
            groups: [{val: '', label: 'Sin Agrupar'}, {val: 'ID_Origen', label: 'Origen'}, {val: 'ID_Destino', label: 'Destino'}, {val: 'Tipo_Senial', label: 'Tipo Señal'}, {val: 'Estado', label: 'Estado'}]
        }
    ];

    sections.forEach(section => {
        const details = document.createElement('details');
        details.className = 'premium-details main-section';
        if (activeGroupings[section.type] || sectionsOpenState[section.type]) details.open = true;
        
        details.ontoggle = () => {
            if (details.open) sectionsOpenState[section.type] = true;
            else sectionsOpenState[section.type] = false;
        };

        const headers = (section.type === 'equipos') ? ['ID_Equipo', 'Nombre', 'Categoria', 'Ubicacion', 'Contenedor', 'Estado'] :
                      (section.type === 'cables') ? ['ID_Cable', 'Tipo', 'Largo', 'Ubicacion', 'Categoria', 'Contenedor', 'Estado'] :
                      ['ID_Patch', 'ID_Origen', 'Puerto_Origen', 'ID_Destino', 'Puerto_Destino', 'Tipo_Senial', 'Estado'];

        const renderTableHTML = (tableData) => `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>${headers.map(h => {
                            let label = h;
                            if (h.startsWith('ID_')) label = 'ID';
                            if (h === 'Ubicacion') label = 'Ubicación';
                            if (h === 'Contenedor') label = 'Contenedor';
                            if (h === 'Estado') label = 'Estado';
                            if (h === 'Tipo') label = 'Tipo';
                            if (h === 'Largo') label = 'Largo (m)';
                            if (h === 'Puerto_Origen' || h === 'Puerto_Destino') label = 'Puerto';
                            if (h === 'ID_Origen') label = 'Origen';
                            if (h === 'ID_Destino') label = 'Destino';
                            if (h === 'Tipo_Senial') label = 'Señal';
                            
                            return `<th onclick="event.stopPropagation(); sortInventory('${section.type}', '${h}')">${label}</th>`;
                        }).join('')}</tr>
                    </thead>
                    <tbody>
                        ${tableData.map(row => {
                            let clickAction = '';
                            if (currentMode === 'ADMIN') {
                                clickAction = `editItem('${section.type}', '${row[headers[0]]}')`;
                            } else {
                                if (section.type === 'conexiones') {
                                    clickAction = `showConnectionModal('${row.ID_Patch}')`;
                                } else {
                                    clickAction = `renderResults('${row[headers[0]]}')`;
                                }
                            }
                            return `
                                <tr onclick="event.stopPropagation(); ${clickAction}" style="cursor:pointer">
                                    ${headers.map(h => {
                                        let val = row[h] || '-';
                                        const colorClass = val === 'Conectado' ? 'status-green' : (val === 'Pendiente' ? 'status-red' : '');
                                        
                                        if (section.type === 'conexiones' && (h === 'ID_Origen' || h === 'ID_Destino')) {
                                            const targetId = row[h];
                                            const targetItem = db.cables.find(c => String(c.ID_Cable) === String(targetId));
                                            const icon = targetItem ? 'cable' : 'speaker';
                                            val = `<div style="display:flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:0.9rem; color:var(--accent-cyan)">${icon}</span>${val}</div>`;
                                        }

                                        return `<td class="${colorClass}">${val}</td>`;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const summary = document.createElement('summary');
        summary.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
                <span class="material-icons chevron">expand_more</span>
                <h3 style="margin:0; font-size:1.1rem;"><span class="material-icons" style="vertical-align:middle; margin-right:5px;">${section.icon}</span> ${section.title}</h3>
                <div class="grouping-capsule" onclick="event.stopPropagation()">
                    <span class="material-icons">layers</span>
                    <select class="premium-select-form" onchange="setGrouping('${section.type}', this.value)" style="padding: 4px 25px 4px 10px !important; font-size: 0.8rem !important; width: auto !important; height: auto !important; border-radius: 6px !important;">
                        ${section.groups.map(g => `<option value="${g.val}" ${activeGroupings[section.type] === g.val ? 'selected' : ''}>${g.label}</option>`).join('')}
                    </select>
                </div>
                ${currentMode === 'ADMIN' && section.type !== 'conexiones' ? `
                    <button class="print-btn-main" onclick="event.stopPropagation(); preparePrintLabels('${section.type}')" title="Imprimir Etiquetas">
                        <span class="material-icons">print</span>
                    </button>
                ` : ''}
            </div>
            ${currentMode === 'ADMIN' ? `
                <button class="add-circular-btn" title="Nuevo ${section.title}" 
                        onclick="event.stopPropagation(); toggleAdminForm('${section.type}')">
                    <span class="material-icons">add</span>
                </button>` : ''}
        `;
        details.appendChild(summary);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'details-content';

        let data = [...db[section.type]];
        if (currentSort.type === section.type && currentSort.column) {
            data.sort((a, b) => {
                let valA = a[currentSort.column] || '';
                let valB = b[currentSort.column] || '';
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
                if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default Sort requested by USER
            const defaultKey = section.type === 'equipos' ? 'Nombre' : (section.type === 'cables' ? 'Tipo' : 'ID_Patch');
            data.sort((a, b) => String(a[defaultKey] || '').localeCompare(String(b[defaultKey] || ''), undefined, {numeric: true, sensitivity: 'base'}));
        }
        const currentGroup = activeGroupings[section.type];

        if (!currentGroup) {
            contentDiv.innerHTML = renderTableHTML(data);
        } else {
            const grouped = {};
            data.forEach(item => {
                const key = item[currentGroup] || 'Sin Asignar';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(item);
            });
            
            Object.entries(grouped).forEach(([key, items]) => {
                const subDetails = document.createElement('details');
                subDetails.className = 'premium-details';
                subDetails.innerHTML = `
                    <summary style="display:flex; align-items:center;">
                        <span class="material-icons chevron">expand_more</span> 
                        <span style="flex:1">${key} <span class="badge-count">${items.length}</span></span>
                        ${currentMode === 'ADMIN' && section.type !== 'conexiones' ? `
                            <button class="print-btn-main" onclick="event.stopPropagation(); preparePrintLabels('${section.type}', '${currentGroup}', '${key}')" title="Imprimir este grupo" style="opacity: 0.7; pointer-events: auto; transform: none; margin-right: 10px; width: 28px; height: 28px;">
                                <span class="material-icons" style="font-size: 1rem;">print</span>
                            </button>
                        ` : ''}
                    </summary>
                    <div class="details-content">
                        ${renderTableHTML(items)}
                    </div>
                `;
                contentDiv.appendChild(subDetails);
            });
        }
        
        details.appendChild(contentDiv);
        container.appendChild(details);
    });
    
    targetContainer.appendChild(container);
}

function setGrouping(type, column) {
    activeGroupings[type] = column;
    renderInventory();
}


function sortInventory(type, column) {
    if (currentSort.column === column && currentSort.type === type) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.type = type;
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    renderInventory();
}

function mapToDb(body, type) {
    const entry = {};
    const mapFields = (fields) => {
        fields.forEach(([dbKey, bodyKey]) => {
            if (body[bodyKey] !== undefined) entry[dbKey] = body[bodyKey];
        });
    };

    if (type === 'equipos') {
        mapFields([
            ['ID_Equipo', 'id'], ['Nombre', 'nombre'], ['Categoria', 'categoria'],
            ['Ubicacion', 'ubicacion'], ['Propietario', 'propietario'],
            ['Contenedor', 'lugar'], ['Estado', 'estado'], ['Notas', 'notas']
        ]);
    } else if (type === 'cables') {
        mapFields([
            ['ID_Cable', 'id'], ['Tipo', 'tipo'], ['Largo', 'longitud'],
            ['Ubicacion', 'ubicacion'], ['Categoria', 'categoria'],
            ['Propietario', 'propietario'], ['Contenedor', 'lugar'],
            ['Estado', 'estado'], ['Notas', 'notas']
        ]);
    } else if (type === 'conexiones') {
        mapFields([
            ['ID_Patch', 'id_patch'], ['ID_Origen', 'id_origen'], ['Puerto_Origen', 'puerto_origen'],
            ['ID_Destino', 'id_destino'], ['Puerto_Destino', 'puerto_destino'],
            ['Tipo_Senial', 'tipo_senial'], ['Estado', 'estado'], ['Notas', 'notas']
        ]);
    }
    
    // Preserve Metadata if editing
    if (body.metadatos !== undefined) {
        entry.Metadatos = body.metadatos;
    } else if (body.isEdit === 'true' || body.value) { // value indicates partial update usually
        const idVal = body.id || body.id_patch;
        const oldItem = [...db.equipos, ...db.cables, ...db.conexiones].find(i => (i.ID_Equipo || i.ID_Cable || i.ID_Patch) === idVal);
        if (oldItem && oldItem.Metadatos) {
            entry.Metadatos = oldItem.Metadatos;
        }
    }
    
    return entry;
}

function renderResults(specificId = null, pushState = true) {
    const rawQuery = searchInput.value.trim().toUpperCase();
    resultsContainer.innerHTML = '';
    treeMaxDepth = 1; // Reset depth on new search

    if (!rawQuery && !specificId) {
        renderInventory();
        return;
    }

    // Push State for Back Button
    if (pushState && specificId) {
        history.pushState({ view: 'detail', id: specificId }, '', `?id=${specificId}`);
    }

    if (specificId) {
        renderTree(specificId, true);
        return;
    }

    const matches = [...db.equipos, ...db.cables].filter(item => {
        const id = (item.ID_Equipo || item.ID_Cable || '').toUpperCase();
        const nombre = (item.Nombre || item.Tipo || '').toUpperCase();
        return id.includes(rawQuery) || nombre.includes(rawQuery);
    });

    if (matches.length === 0) {
        resultsContainer.innerHTML = `<div class="card" style="text-align:center">No se encontró "${escapeHTML(rawQuery)}"</div>`;
        return;
    }

    if (matches.length > 1) {
        resultsContainer.innerHTML = `<p style="margin-bottom:1rem; font-size:0.8rem; color:var(--text-secondary)">${matches.length} coincidencias:</p>`;
        matches.forEach(item => {
            const id = item.ID_Equipo || item.ID_Cable;
            const nombre = item.Nombre || item.Tipo || '';
            const isCable = id.startsWith('CBL') || id.startsWith('C-');
            const card = document.createElement('div');
            card.className = 'card match-card';
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px">
                    <span class="material-icons" style="color:var(--accent-cyan)">${isCable ? 'cable' : 'speaker'}</span>
                    <div>
                        <div style="font-weight:700; color:var(--accent-cyan)">${highlightText(id, rawQuery)}</div>
                        <div style="font-size:0.9rem">${highlightText(nombre, rawQuery)}</div>
                    </div>
                </div>
            `;
            card.onclick = () => renderResults(id);
            resultsContainer.appendChild(card);
        });
    } else {
        renderTree(matches[0].ID_Equipo || matches[0].ID_Cable);
    }
}

function renderTree(centralId, shouldScroll = false) {
    resultsContainer.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tree-container';

    // 1. Trace Backwards (Parents)
    const parents = tracePath(centralId, 'back', treeMaxDepth);
    
    if (parents.length === treeMaxDepth) {
        const btn = document.createElement('button');
        btn.className = 'expand-tree-btn';
        btn.innerHTML = '<span class="material-icons">keyboard_double_arrow_up</span>';
        btn.title = "Expandir origen";
        btn.onclick = () => { treeMaxDepth++; renderTree(centralId, false); };
        container.appendChild(btn);
    }

    // Render Nodes
    parents.reverse().forEach((p, index, arr) => {
        const fixedOutput = p.conn;
        const fixedInput = (index > 0) ? arr[index - 1].conn : null;
        container.appendChild(renderTreeNode(p.id, false, fixedInput, fixedOutput));
        container.appendChild(renderTreeConnection(p.conn, 'down'));
    });

    // 2. Central Node
    container.appendChild(renderTreeNode(centralId, true, null, null));

    // 3. Trace Forwards (Children)
    const children = tracePath(centralId, 'forward', treeMaxDepth);
    children.forEach((c, index, arr) => {
        const fixedInput = c.conn;
        const fixedOutput = (index < arr.length - 1) ? arr[index + 1].conn : null;
        container.appendChild(renderTreeConnection(c.conn, 'down'));
        container.appendChild(renderTreeNode(c.id, false, fixedInput, fixedOutput));
    });

    if (children.length === treeMaxDepth) {
        const btn = document.createElement('button');
        btn.className = 'expand-tree-btn';
        btn.innerHTML = '<span class="material-icons">keyboard_double_arrow_down</span>';
        btn.title = "Expandir destino";
        btn.onclick = () => { treeMaxDepth++; renderTree(centralId, false); };
        container.appendChild(btn);
    }

    resultsContainer.appendChild(container);
    
    // Smooth scroll only if explicitly requested (e.g. opening a new ficha)
    if (shouldScroll) {
        setTimeout(() => {
            const central = container.querySelector('.tree-node.central');
            if (central) {
                central.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
}

function tracePath(startId, direction, maxDepth) {
    const path = [];
    let currentId = startId;
    const visited = new Set([startId]);

    while (path.length < maxDepth) {
        const conns = direction === 'forward' 
            ? db.conexiones.filter(c => c.ID_Origen === currentId)
            : db.conexiones.filter(c => c.ID_Destino === currentId);

        if (conns.length === 0) break;

        let chosen = conns[0];
        if (conns.length > 1) {
            const saved = selectedBranches[`${currentId}_${direction}`];
            chosen = conns.find(c => (direction === 'forward' ? c.ID_Destino : c.ID_Origen) === saved) || conns[0];
        }

        const nextId = direction === 'forward' ? chosen.ID_Destino : chosen.ID_Origen;
        if (visited.has(nextId)) break;

        path.push({ id: nextId, conn: chosen });
        visited.add(nextId);
        currentId = nextId;
    }
    return path;
}

function renderTreeNode(id, isCentral, fixedInputConn = null, fixedOutputConn = null) {
    const info = getItemById(id);
    const isCable = !!info?.ID_Cable;
    const el = document.createElement('div');
    el.className = `tree-node ${isCentral ? 'central' : ''}`;

    const inputs = db.conexiones.filter(c => c.ID_Destino === id);
    const outputs = db.conexiones.filter(c => c.ID_Origen === id);

    // Borde de puertos (Pills)
    if (inputs.length > 0) {
        const isConn = inputs.some(c => c.Estado === 'Conectado');
        const pill = document.createElement('div');
        pill.className = `port-pill input ${isConn ? 'connected' : 'pending'}`;
        pill.innerHTML = `<span class="material-icons" style="font-size:0.8rem">login</span>`;
        
        if (fixedInputConn) {
            pill.innerHTML += fixedInputConn.Puerto_Destino;
        } else if (inputs.length === 1) {
            pill.innerHTML += inputs[0].Puerto_Destino;
        } else {
            pill.appendChild(renderPortSelect(id, inputs, 'back'));
        }
        el.appendChild(pill);
    }

    if (outputs.length > 0) {
        const isConn = outputs.some(c => c.Estado === 'Conectado');
        const pill = document.createElement('div');
        pill.className = `port-pill output ${isConn ? 'connected' : 'pending'}`;
        pill.innerHTML = `<span class="material-icons" style="font-size:0.8rem">logout</span>`;
        
        if (fixedOutputConn) {
            pill.innerHTML += fixedOutputConn.Puerto_Origen;
        } else if (outputs.length === 1) {
            pill.innerHTML += outputs[0].Puerto_Origen;
        } else {
            pill.appendChild(renderPortSelect(id, outputs, 'forward'));
        }
        el.appendChild(pill);
    }

    if (isCentral) {
        const estadoOpciones = ['En Uso', 'Guardado', 'Devuelto', 'Instalado', 'Preparado para instalar', 'Preparado para guardar'];
        const currentEstado = info?.Estado || 'Guardado';
        
        let meta = { historial: [], notas: [] };
        try { if (info?.Metadatos) meta = JSON.parse(info.Metadatos); } catch(e){}
        const lastNote = meta.notas?.length > 0 ? meta.notas[meta.notas.length-1] : null;
        const lastMove = meta.historial?.length > 0 ? meta.historial[meta.historial.length-1] : null;

        // Render manuales and montado_en
        let extraPills = '';
        if (meta.montado_en) {
            extraPills += `<div class="meta-pill" title="Montado en" style="cursor:pointer; background:var(--accent-purple-dim); border-color:var(--accent-purple);" onclick="renderResults('${meta.montado_en}')"><span class="material-icons" style="font-size:0.9rem">view_in_ar</span> Montado en: ${meta.montado_en}</div>`;
        }
        if (Array.isArray(meta.manuales)) {
            meta.manuales.forEach(m => {
                extraPills += `<div class="meta-pill" title="Manual"><a href="${m.url}" target="_blank" style="color:inherit; text-decoration:none; display:flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:0.9rem">menu_book</span> ${m.nombre || 'Enlace'}</a></div>`;
            });
        }
        
        let customJSONHtml = '';
        const customKeysHtml = renderNestedJSON(meta, ['historial', 'notas', 'manuales', 'montado_en']);
        if (customKeysHtml) {
            customJSONHtml = `<div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid #30363d;">
                <div style="color:var(--accent-cyan); font-size:0.8rem; font-weight:600; margin-bottom:8px; text-transform:uppercase;"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">data_object</span> Detalles Avanzados</div>
                ${customKeysHtml}
            </div>`;
        }
        
        el.insertAdjacentHTML('beforeend', `
            <button class="close-ficha-btn" style="right: 50px; color: var(--accent-cyan);" onclick="verEnMapa('${id}')" title="Ver en mapa"><span class="material-icons">my_location</span></button>
            <button class="close-ficha-btn" onclick="clearSearch()" title="Cerrar"><span class="material-icons">close</span></button>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px; padding-right:40px;">
                <span class="material-icons" style="color:var(--accent-cyan); font-size:1.5rem;">${isCable ? 'cable' : 'speaker'}</span>
                <h2 style="margin:0; font-size:1.2rem; line-height:1.2">${info?.Nombre || info?.Tipo || 'Sin nombre'}</h2>
                <span class="badge-id" style="font-size:0.75rem; padding:0.3rem 0.6rem;">${id}</span>
            </div>
            
            <div class="compact-meta">
                <div class="meta-pill" title="Propietario"><span class="material-icons" style="font-size:0.9rem">person</span> ${info?.Propietario || '-'}</div>
                <div class="meta-pill" title="Ubicación"><span class="material-icons" style="font-size:0.9rem">location_on</span> ${info?.Ubicacion || '-'}</div>
                <div class="meta-pill" title="Contenedor"><span class="material-icons" style="font-size:0.9rem">inventory_2</span> ${info?.Contenedor || '-'}</div>
                ${info?.Categoria ? `<div class="meta-pill" title="Categoría"><span class="material-icons" style="font-size:0.9rem">category</span> ${info.Categoria}</div>` : ''}
                ${isCable ? `
                    ${info?.Tipo ? `<div class="meta-pill" title="Tipo"><span class="material-icons" style="font-size:0.9rem">cable</span> ${info.Tipo}</div>` : ''}
                    ${info?.Largo ? `<div class="meta-pill" title="Largo"><span class="material-icons" style="font-size:0.9rem">straighten</span> ${info.Largo}m</div>` : ''}
                ` : ''}
                ${info?.Notas ? `<div class="meta-pill" title="Notas Tabla"><span class="material-icons" style="font-size:0.9rem">description</span> ${info.Notas}</div>` : ''}
                ${extraPills}
            </div>

            ${customJSONHtml}

            <div style="margin-top:10px; margin-bottom:15px;">
                <label style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-bottom:4px;">Estado:</label>
                <div class="premium-select-wrapper">
                    <select class="premium-select" style="width:100%" onchange="handleUpdateLogistica('${id}', this.value, this)">
                        ${estadoOpciones.filter(opt => opt !== 'En Uso').map(opt => `<option value="${opt}" ${opt === currentEstado ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                    <span class="material-icons select-chevron">expand_more</span>
                </div>
            </div>

            <details class="premium-details mini">
                <summary>
                    <span class="material-icons chevron">expand_more</span>
                    <span class="material-icons" style="font-size:1rem; color:var(--accent-cyan)">chat</span>
                    ${lastNote ? `<span style="font-size:0.75rem"><b>${formatRelativeDate(lastNote.timestamp)}</b> ${lastNote.detalle}</span>` : '<span style="font-size:0.75rem; color:var(--text-secondary)">Sin notas</span>'}
                </summary>
                <div class="details-content notes-list">
                    <div class="add-note-box">
                        <textarea id="note_input_${id}" placeholder="Escribe una nota..."></textarea>
                        <button class="action-btn btn-primary btn-mini" onclick="addNote('${id}')">Agregar nota</button>
                    </div>
                    ${meta.notas ? meta.notas.slice().reverse().map(n => `
                        <div class="trace-entry">
                            <span class="trace-date">${formatRelativeDate(n.timestamp)}</span>
                            <span class="trace-user">${n.nombre}:</span>
                            <span class="trace-detail">${n.detalle}</span>
                        </div>
                    `).join('') : ''}
                </div>
            </details>

            <details class="premium-details mini">
                <summary>
                    <span class="material-icons chevron">expand_more</span>
                    <span class="material-icons" style="font-size:1rem; color:var(--accent-cyan)">history</span>
                    ${lastMove ? `<span style="font-size:0.75rem"><b>${formatRelativeDate(lastMove.timestamp)}</b> ${lastMove.detalle}</span>` : '<span style="font-size:0.75rem; color:var(--text-secondary)">Sin movimientos</span>'}
                </summary>
                <div class="details-content history-list">
                    ${meta.historial ? meta.historial.slice().reverse().map(h => `
                        <div class="trace-entry">
                            <span class="trace-date">${formatRelativeDate(h.timestamp)}</span>
                            <span class="trace-user">${h.nombre}:</span>
                            <span class="trace-detail">${h.detalle}</span>
                        </div>
                    `).join('') : ''}
                </div>
            </details>

            <div class="port-list-container">
                <div class="port-column">
                    <h4>Entradas</h4>
                    ${inputs.map(c => renderPortListEntry(c, 'in')).join('')}
                </div>
                <div class="port-column">
                    <h4>Salidas</h4>
                    ${outputs.map(c => renderPortListEntry(c, 'out')).join('')}
                </div>
            </div>
        `);
    } else {
        el.insertAdjacentHTML('beforeend', `
            <div style="display:flex; justify-content:space-between; align-items:center">
                <div style="cursor:pointer" onclick="renderResults('${id}')">
                    <span class="badge-id">${id}</span>
                    <div style="font-size:0.85rem; font-weight:600">${info?.Nombre || info?.Tipo || ''}</div>
                    <div class="node-metadata" style="font-size:0.7rem">${info?.Ubicacion || ''} | ${info?.Estado || ''}</div>
                </div>
                <span class="material-icons" style="color:var(--text-secondary)">${isCable ? 'cable' : 'speaker'}</span>
            </div>
        `);
    }

    return el;
}

function renderNestedJSON(obj, excludedKeys = []) {
    if (!obj || typeof obj !== 'object') return '';
    let html = '';
    for (const [key, val] of Object.entries(obj)) {
        if (excludedKeys.includes(key)) continue;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            html += `<div style="margin-top: 6px; padding-left: 10px; border-left: 2px solid #444;">
                        <strong style="color:var(--text-secondary); font-size:0.8rem; text-transform:capitalize;">${key}</strong>
                        ${renderNestedJSON(val)}
                     </div>`;
        } else if (Array.isArray(val)) {
            html += `<div style="margin-top: 6px; display:flex; gap:8px;">
                        <strong style="color:var(--text-secondary); font-size:0.8rem; text-transform:capitalize;">${key}:</strong> 
                        <span style="font-size:0.85rem; background:#111; padding:2px 6px; border-radius:4px; font-family:monospace;">[ ${val.join(', ')} ]</span>
                     </div>`;
        } else {
            html += `<div style="margin-top: 6px; display:flex; gap:8px;">
                        <strong style="color:var(--text-secondary); font-size:0.8rem; text-transform:capitalize;">${key}:</strong> 
                        <span style="font-size:0.85rem;">${val}</span>
                     </div>`;
        }
    }
    return html;
}

function renderPortListEntry(conn, type) {
    const isConn = conn.Estado === 'Conectado';
    const targetId = type === 'in' ? conn.ID_Origen : conn.ID_Destino;
    const port = type === 'in' ? conn.Puerto_Destino : conn.Puerto_Origen;
    const targetInfo = getItemById(targetId);
    const targetName = targetInfo?.Nombre || targetInfo?.Tipo || targetId;

    return `
        <div class="port-entry ${isConn ? 'connected' : 'disconnected'}" onclick="renderResults('${targetId}')">
            <span class="material-icons" style="font-size:0.8rem">${type === 'in' ? 'login' : 'logout'}</span>
            <div style="flex:1; overflow:hidden">
                <div class="port-name">${port}</div>
                <div class="port-target">→ ${targetName}</div>
            </div>
            <label class="premium-checkbox" onclick="event.stopPropagation()">
                <input type="checkbox" id="chk_${conn.ID_Patch}" ${isConn ? 'checked' : ''} 
                       onchange="togglePatch('${conn.ID_Patch}', this)">
                <span class="checkmark"></span>
            </label>
        </div>
    `;
}

function renderPortSelect(nodeId, conns, direction) {
    const sel = document.createElement('select');
    const currentChoice = selectedBranches[`${nodeId}_${direction}`];
    const actualChoice = currentChoice || (direction === 'forward' ? conns[0].ID_Destino : conns[0].ID_Origen);
    
    sel.innerHTML = conns.map(c => {
        const targetId = direction === 'forward' ? c.ID_Destino : c.ID_Origen;
        const port = direction === 'forward' ? c.Puerto_Origen : c.Puerto_Destino;
        return `<option value="${targetId}" ${targetId === actualChoice ? 'selected' : ''}>${port} → ${targetId}</option>`;
    }).join('');

    sel.onchange = (e) => {
        selectedBranches[`${nodeId}_${direction}`] = e.target.value;
        const centralId = document.querySelector('.tree-node.central .badge-id').innerText;
        renderTree(centralId);
    };
    return sel;
}

function renderTreeConnection(conn, direction) {
    const isConnected = conn.Estado === 'Conectado';
    const el = document.createElement('div');
    el.className = 'connection-jump';
    el.innerHTML = `
        <div class="arrow-line ${isConnected ? 'connected' : 'disconnected'}" 
             style="cursor:pointer" title="Ver detalles de conexión" 
             onclick="showConnectionModal('${conn.ID_Patch}')">
            <div class="signal-pill">${conn.Tipo_Senial}</div>
        </div>
    `;
    return el;
}

function showConnectionModal(idPatch) {
    const conn = db.conexiones.find(c => String(c.ID_Patch) === String(idPatch));
    if (!conn) return;

    let meta = { historial: [], notas: [] };
    try { 
        if (conn.Metadatos) {
            const parsed = JSON.parse(conn.Metadatos);
            meta = { 
                historial: Array.isArray(parsed.historial) ? parsed.historial : [],
                notas: Array.isArray(parsed.notas) ? parsed.notas : []
            };
        }
    } catch(e){}

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'connectionModal';
    overlay.style.display = 'flex';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const lastNote = meta.notas.length > 0 ? meta.notas[meta.notas.length-1] : null;
    const lastMove = meta.historial.length > 0 ? meta.historial[meta.historial.length-1] : null;

    overlay.innerHTML = `
        <div class="tree-node central" style="width:100%; max-width:400px; padding:1.5rem; position:relative; box-shadow: 0 10px 40px rgba(0,0,0,0.8); animation: fadeInUp 0.3s ease-out;">
            <button class="close-ficha-btn" onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
            
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px; padding-right:30px;">
                <span class="material-icons" style="color:var(--accent-cyan); font-size:1.5rem;">settings_input_component</span>
                <h2 style="margin:0; font-size:1.1rem; line-height:1.2">Detalles de conexión</h2>
                <span class="badge-id" style="font-size:0.75rem; padding:0.3rem 0.6rem;">${idPatch}</span>
            </div>

            <div class="compact-meta" style="margin-bottom:1rem">
                <div class="meta-pill" title="Ver origen" style="cursor:pointer" onclick="this.closest('.modal-overlay').remove(); renderResults('${conn.ID_Origen}')">
                    <span class="material-icons" style="font-size:0.9rem">login</span> ${conn.ID_Origen} (${conn.Puerto_Origen})
                </div>
                <div class="meta-pill" title="Ver destino" style="cursor:pointer" onclick="this.closest('.modal-overlay').remove(); renderResults('${conn.ID_Destino}')">
                    <span class="material-icons" style="font-size:0.9rem">logout</span> ${conn.ID_Destino} (${conn.Puerto_Destino})
                </div>
                <div class="meta-pill" title="Señal"><span class="material-icons" style="font-size:0.9rem">wifi_tethering</span> ${conn.Tipo_Senial}</div>
                ${conn.Notas ? `<div class="meta-pill" title="Notas"><span class="material-icons" style="font-size:0.9rem">description</span> ${conn.Notas}</div>` : ''}
            </div>

            <div style="margin-bottom:1rem; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="material-icons" style="color:var(--accent-cyan); font-size:1.2rem">info</span>
                    <span style="font-size:0.9rem; font-weight:600">${conn.Estado}</span>
                </div>
                <label class="premium-checkbox">
                    <input type="checkbox" ${conn.Estado === 'Conectado' ? 'checked' : ''} 
                           onchange="togglePatch('${idPatch}', this)">
                    <span class="checkmark"></span>
                </label>
            </div>

            <details class="premium-details mini">
                <summary>
                    <span class="material-icons chevron">expand_more</span>
                    <span class="material-icons" style="font-size:1rem; color:var(--accent-cyan)">chat</span>
                    ${lastNote ? `<span style="font-size:0.75rem"><b>${formatRelativeDate(lastNote.timestamp)}</b> ${lastNote.detalle}</span>` : '<span style="font-size:0.75rem; color:var(--text-secondary)">Sin notas</span>'}
                </summary>
                <div class="details-content notes-list">
                    <div class="add-note-box">
                        <textarea id="conn_note_input_${idPatch}" placeholder="Escribe una nota..."></textarea>
                        <button class="action-btn btn-primary btn-mini" onclick="addConnectionNote('${idPatch}')">Agregar nota</button>
                    </div>
                    ${meta.notas.slice().reverse().map(n => `
                        <div class="trace-entry">
                            <span class="trace-date">${formatRelativeDate(n.timestamp)}</span>
                            <span class="trace-user">${n.nombre}:</span>
                            <span class="trace-detail">${n.detalle}</span>
                        </div>
                    `).join('')}
                </div>
            </details>

            <details class="premium-details mini">
                <summary>
                    <span class="material-icons chevron">expand_more</span>
                    <span class="material-icons" style="font-size:1rem; color:var(--accent-cyan)">history</span>
                    ${lastMove ? `<span style="font-size:0.75rem"><b>${formatRelativeDate(lastMove.timestamp)}</b> ${lastMove.detalle}</span>` : '<span style="font-size:0.75rem; color:var(--text-secondary)">Sin movimientos</span>'}
                </summary>
                <div class="details-content history-list">
                    ${meta.historial.slice().reverse().map(h => `
                        <div class="trace-entry">
                            <span class="trace-date">${formatRelativeDate(h.timestamp)}</span>
                            <span class="trace-user">${h.nombre}:</span>
                            <span class="trace-detail">${h.detalle}</span>
                        </div>
                    `).join('')}
                </div>
            </details>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function addConnectionNote(idPatch) {
    const input = document.getElementById(`conn_note_input_${idPatch}`);
    const detail = input.value.trim();
    if (!detail) return;

    const btn = input.nextElementSibling;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span>';

    try {
        await logActivity(idPatch, 'NOTE', detail);
        input.value = '';
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.remove();
            showConnectionModal(idPatch);
        }
    } catch (e) {
        console.error("Failed to add connection note:", e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

async function togglePatch(idPatch, checkboxEl) {
    console.log('Toggling patch:', idPatch);
    const conn = db.conexiones.find(c => String(c.ID_Patch) === String(idPatch));
    if (!conn) return;

    let spinner;
    if (checkboxEl) {
        checkboxEl.disabled = true;
        const entryDiv = checkboxEl.closest('.port-entry');
        if (entryDiv) {
            entryDiv.style.opacity = '0.5';
            spinner = document.createElement('span');
            spinner.className = 'spinner spinner-sm';
            spinner.style.marginLeft = '10px';
            checkboxEl.parentElement.appendChild(spinner);
        }
    }

    const newState = conn.Estado === 'Conectado' ? 'Desconectado' : 'Conectado';

    try {
        await handleAction('UPDATE_PATCH', { id: idPatch, value: newState });
        await logActivity(idPatch, 'MOVE', newState);
        
        // Refresh UI
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.remove();
            showConnectionModal(idPatch);
        }

        const centralNode = document.querySelector('.tree-node.central .badge-id');
        if (centralNode) {
            renderTree(centralNode.innerText);
        } else {
            if (searchInput.value) renderResults(searchInput.value, false);
            else renderInventory();
        }
    } catch (e) {
        console.error('Critical failure in togglePatch:', e);
        if (checkboxEl) {
            checkboxEl.disabled = false;
            checkboxEl.checked = !checkboxEl.checked;
        }
    } finally {
        if (spinner && spinner.parentElement) {
            spinner.remove();
        }
    }
}

/**
 * 3.1 Funciones de Administración
 */
function showAdminTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // Reset form
    if (adminFormContainer) adminFormContainer.style.display = 'none';
    if (formContainerInner) formContainerInner.innerHTML = '';
    
    const type = tabId === 'tabEquipo' ? 'equipos' : (tabId === 'tabCable' ? 'cables' : 'conexiones');
    renderAdminTable(type);
    updateSelects();
}

function renderAdminTable(type) {
    currentSort.type = type;
    const data = [...db[type]];
    
    // Default sort by specific keys requested by USER if no column selected
    if (!currentSort.column) {
        const sortKey = type === 'equipos' ? 'Nombre' : (type === 'cables' ? 'Tipo' : 'ID_Patch');
        data.sort((a, b) => String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), undefined, {numeric: true, sensitivity: 'base'}));
    } else {
        data.sort((a, b) => {
            const valA = String(a[currentSort.column]).toLowerCase();
            const valB = String(b[currentSort.column]).toLowerCase();
            return currentSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
    }

    const headers = {
        equipos: ['ID_Equipo', 'Nombre', 'Categoria', 'Ubicacion', 'Estado'],
        cables: ['ID_Cable', 'Tipo', 'Largo', 'Ubicacion', 'Categoria', 'Estado'],
        conexiones: ['ID_Patch', 'ID_Origen', 'Puerto_Origen', 'ID_Destino', 'Puerto_Destino', 'Estado']
    };

    adminTableHead.innerHTML = `<tr>${headers[type].map(h => `<th onclick="sortTable('${h}')">${h}</th>`).join('')}<th>Acciones</th></tr>`;
    
    adminTableBody.innerHTML = data.map(row => `
        <tr>
            ${headers[type].map(h => `<td>${row[h] || '-'}</td>`).join('')}
            <td style="white-space: nowrap;">
                ${type !== 'conexiones' ? `
                <button class="action-btn btn-warning" style="padding:4px 8px; font-size:0.7rem" 
                        onclick="editItem('${type}', '${row[idKey]}')" title="Editar">
                    <span class="material-icons" style="font-size:1rem">edit</span>
                </button>
                <button class="action-btn" style="padding:4px 8px; font-size:0.7rem; background:var(--accent-purple); color:white; border:none;" 
                        onclick="openBatchPatch('${type}', '${row[idKey]}')" title="Gestionar conexiones">
                    <span class="material-icons" style="font-size:1rem">hub</span>
                </button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

function sortTable(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    renderAdminTable(currentSort.type);
}

function toggleAdminForm(type) {
    updateSelects();
    let formId = 'formEquipo';
    if (type === 'cables') formId = 'formCable';
    if (type === 'conexiones') formId = 'formRuteo';
    
    const form = document.getElementById(formId).cloneNode(true);
    form.style.display = 'grid';
    form.id = 'activeAdminForm';

    const idInput = form.querySelector('[name="id"]') || form.querySelector('[name="id_patch"]');
    if (idInput) {
        idInput.addEventListener('input', () => {
            idInput.dataset.auto = 'false';
        });
    }
    
    // Reset to "New" mode
    form.querySelector('[name="isEdit"]').value = 'false';
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerText = "Guardar nuevo";
    
    formContainerInner.innerHTML = `
        <div class="form-header-ficha">
            <h2>${type === 'equipos' ? 'Nuevo equipo' : (type === 'cables' ? 'Nuevo cable' : 'Nueva conexión')}</h2>
        </div>
    `;
    formContainerInner.appendChild(form);
    document.getElementById('adminModal').style.display = 'flex';
    
    // Limpiar campos específicos del ruteo multi-patch
    if (type === 'conexiones') {
        form.querySelector('#main_id_input').value = '';
        form.querySelector('#main_selector_label').innerText = 'Seleccionar equipo...';
        form.querySelector('#container_entradas').innerHTML = '';
        form.querySelector('#container_salidas').innerHTML = '';
    }

    // Reset Metadata
    const editor = form.querySelector('.metadata-json-editor');
    if (editor) editor.value = '';
    const manualsContainer = form.querySelector('.manuals-container');
    if (manualsContainer) manualsContainer.innerHTML = '';
    const montadoInput = form.querySelector('.montado-input');
    if (montadoInput) montadoInput.value = '';

    // Re-vincular listeners de Auto-ID
    if (type === 'equipos') {
        const catIn = form.querySelector('[name="categoria"]');
        const ubiIn = form.querySelector('[name="ubicacion"]');
        const nomIn = form.querySelector('[name="nombre"]');
        [catIn, ubiIn, nomIn].forEach(el => el?.addEventListener('input', () => autoGenerateId('equipo', form)));
    } else if (type === 'cables') {
        const tipIn = form.querySelector('[name="tipo"]');
        tipIn?.addEventListener('input', () => autoGenerateId('cable', form));
    }

    // Attach Auto-ID listeners...

    // Re-attach listener
    form.addEventListener('submit', (e) => handleFormSubmit(e, formId));
}

function closeAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
    formContainerInner.innerHTML = '';
}

function editItem(type, id) {
    updateSelects();
    const isEdit = true;
    console.log('editItem triggered:', type, id);
    const item = db[type].find(i => {
        const itemId = String(i.ID_Equipo || i.ID_Cable || i.ID_Patch || '');
        return itemId === String(id);
    });
    if (!item) {
        console.error('Item not found in db[' + type + '] with ID:', id);
        return;
    }

    // Redirigir edición de conexiones al editor por lotes del equipo origen
    if (type === 'conexiones') {
        openBatchPatch('equipos', item.ID_Origen);
        return;
    }

    const formId = type === 'equipos' ? 'formEquipo' : (type === 'cables' ? 'formCable' : 'formRuteo');
    const form = document.getElementById(formId).cloneNode(true);
    form.style.display = 'grid';
    form.id = 'activeAdminForm';
    
    // Fill data
    form.querySelector('[name="isEdit"]').value = 'true';
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerText = "Actualizar";
    submitBtn.classList.replace('btn-primary', 'btn-warning');

    // Diccionario Inverso (form name -> DB key)
    const reverseMap = {
        'id': type === 'equipos' ? 'ID_Equipo' : 'ID_Cable',
        'nombre': 'Nombre',
        'categoria': 'Categoria',
        'ubicacion': 'Ubicacion',
        'propietario': 'Propietario',
        'contenedor': 'Contenedor',
        'notas': 'Notas',
        'tipo': 'Tipo',
        'largo': 'Largo',
        'id_patch': 'ID_Patch',
        'id_origen': 'ID_Origen',
        'puerto_origen': 'Puerto_Origen',
        'id_destino': 'ID_Destino',
        'puerto_destino': 'Puerto_Destino',
        'tipo_senial': 'Tipo_Senial'
    };

    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        const dbKey = reverseMap[input.name];
        if (dbKey && item[dbKey] !== undefined) {
            input.value = item[dbKey];
        }
        if (input.name === 'id' || input.name === 'id_patch') {
            input.readOnly = isEdit; // Permitir edición si es nuevo
            if (!isEdit) {
                input.addEventListener('input', () => {
                    input.dataset.auto = 'false';
                });
            }
        }
    });

    // Configurar acceso rápido a ruteo si es equipo o cable en edición
    if (isEdit && (type === 'equipos' || type === 'cables')) {
        const quickBox = form.querySelector('#quickActionRuteo') || form.querySelector('#quickActionRuteoCable');
        const quickBtn = form.querySelector('#btnGoToRuteo_E') || form.querySelector('#btnGoToRuteo_C');
        if (quickBox && quickBtn) {
            quickBox.style.display = 'flex';
            quickBtn.onclick = () => {
                closeAdminModal();
                openBatchPatch(type, id);
            };
        }
    }

    // Cargar Metadatos
    const editor = form.querySelector('.metadata-json-editor');
    if (editor) {
        let metaObj = {};
        if (item.Metadatos) {
            try { metaObj = JSON.parse(item.Metadatos); } catch(e){}
        }
        if (Object.keys(metaObj).length > 0) {
            editor.value = JSON.stringify(metaObj, null, 2);
            syncUIFromMetadata(form, metaObj);
        } else {
            editor.value = '';
        }
    }

    formContainerInner.innerHTML = '';
    formContainerInner.appendChild(form);
    document.getElementById('adminModal').style.display = 'flex';

    form.addEventListener('submit', (e) => handleFormSubmit(e, formId));
}

// === Metadata UI Sync Functions ===
function addManualRow(btn) {
    const container = btn.closest('.metadata-section').querySelector('.manuals-container');
    const row = document.createElement('div');
    row.className = 'manual-entry-card';
    row.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:10px; background:var(--surface-2); border:1px solid #30363d; border-radius:8px; margin-bottom:8px;';
    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem; color:var(--accent-cyan); font-weight:600; display:flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:1rem;">menu_book</span> Documento / Enlace</span>
            <button type="button" class="icon-btn" style="color:var(--danger); padding:2px;" onclick="this.closest('.manual-entry-card').remove(); syncMetadataFromUI(document.getElementById('activeAdminForm'))" title="Eliminar"><span class="material-icons" style="font-size:1.2rem;">delete</span></button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid #444; border-radius:6px; overflow:hidden;">
                <span class="material-icons" style="padding:6px 8px; color:#888; font-size:1.1rem; background:#111; border-right:1px solid #444;">title</span>
                <input type="text" placeholder="Ej: Manual de Usuario" style="flex:1; border:none; background:transparent; color:#fff; padding:8px; outline:none; font-size:0.85rem;" oninput="syncMetadataFromUI(this)">
            </div>
            <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid #444; border-radius:6px; overflow:hidden;">
                <span class="material-icons" style="padding:6px 8px; color:#888; font-size:1.1rem; background:#111; border-right:1px solid #444;">link</span>
                <input type="url" placeholder="https://..." style="flex:1; border:none; background:transparent; color:#fff; padding:8px; outline:none; font-size:0.85rem;" oninput="syncMetadataFromUI(this)">
            </div>
        </div>
    `;
    container.appendChild(row);
}

function syncMetadataFromUI(context) {
    const section = context.closest ? context.closest('.metadata-section') : context.querySelector('.metadata-section');
    if (!section) return;
    const editor = section.querySelector('.metadata-json-editor');
    if (!editor) return;

    let meta = {};
    try {
        if (editor.value.trim()) meta = JSON.parse(editor.value);
    } catch(e) {}

    // Montado en
    const montadoInput = section.querySelector('.montado-input');
    if (montadoInput) {
        if (montadoInput.value.trim()) {
            meta.montado_en = montadoInput.value.trim();
        } else {
            delete meta.montado_en;
        }
    }

    // Manuales
    const manualRows = section.querySelectorAll('.manuals-container > div');
    const manuales = [];
    manualRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const nombre = inputs[0].value.trim();
        const url = inputs[1].value.trim();
        if (nombre || url) manuales.push({ nombre, url });
    });

    if (manuales.length > 0) {
        meta.manuales = manuales;
    } else {
        delete meta.manuales;
    }

    if (Object.keys(meta).length > 0) {
        editor.value = JSON.stringify(meta, null, 2);
    } else {
        editor.value = '';
    }
    editor.style.borderColor = '#30363d';
}

function syncUIFromMetadata(form, jsonObj) {
    const section = form.querySelector('.metadata-section');
    if (!section) return;

    // Montado en
    const montadoInput = section.querySelector('.montado-input');
    if (montadoInput) {
        montadoInput.value = jsonObj.montado_en || '';
    }

    // Manuales
    const container = section.querySelector('.manuals-container');
    container.innerHTML = '';
    if (Array.isArray(jsonObj.manuales)) {
        jsonObj.manuales.forEach(m => {
            const row = document.createElement('div');
            row.className = 'manual-entry-card';
            row.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:10px; background:var(--surface-2); border:1px solid #30363d; border-radius:8px; margin-bottom:8px;';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; color:var(--accent-cyan); font-weight:600; display:flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:1rem;">menu_book</span> Documento / Enlace</span>
                    <button type="button" class="icon-btn" style="color:var(--danger); padding:2px;" onclick="this.closest('.manual-entry-card').remove(); syncMetadataFromUI(document.getElementById('activeAdminForm'))" title="Eliminar"><span class="material-icons" style="font-size:1.2rem;">delete</span></button>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid #444; border-radius:6px; overflow:hidden;">
                        <span class="material-icons" style="padding:6px 8px; color:#888; font-size:1.1rem; background:#111; border-right:1px solid #444;">title</span>
                        <input type="text" placeholder="Ej: Manual de Usuario" value="${m.nombre || ''}" style="flex:1; border:none; background:transparent; color:#fff; padding:8px; outline:none; font-size:0.85rem;" oninput="syncMetadataFromUI(this)">
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid #444; border-radius:6px; overflow:hidden;">
                        <span class="material-icons" style="padding:6px 8px; color:#888; font-size:1.1rem; background:#111; border-right:1px solid #444;">link</span>
                        <input type="url" placeholder="https://..." value="${m.url || ''}" style="flex:1; border:none; background:transparent; color:#fff; padding:8px; outline:none; font-size:0.85rem;" oninput="syncMetadataFromUI(this)">
                    </div>
                </div>
            `;
            container.appendChild(row);
        });
    }
}

function validateAndFormatJSON(textarea) {
    if (!textarea.value.trim()) {
        textarea.style.borderColor = '#30363d';
        return;
    }
    try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(parsed, null, 2);
        textarea.style.borderColor = '#30363d';
        syncUIFromMetadata(textarea.closest('form'), parsed);
    } catch (e) {
        textarea.style.borderColor = 'red';
    }
}

async function handleFormSubmit(e, formId) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;

    if (formId === 'formRuteo') {
        const mainId = form.querySelector('#main_id_input').value;
        if (!mainId) { showToast("Selecciona el equipo principal", 'warning'); return; }
        
        const inputs = Array.from(form.querySelectorAll('#container_entradas .patch-block'));
        const outputs = Array.from(form.querySelectorAll('#container_salidas .patch-block'));
        const currentBatchIds = Array.from(form.querySelectorAll('.p-id')).map(el => el.value).filter(Boolean);

        // Parse global metadata
        let globalMetaStr = undefined;
        const editor = form.querySelector('.metadata-json-editor');
        if (editor && editor.value.trim()) {
            try {
                globalMetaStr = JSON.stringify(JSON.parse(editor.value));
            } catch(e) {
                showToast("Error en Metadatos JSON: " + e.message, 'error', 5000);
                return;
            }
        } else if (editor) {
            globalMetaStr = '';
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Guardando...';

        try {
            // 1. Procesar Borrados: IDs que estaban al inicio pero ya no están en el form
            const idsToDelete = originalBatchIds.filter(id => !currentBatchIds.includes(id));
            for (const idPatch of idsToDelete) {
                await handleAction('DELETE_CONEXION', { id_patch: idPatch });
                await logActivity(idPatch, 'DELETE', 'Conexión eliminada vía Batch Editor');
            }

            // 2. Procesar Entradas y Salidas (ADD o EDIT)
            const allBlocks = [...inputs.map(b => ({b, dir: 'in'})), ...outputs.map(b => ({b, dir: 'out'}))];
            
            for (const {b, dir} of allBlocks) {
                const secId = b.querySelector('.sel-id').value;
                if (!secId) continue;

                const idP = b.querySelector('.p-id').value || (dir === 'in' ? `${secId}/${mainId}` : `${mainId}/${secId}`);
                const payload = {
                    id_patch: idP,
                    id_origen: dir === 'in' ? secId : mainId,
                    puerto_origen: b.querySelector('.p-ori').value,
                    id_destino: dir === 'in' ? mainId : secId,
                    puerto_destino: b.querySelector('.p-des').value,
                    tipo_senial: b.querySelector('.p-signal').value,
                    notas: b.querySelector('.p-notes').value,
                    estado: 'Desconectado'
                };
                
                if (globalMetaStr !== undefined) {
                    payload.metadatos = globalMetaStr;
                }

                // Decidir si es ADD o EDIT basado en si el ID ya existía en la DB original
                const exists = originalBatchIds.includes(idP) || db.conexiones.some(c => String(c.ID_Patch) === String(idP));
                const action = exists ? 'EDIT_CONEXION' : 'ADD_CONEXION';
                payload.isEdit = exists ? 'true' : 'false';

                await handleAction(action, payload);
            }

            showToast("Cambios guardados con éxito", 'success');
            closeAdminModal();
            fetchData();
            return;
        } catch (err) {
            console.error("Error en ruteo por lotes:", err);
            showToast("Ocurrió un error al guardar.", 'error', 5000);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
        return;
    }

    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    const isEdit = body.isEdit === 'true';

    // Parse metadatos_raw if present
    if (body.metadatos_raw !== undefined) {
        if (body.metadatos_raw.trim()) {
            try {
                const parsed = JSON.parse(body.metadatos_raw);
                body.metadatos = JSON.stringify(parsed);
            } catch (e) {
                showToast("Error en Metadatos JSON: " + e.message, 'error', 5000);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
                return;
            }
        } else {
            body.metadatos = '';
        }
        delete body.metadatos_raw;
    }

    let action = '';
    if (formId === 'formEquipo') {
        action = isEdit ? 'EDIT_EQUIPO' : 'ADD_EQUIPO';
        if (!isEdit && !body.estado) body.estado = 'Guardado';
    }
    if (formId === 'formCable') {
        action = isEdit ? 'EDIT_CABLE' : 'ADD_CABLE';
        if (!isEdit && !body.estado) body.estado = 'Guardado';
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-btn"></span> Guardando...`;

    try {
        const success = await handleAction(action, body);
        if (success) {
            closeAdminModal();
            fetchData();
        }
    } catch (e) {
        console.error("Error al guardar:", e);
        showToast("No se pudo completar la operación.", 'error', 5000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
    }
}

async function handleUpdateLogisticaOld(id, value) {
    // Deleted duplicate
}

async function handleAction(action, body) {
    const originalText = "Busca ID o nombre...";
    searchInput.placeholder = "Sincronizando...";
    
    // Actualización optimista del estado local
    if (action.startsWith('ADD_')) {
        const type = action.includes('EQUIPO') ? 'equipos' : (action.includes('CABLE') ? 'cables' : 'conexiones');
        const entry = mapToDb(body, type);
        db[type].push(entry);
    } else if (action.startsWith('EDIT_')) {
        const type = action.includes('EQUIPO') ? 'equipos' : (action.includes('CABLE') ? 'cables' : 'conexiones');
        const idKey = type === 'equipos' ? 'ID_Equipo' : (type === 'cables' ? 'ID_Cable' : 'ID_Patch');
        const idVal = body.id || body.id_patch;
        const index = db[type].findIndex(i => String(i[idKey]) === String(idVal));
        if (index !== -1) {
            const entry = mapToDb(body, type);
            db[type][index] = { ...db[type][index], ...entry };
        }
    } else if (action === 'UPDATE_LOGISTICA') {
        const item = getItemById(body.id);
        if (item) item.Estado = body.value;
    } else if (action === 'UPDATE_PATCH') {
        const conn = db.conexiones.find(c => String(c.ID_Patch) === String(body.id));
        if (conn) conn.Estado = body.value;
    } else if (action === 'UPDATE_METADATOS') {
        const item = getItemById(body.id) || db.conexiones.find(c => String(c.ID_Patch) === String(body.id));
        if (item) item.Metadatos = body.value;
    }

    localStorage.setItem('av_tech_db', JSON.stringify(db));

    if (navigator.onLine) {
        try {
            await sendToServer(action, body);
            searchInput.placeholder = "¡Guardado!";
            setTimeout(() => {
                if (searchInput.placeholder === "¡Guardado!") {
                    searchInput.placeholder = originalText;
                }
            }, 2000);
            return true;
        } catch (e) {
            console.error("Fetch failed in handleAction, queueing offline:", e);
            queueAction({ action, body });
        }
    } else {
        console.warn("Navigator offline, queueing action:", action);
        queueAction({ action, body });
    }
    
    searchInput.placeholder = originalText;
    return true;
}


async function sendToServer(action, body) {
    if (!API_URL) {
        console.error("API_URL is empty! Action:", action);
        return;
    }
    console.log("FETCHing:", API_URL, "Action:", action);
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...body })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const res = await response.json();
    console.log("SERVER RESPONSE:", res);
    return res;
}

async function handleUpdateLogistica(id, newState, selectEl) {
    const item = getItemById(id);
    if (!item) return;

    if (selectEl) selectEl.disabled = true;
    const oldState = item.Estado || 'Desconocido';

    try {
        await handleAction('UPDATE_LOGISTICA', { id: id, value: newState });
        await logActivity(id, 'MOVE', newState);
        renderTree(id);
    } catch (e) {
        console.error("Logistica update failed:", e);
    } finally {
        if (selectEl) selectEl.disabled = false;
    }
}

async function addNote(id) {
    const input = document.getElementById(`note_input_${id}`);
    const detail = input.value.trim();
    if (!detail) return;

    const btn = input.nextElementSibling;
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span>';

    try {
        await logActivity(id, 'NOTE', detail);
        input.value = '';
        renderTree(id);
    } catch (e) {
        console.error("Failed to add note:", e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

function updateSelects() {
    const selOrigen = document.getElementById('selectOrigen');
    const selDestino = document.getElementById('selectDestino');
    
    const options = [...db.equipos, ...db.cables]
        .sort((a, b) => {
            const idA = a.ID_Equipo || a.ID_Cable || '';
            const idB = b.ID_Equipo || b.ID_Cable || '';
            return idA.localeCompare(idB);
        })
        .map(item => {
            const id = item.ID_Equipo || item.ID_Cable;
            const nombre = item.Nombre || item.Tipo || '';
            const isCable = !!item.ID_Cable;
            const icon = isCable ? '🔌' : '🔊';
            const displayName = nombre ? `${icon} ${id} (${nombre})` : `${icon} ${id}`;
            return `<option value="${id}">${displayName}</option>`;
        }).join('');

    const placeholder = '<option value="">-- Seleccionar --</option>';
    if(selOrigen) selOrigen.innerHTML = placeholder + options;
    if(selDestino) selDestino.innerHTML = placeholder + options;
}

function populateDatalists() {
    const lists = {
        'list_categorias': new Set([...db.equipos, ...db.cables].map(i => i.Categoria)),
        'list_ubicaciones': new Set([...db.equipos, ...db.cables].map(i => i.Ubicacion)),
        'list_propietarios': new Set([...db.equipos, ...db.cables].map(i => i.Propietario)),
        'list_lugares': new Set([...db.equipos, ...db.cables].map(i => i.Contenedor)),
        'list_conectores': new Set(db.cables.map(c => c.Tipo)),
        'list_seniales': new Set(db.conexiones.map(c => c.Tipo_Senial)),
        'list_puertos': new Set([...db.conexiones.map(c => c.Puerto_Origen), ...db.conexiones.map(c => c.Puerto_Destino)])
    };

    for (const [id, values] of Object.entries(lists)) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.innerHTML = Array.from(values)
            .filter(v => v)
            .sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true, sensitivity: 'base'}))
            .map(v => `<option value="${v}">`)
            .join('');
    }
}

function autoGenerateId(formType, formEl) {
    if (!formEl) return;
    let prefix = '';
    if (formType === 'equipo') {
        const cat = formEl.querySelector('[name="categoria"]')?.value.trim().substring(0, 1).toUpperCase();
        const ubi = formEl.querySelector('[name="ubicacion"]')?.value.trim().substring(0, 3).toUpperCase();
        const nom = formEl.querySelector('[name="nombre"]')?.value.trim().toUpperCase().replace(/\s+/g, '').substring(0, 3);
        if (cat && ubi && nom) prefix = `${cat}-${ubi}-${nom}`;
    } else if (formType === 'cable') {
        const tip = formEl.querySelector('[name="tipo"]')?.value.trim().toUpperCase().replace(/\s+/g, '-');
        if (tip) prefix = `C-${tip}`;
    } else if (formType === 'conexion') {
        const ori = formEl.querySelector('[name="id_principal"]')?.value;
        // Si no hay id_principal, intentamos con los campos antiguos (para compatibilidad)
        const oldOri = formEl.querySelector('[name="id_origen"]')?.value;
        const oldDes = formEl.querySelector('[name="id_destino"]')?.value;
        if (ori) prefix = ori; // El prefijo base es el equipo principal
        else if (oldOri && oldDes) prefix = `${oldOri}/${oldDes}`;
    }

    if (!prefix) return;

    const collection = formType === 'equipo' ? db.equipos : (formType === 'cable' ? db.cables : db.conexiones);
    const idField = formType === 'equipo' ? 'ID_Equipo' : (formType === 'cable' ? 'ID_Cable' : 'ID_Patch');

    const existing = collection.filter(i => {
        const id = i[idField] || '';
        return id.startsWith(prefix);
    });
    
    let max = 0;
    let exactMatch = false;

    existing.forEach(i => {
        const id = i[idField];
        if (id === prefix) {
            exactMatch = true;
            return;
        }
        const numPart = id.substring(prefix.length);
        const num = parseInt(numPart);
        if (!isNaN(num) && num > max) max = num;
    });

    let newId = prefix;
    if (exactMatch || max > 0) {
        newId = `${prefix}${max + 1}`;
    }

    const targetInput = formEl.querySelector('[name="id"]') || formEl.querySelector('[name="id_patch"]');
    
    if (targetInput && (!targetInput.value || targetInput.dataset.auto === 'true')) {
        targetInput.value = newId;
        targetInput.dataset.auto = 'true';
    }
}





function queueAction(action) {
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    queue.push(action);
    localStorage.setItem('offline_queue', JSON.stringify(queue));
    showToast('Sin conexión. Se sincronizará al volver online.', 'warning', 4000);
}

async function syncQueue() {
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} actions...`);
    const failed = [];
    for (const action of queue) {
        try {
            await sendToServer(action.action, action.body);
        } catch (e) {
            console.error('Failed to sync action', action);
            failed.push(action);
        }
    }
    localStorage.setItem('offline_queue', JSON.stringify(failed));
    if (failed.length === 0) {
        showToast(`Sincronización completada (${queue.length}).`, 'success');
    } else {
        showToast(`Sincronización parcial: ${queue.length - failed.length} ok, ${failed.length} pendientes.`, 'warning', 5000);
    }
}

/**
 * 5. Event Listeners y Utilidades
 */
function setMode(mode, pushState = true, bypassWarning = false) {
    if (mode === 'ADMIN' && !bypassWarning) {
        const skipWarning = localStorage.getItem('skip_admin_warning') === 'true';
        if (!skipWarning) {
            document.getElementById('adminWarningModal').style.display = 'flex';
            return;
        }
    }
    currentMode = mode;
    const modeTitle = mode === 'OPERACION' ? 'Operación' : (mode === 'ADMIN' ? 'Administración' : 'Mapa');
    document.getElementById('activeModeDisplay').innerText = modeTitle;
    
    sideMenu.classList.remove('active');
    if (pushState) history.pushState({ mode }, '', `?mode=${mode}`);
    
    const mapView = document.getElementById('mapView');
    if (mode === 'MAPA') {
        document.querySelector('.search-container').style.display = 'none';
        resultsContainer.style.display = 'none';
        adminPanel.style.display = 'none';
        if (mapView) mapView.style.display = 'block';
        if (typeof renderMapTopology === 'function') renderMapTopology();
    } else if (mode === 'ADMIN') {
        if (mapView) mapView.style.display = 'none';
        document.querySelector('.search-container').style.display = 'none';
        resultsContainer.style.display = 'none';
        adminPanel.style.display = 'block';
        renderInventory(); // Mirror mode in adminInventoryContainer
    } else {
        if (mapView) mapView.style.display = 'none';
        document.querySelector('.search-container').style.display = 'none';
        adminPanel.style.display = 'none';
        resultsContainer.style.display = 'block';
        if (!searchInput.value) {
            renderInventory();
        } else {
            renderResults();
        }
    }
}

async function shareApp() {
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
        try {
            await navigator.clipboard.writeText(finalUrl);
            showToast('URL copiada al portapapeles', 'success');
        } catch (e) {
            await alertModal(finalUrl, 'Copia esta URL');
        }
    }
}

// Sidebar listeners
menuBtn.addEventListener('click', () => sideMenu.classList.add('active'));
activeModeDisplay.addEventListener('click', () => sideMenu.classList.add('active'));
closeMenuBtn.addEventListener('click', () => sideMenu.classList.remove('active'));
window.addEventListener('click', (e) => { if (e.target === sideMenu) sideMenu.classList.remove('active'); });

const qrModal = document.getElementById('qrModal');
const closeQrBtn = document.getElementById('closeQrBtn');

let isQrScanning = false;

qrStartBtn.addEventListener('click', async () => {
    qrModal.style.display = 'flex';
    
    // Si no existe la instancia, la creamos una sola vez
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    if (isQrScanning) return; // Ya está escaneando

    // Pequeño delay para asegurar que el modal tiene dimensiones reales en el DOM antes de que la cámara calcule su tamaño
    await new Promise(r => setTimeout(r, 500));

    const readerEl = document.getElementById('reader');
    console.log('QR DEBUG - reader dimensions:', readerEl.clientWidth, 'x', readerEl.clientHeight);
    console.log('QR DEBUG - reader offsetParent:', readerEl.offsetParent);
    console.log('QR DEBUG - reader computed display:', getComputedStyle(readerEl).display);
    console.log('QR DEBUG - modal computed display:', getComputedStyle(qrModal).display);
    console.log('QR DEBUG - reader parent width:', readerEl.parentElement.clientWidth);

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { 
                fps: 10, 
                qrbox: { width: 200, height: 200 }
            },
            (decodedText) => {
                // Al leer, detenemos la cámara de forma segura
                if (isQrScanning) {
                    isQrScanning = false;
                    html5QrCode.stop().then(() => {
                        qrModal.style.display = 'none';
                        searchInput.value = decodedText.trim();
                        if (searchContainer.style.display === 'none') {
                            searchContainer.style.display = 'flex';
                        }
                        renderResults(); // Dispara la búsqueda
                    }).catch(err => console.log("Error deteniendo QR:", err));
                }
            },
            (errorMessage) => { /* Ignore errors */ }
        );
        isQrScanning = true;
    } catch (err) {
        console.error('QR Critical failure:', err);
        showToast('No se pudo iniciar la cámara. Verificá permisos.', 'error', 5000);
        qrModal.style.display = 'none';
        isQrScanning = false;
    }
});

closeQrBtn.addEventListener('click', () => {
    if (html5QrCode && isQrScanning) {
        isQrScanning = false;
        html5QrCode.stop().then(() => {
            qrModal.style.display = 'none';
        }).catch(e => {
            console.log("QR Stop error", e);
            qrModal.style.display = 'none';
        });
    } else {
        qrModal.style.display = 'none';
    }
});

searchInput.addEventListener('input', debounce(() => renderResults(), 180));

window.addEventListener('online', () => {
    updateOfflineStatus();
    if (offlineIcon) offlineIcon.style.display = 'none';
    syncQueue();
});

window.addEventListener('offline', () => {
    updateOfflineStatus();
    if (offlineIcon) offlineIcon.style.display = 'inline-block';
});

function updateOfflineStatus() {
    if (navigator.onLine) {
        document.body.classList.remove('is-offline');
    } else {
        document.body.classList.add('is-offline');
    }
}

// Label Generation & Printing
async function preparePrintLabels(type, filterKey = null, filterVal = null) {
    const previewModal = document.getElementById('printPreviewModal');
    const container = document.getElementById('previewContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px;">Generando etiquetas...</div>';
    previewModal.style.display = 'flex';

    // Get items based on filter if provided
    let data = db[type];
    if (filterKey && filterVal !== null) {
        data = data.filter(item => (String(item[filterKey] || 'Sin Asignar')) === String(filterVal));
    }
    
    setTimeout(async () => {
        container.innerHTML = '';
        const printArea = document.getElementById('printArea');
        printArea.innerHTML = '';

        for (const item of data) {
            const id = item.ID_Equipo || item.ID_Cable || item.ID_Patch;
            let labelHtml = '';
            if (type === 'equipos') labelHtml = generateEquipoLabel(item);
            else if (type === 'cables') labelHtml = generateCableLabel(item);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'label-container';
            wrapper.innerHTML = labelHtml;
            container.appendChild(wrapper);

            // Print Area clone
            const printWrapper = wrapper.cloneNode(true);
            printArea.appendChild(printWrapper);

            // Generate QR for both preview and print clones
            const qrContainers = [
                ...Array.from(wrapper.querySelectorAll('.qr-canvas')),
                ...Array.from(printWrapper.querySelectorAll('.qr-canvas'))
            ];
            
            qrContainers.forEach(div => {
                new QRCode(div, {
                    text: id,
                    width: 128,
                    height: 128,
                    correctLevel: QRCode.CorrectLevel.L
                });
            });
        }

        document.getElementById('confirmPrintBtn').onclick = () => {
            window.print();
        };
    }, 100);
}

function generateEquipoLabel(item) {
    const notesHtml = item.Notas ? `<div class="notes-line">${item.Notas}</div>` : '';
    return `
        <div class="label-base label-equipo">
            <div class="qr-side">
                <div class="qr-canvas"></div>
                <div class="id-text">${item.ID_Equipo}</div>
            </div>
            <div class="data-side">
                <div class="title-bold">${item.Nombre || 'S/N'}</div>
                ${notesHtml}
                <div class="data-line"><span class="material-icons">category</span> ${item.Categoria || '-'}</div>
                <div class="data-line"><span class="material-icons">location_on</span> ${item.Ubicacion || '-'}</div>
                <div class="data-line"><span class="material-icons">inventory_2</span> ${item.Contenedor || '-'}</div>
                <div class="data-line"><span class="material-icons">person</span> ${item.Propietario || '-'}</div>
            </div>
        </div>
    `;
}

function generateCableLabel(item) {
    const notesHtml = item.Notas ? `<div class="notes-line">${item.Notas}</div>` : '';
    const dataHtml = `
        <div class="data-col">
            <div class="id-bold">${item.ID_Cable}</div>
            ${notesHtml}
            <div class="grid-data">
                <div class="data-line"><span class="material-icons">cable</span> ${item.Tipo || '-'}</div>
                <div class="data-line"><span class="material-icons">straighten</span> ${item.Largo || '-'}m</div>
                <div class="data-line"><span class="material-icons">category</span> ${item.Categoria || '-'}</div>
                <div class="data-line"><span class="material-icons">location_on</span> ${item.Ubicacion || '-'}</div>
                <div class="data-line"><span class="material-icons">inventory_2</span> ${item.Contenedor || '-'}</div>
                <div class="data-line"><span class="material-icons">person</span> ${item.Propietario || '-'}</div>
            </div>
        </div>
    `;
    const qrHtml = `<div class="qr-canvas"></div>`;

    return `
        <div class="label-base label-cable">
            <div class="zone">${qrHtml}${dataHtml}</div>
            <div class="pegado">┄ doblar ┄</div>
            <div class="zone">${dataHtml}${qrHtml}</div>
        </div>
    `;
}

window.addEventListener('afterprint', () => {
    document.getElementById('printArea').innerHTML = '';
});


// --- Lógica de Administración (PROMPT 18) ---

let currentSelectorTarget = null;

/**
 * Abre el selector avanzado de equipos/cables
 * @param {string|HTMLElement} target 'main' o el bloque de conexión secundaria
 */
function openSelector(target) {
    currentSelectorTarget = target;
    
    // Crear el modal si no existe
    let modal = document.getElementById('selectorModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'selector-modal';
        modal.id = 'selectorModal';
        document.body.appendChild(modal);
    }

    // Poblar filtros únicos
    const cats = new Set([...db.equipos, ...db.cables].map(i => i.Categoria).filter(Boolean));
    const tips = new Set([...db.equipos, ...db.cables].map(i => i.Tipo || i.Nombre).filter(Boolean));
    const ubis = new Set([...db.equipos, ...db.cables].map(i => i.Ubicacion).filter(Boolean));

    modal.innerHTML = `
        <div class="selector-content">
            <div class="form-header-ficha">
                <h2>Seleccionar equipo o cable</h2>
                <button class="icon-btn" onclick="closeSelector()"><span class="material-icons">close</span></button>
            </div>
            <div class="selector-filters">
                <input type="text" id="selectorSearch" placeholder="Buscar por ID o nombre..." 
                       style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); border-radius:8px; color:white;">
                <div class="filter-row">
                    <select id="selFilterCat" class="premium-select" style="font-size:0.8rem">
                        <option value="">Categoría...</option>
                        ${Array.from(cats).sort().map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                    <select id="selFilterTip" class="premium-select" style="font-size:0.8rem">
                        <option value="">Tipo...</option>
                        ${Array.from(tips).sort().map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                    <select id="selFilterUbi" class="premium-select" style="font-size:0.8rem">
                        <option value="">Ubicación...</option>
                        ${Array.from(ubis).sort().map(u => `<option value="${u}">${u}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="selector-results" id="selectorResults"></div>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    const searchIn = document.getElementById('selectorSearch');
    searchIn.focus();
    searchIn.addEventListener('input', updateSelectorResults);
    document.getElementById('selFilterCat').addEventListener('change', updateSelectorResults);
    document.getElementById('selFilterTip').addEventListener('change', updateSelectorResults);
    document.getElementById('selFilterUbi').addEventListener('change', updateSelectorResults);

    updateSelectorResults();
}

function closeSelector() {
    const modal = document.getElementById('selectorModal');
    if (modal) modal.style.display = 'none';
}

function updateSelectorResults() {
    const query = document.getElementById('selectorSearch').value.toLowerCase();
    const fCat = document.getElementById('selFilterCat').value;
    const fTip = document.getElementById('selFilterTip').value;
    const fUbi = document.getElementById('selFilterUbi').value;
    
    const results = [...db.equipos, ...db.cables]
        .filter(i => {
            const id = (i.ID_Equipo || i.ID_Cable || '').toLowerCase();
            const name = (i.Nombre || i.Tipo || '').toLowerCase();
            const matchesQuery = id.includes(query) || name.includes(query);
            const matchesCat = !fCat || i.Categoria === fCat;
            const matchesTip = !fTip || (i.Tipo === fTip || i.Nombre === fTip);
            const matchesUbi = !fUbi || i.Ubicacion === fUbi;
            return matchesQuery && matchesCat && matchesTip && matchesUbi;
        })
        .sort((a, b) => {
            const idA = a.ID_Equipo || a.ID_Cable || '';
            const idB = b.ID_Equipo || b.ID_Cable || '';
            return idA.localeCompare(idB);
        });

    const container = document.getElementById('selectorResults');
    container.innerHTML = results.length > 0 ? results.map(i => {
        const id = i.ID_Equipo || i.ID_Cable;
        const name = i.Nombre || i.Tipo || '';
        const icon = i.ID_Cable ? 'cable' : 'speaker';
        
        return `
            <div class="selector-item" data-id="${id}" data-name="${name}" onclick="selectItemFromEl(this)">
                <div class="item-id"><span class="material-icons" style="font-size:0.9rem; vertical-align:middle;">${icon}</span> ${id}</div>
                <div class="item-main">${name}</div>
                <div class="item-meta">${i.Categoria || '-'} | ${i.Ubicacion || '-'}</div>
            </div>
        `;
    }).join('') : '<div style="padding:20px; text-align:center; color:var(--text-secondary)">No hay resultados</div>';
}

function selectItemFromEl(el) {
    selectItem(el.dataset.id, el.dataset.name);
}

function selectItem(id, name) {
    if (currentSelectorTarget === 'main') {
        const input = document.getElementById('main_id_input');
        if (input) {
            input.value = id;
            input.dispatchEvent(new Event('input')); // Disparar auto-ID si corresponde
        }
        const label = document.getElementById('main_selector_label');
        if (label) label.innerText = `${id} (${name})`;
        
        // Trigger auto-ID for connections if in ruteo form
        const form = document.getElementById('activeAdminForm');
        if (form && form.id === 'activeAdminForm') { // Ya está como activeAdminForm
            // Actualizar todos los bloques vacíos de ID patch
            form.querySelectorAll('.patch-block').forEach(block => {
                updatePatchBlockId(block);
            });
        }
    } else {
        const trigger = currentSelectorTarget;
        const input = trigger.querySelector('.sel-id');
        if (input) input.value = id;
        const label = trigger.querySelector('.sel-label');
        if (label) label.innerText = `${id} (${name})`;
        
        // Trigger auto-ID for this specific block
        const block = trigger.closest('.patch-block');
        if (block) updatePatchBlockId(block);
    }
    closeSelector();
}

function updatePatchBlockId(block) {
    const mainId = document.getElementById('main_id_input')?.value;
    const secId = block.querySelector('.sel-id')?.value;
    const idInput = block.querySelector('.p-id');
    
    if (mainId && secId && idInput && (!idInput.value || idInput.dataset.auto !== 'false')) {
        const isInput = block.closest('#section_entradas');
        const baseId = isInput ? `${secId}/${mainId}` : `${mainId}/${secId}`;
        
        // Buscar duplicados locales y en DB
        let finalId = baseId;
        let counter = 1;
        const allPatchIds = [...db.conexiones.map(c => c.ID_Patch), ...Array.from(document.querySelectorAll('.p-id')).map(el => el.value).filter(v => v && v !== idInput.value)];
        
        while (allPatchIds.includes(finalId)) {
            finalId = `${baseId}-${counter}`;
            counter++;
        }
        idInput.value = finalId;
        idInput.dataset.auto = 'true';
        
        // Listener para detectar si el usuario escribe manualmente
        if (!idInput.oninput) {
            idInput.oninput = () => idInput.dataset.auto = 'false';
        }
    }
}

/**
 * Agrega una fila de conexión dinámica
 * @param {string} direction 'entradas' o 'salidas'
 */
function addPatchRow(direction) {
    const container = document.getElementById(`container_${direction}`);
    const template = document.getElementById('patchRowTemplate');
    if (!container || !template) return;

    const clone = template.content.cloneNode(true);
    container.appendChild(clone);
}

function togglePatchExtra(btn) {
    const block = btn.closest('.patch-block');
    const zone = block.querySelector('.patch-hidden-zone');
    if (!zone) return;

    zone.classList.toggle('active');
    btn.querySelector('.material-icons').innerText = zone.classList.contains('active') ? 'expand_less' : 'expand_more';
}

/**
 * Abre el gestor de ruteo pre-seleccionando un equipo y cargando sus conexiones
 */
function openBatchPatch(type, itemId) {
    const item = getItemById(itemId);
    if (!item) return;

    // Cambiar al tab de conexiones
    const tabBtn = document.querySelector('.tab-btn[onclick*="tabRuteo"]');
    showAdminTab('tabRuteo', tabBtn);
    
    // Abrir formulario
    toggleAdminForm('conexiones');
    
    // Pre-seleccionar el equipo principal
    currentSelectorTarget = 'main';
    selectItem(itemId, item.Nombre || item.Tipo || itemId);
    
    const form = document.getElementById('activeAdminForm');
    if (!form) return;

    // Marcar como edición para que el backend sepa que debe actualizar si existen
    form.querySelector('[name="isEdit"]').value = 'true';

    // Buscar conexiones existentes
    const entradas = db.conexiones.filter(c => String(c.ID_Destino) === String(itemId));
    const salidas = db.conexiones.filter(c => String(c.ID_Origen) === String(itemId));

    // Guardar IDs originales para detectar borrados al guardar
    originalBatchIds = [...entradas, ...salidas].map(c => String(c.ID_Patch));

    // Poblar Entradas
    entradas.forEach(conn => {
        addPatchRow('entradas');
        const lastBlock = form.querySelector('#container_entradas .patch-block:last-child');
        fillPatchBlock(lastBlock, conn, 'entrada');
    });

    // Poblar Salidas
    salidas.forEach(conn => {
        addPatchRow('salidas');
        const lastBlock = form.querySelector('#container_salidas .patch-block:last-child');
        fillPatchBlock(lastBlock, conn, 'salida');
    });
}

function fillPatchBlock(block, conn, role) {
    if (!block || !conn) return;
    
    const secId = role === 'entrada' ? conn.ID_Origen : conn.ID_Destino;
    const secItem = getItemById(secId);
    const secName = secItem ? (secItem.Nombre || secItem.Tipo) : secId;

    block.querySelector('.sel-id').value = secId;
    block.querySelector('.sel-label').innerText = `${secId} (${secName})`;
    block.querySelector('.p-id').value = conn.ID_Patch;
    block.querySelector('.p-ori').value = conn.Puerto_Origen;
    block.querySelector('.p-des').value = conn.Puerto_Destino;
    block.querySelector('.p-signal').value = conn.Tipo_Senial || '';
    block.querySelector('.p-notes').value = conn.Notas || '';
}

function confirmAdminEntry() {
    if (document.getElementById('dontShowAdminWarning').checked) {
        localStorage.setItem('skip_admin_warning', 'true');
    }
    document.getElementById('adminWarningModal').style.display = 'none';
    setMode('ADMIN', true, true); // Bypass warning
}

function cancelAdminEntry() {
    document.getElementById('adminWarningModal').style.display = 'none';
    setMode('OPERACION');
}

// Inicialización de la aplicación
init();
