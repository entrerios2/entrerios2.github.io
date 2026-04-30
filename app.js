/**
 * AV Tech SPA - Logic Core
 * Vanilla JS + Graph Traversal + PWA Sync
 */

let API_URL = "";

// State
let db = { equipos: [], cables: [], conexiones: [] };
let currentMode = 'OPERACION'; 
let techName = localStorage.getItem('tech_name') || "";
let offlineQueue = JSON.parse(localStorage.getItem('av_tech_queue') || '[]');
let currentSort = { type: '', column: '', direction: 'asc' };
let selectedBranches = {}; // nodeId -> choiceId (for tree navigation)
let treeMaxDepth = 1; // Default depth for tree expansion
let activeGroupings = { equipos: '', cables: '', conexiones: '' };
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
const adminTableHead = document.getElementById('adminTableHead');
const adminTableBody = document.getElementById('adminTableBody');
const adminFormContainer = document.getElementById('adminFormContainer');
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
    updateOfflineStatus();
    
    // Identidad
    if (!techName) {
        techName = prompt("Ingrese su nombre para registrar los cambios:");
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
    
    // Check if there is an id or mode in URL for history state
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    const modeParam = urlParams.get('mode');
    
    if (modeParam && ['OPERACION', 'ADMIN'].includes(modeParam)) {
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
 * 1.1 Trazabilidad y Metadatos
 */
async function logActivity(itemId, type, detail) {
    console.log(`Logging ${type} for ${itemId}: ${detail}`);
    const item = getItemById(itemId) || db.conexiones.find(c => c.ID_Patch === itemId);
    if (!item) return;

    let meta = { historial: [], notas: [] };
    try {
        if (item.Metadatos) meta = JSON.parse(item.Metadatos);
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
    
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} ${timeStr}`;
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
            groups: [{val: '', label: 'Sin Agrupar'}, {val: 'Categoria', label: 'Categoría'}, {val: 'Ubicacion_Uso', label: 'Ubicación'}, {val: 'Lugar_Guardado_Final', label: 'Contenedor'}, {val: 'Propietario', label: 'Propietario'}, {val: 'Estado_Logistica', label: 'Estado'}]
        },
        { 
            type: 'cables', title: 'Cables', icon: 'cable',
            groups: [{val: '', label: 'Sin Agrupar'}, {val: 'Tipo_Conector', label: 'Conector'}, {val: 'Longitud_m', label: 'Longitud'}, {val: 'Propietario', label: 'Propietario'}, {val: 'Lugar_Guardado_Final', label: 'Contenedor'}, {val: 'Estado_Logistica', label: 'Estado'}]
        },
        { 
            type: 'conexiones', title: 'Conexiones', icon: 'settings_input_component',
            groups: [{val: '', label: 'Sin Agrupar'}, {val: 'ID_Origen', label: 'Origen'}, {val: 'ID_Destino', label: 'Destino'}, {val: 'Tipo_Senial', label: 'Tipo Señal'}, {val: 'Estado_Instalacion', label: 'Estado'}]
        }
    ];

    sections.forEach(section => {
        const details = document.createElement('details');
        details.className = 'premium-details main-section';
        if (activeGroupings[section.type]) details.open = true;

        const headers = (section.type === 'equipos') ? ['ID_Equipo', 'Nombre', 'Categoria', 'Ubicacion_Uso', 'Lugar_Guardado_Final', 'Estado_Logistica'] :
                      (section.type === 'cables') ? ['ID_Cable', 'Tipo_Conector', 'Longitud_m', 'Lugar_Guardado_Final', 'Estado_Logistica'] :
                      ['ID_Patch', 'ID_Origen', 'Puerto_Origen', 'ID_Destino', 'Puerto_Destino', 'Tipo_Senial', 'Estado_Instalacion'];

        const renderTableHTML = (tableData) => `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>${headers.map(h => {
                            let label = h;
                            if (h.startsWith('ID_')) label = 'ID';
                            if (h === 'Ubicacion_Uso') label = 'Ubicación';
                            if (h === 'Lugar_Guardado_Final') label = 'Contenedor';
                            if (h === 'Estado_Logistica' || h === 'Estado_Instalacion') label = 'Estado';
                            if (h === 'Tipo_Conector') label = 'Tipo';
                            if (h === 'Longitud_m') label = 'Largo (m)';
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
                                    clickAction = `renderResults('${row.ID_Origen}')`;
                                } else {
                                    clickAction = `renderResults('${row[headers[0]]}')`;
                                }
                            }
                            return `
                                <tr onclick="event.stopPropagation(); ${clickAction}" style="cursor:pointer">
                                    ${headers.map(h => {
                                        const val = row[h] || '-';
                                        const colorClass = val === 'Conectado' ? 'status-green' : (val === 'Pendiente' ? 'status-red' : '');
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
                    <select class="premium-select" onchange="setGrouping('${section.type}', this.value)">
                        ${section.groups.map(g => `<option value="${g.val}" ${activeGroupings[section.type] === g.val ? 'selected' : ''}>${g.label}</option>`).join('')}
                    </select>
                </div>
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

        const data = [...db[section.type]];
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
                    <summary><span class="material-icons chevron">expand_more</span> ${key} <span class="badge-count">${items.length}</span></summary>
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
            ['Ubicacion_Uso', 'ubicacion'], ['Propietario', 'propietario'],
            ['Lugar_Guardado_Final', 'lugar'], ['Estado_Logistica', 'estado'], ['Notas', 'notes']
        ]);
    } else if (type === 'cables') {
        mapFields([
            ['ID_Cable', 'id'], ['Tipo_Conector', 'tipo'], ['Longitud_m', 'longitud'],
            ['Propietario', 'propietario'], ['Lugar_Guardado_Final', 'lugar'],
            ['Estado_Logistica', 'estado'], ['Notas', 'notes']
        ]);
    } else if (type === 'conexiones') {
        mapFields([
            ['ID_Patch', 'id_patch'], ['ID_Origen', 'id_origen'], ['Puerto_Origen', 'puerto_origen'],
            ['ID_Destino', 'id_destino'], ['Puerto_Destino', 'puerto_destino'],
            ['Tipo_Senial', 'tipo_senial'], ['Estado_Instalacion', 'estado']
        ]);
    }
    
    // Preserve Metadata if editing
    if (body.isEdit === 'true' || body.value) { // value indicates partial update usually
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
        renderTree(specificId);
        return;
    }

    const matches = [...db.equipos, ...db.cables].filter(item => {
        const id = (item.ID_Equipo || item.ID_Cable || '').toUpperCase();
        const nombre = (item.Nombre || item.Tipo_Conector || '').toUpperCase();
        return id.includes(rawQuery) || nombre.includes(rawQuery);
    });

    if (matches.length === 0) {
        resultsContainer.innerHTML = `<div class="card" style="text-align:center">No se encontró "${rawQuery}"</div>`;
        return;
    }

    if (matches.length > 1) {
        resultsContainer.innerHTML = `<p style="margin-bottom:1rem; font-size:0.8rem; color:var(--text-secondary)">${matches.length} coincidencias:</p>`;
        matches.forEach(item => {
            const id = item.ID_Equipo || item.ID_Cable;
            const nombre = item.Nombre || item.Tipo_Conector || '';
            const isCable = id.startsWith('CBL');
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

function renderTree(centralId) {
    resultsContainer.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tree-container';

    // 1. Trace Backwards (Parents)
    const parents = tracePath(centralId, 'back', treeMaxDepth);
    
    if (parents.length === treeMaxDepth) {
        const btn = document.createElement('button');
        btn.className = 'expand-tree-btn';
        btn.innerHTML = '<span class="material-icons">keyboard_double_arrow_up</span>';
        btn.title = "Expandir Origen";
        btn.onclick = () => { treeMaxDepth++; renderTree(centralId); };
        container.appendChild(btn);
    }

    parents.reverse().forEach(p => {
        container.appendChild(renderTreeNode(p.id, false));
        container.appendChild(renderTreeConnection(p.conn, 'down'));
    });

    // 2. Central Node
    container.appendChild(renderTreeNode(centralId, true));

    // 3. Trace Forwards (Children)
    const children = tracePath(centralId, 'forward', treeMaxDepth);
    children.forEach(c => {
        container.appendChild(renderTreeConnection(c.conn, 'down'));
        container.appendChild(renderTreeNode(c.id, false));
    });

    if (children.length === treeMaxDepth) {
        const btn = document.createElement('button');
        btn.className = 'expand-tree-btn';
        btn.innerHTML = '<span class="material-icons">keyboard_double_arrow_down</span>';
        btn.title = "Expandir Destino";
        btn.onclick = () => { treeMaxDepth++; renderTree(centralId); };
        container.appendChild(btn);
    }

    resultsContainer.appendChild(container);
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

function renderTreeNode(id, isCentral) {
    const info = getItemById(id);
    const isCable = id.startsWith('CBL');
    const el = document.createElement('div');
    el.className = `tree-node ${isCentral ? 'central' : ''}`;

    const inputs = db.conexiones.filter(c => c.ID_Destino === id);
    const outputs = db.conexiones.filter(c => c.ID_Origen === id);

    // Borde de puertos (Pills)
    if (inputs.length > 0) {
        const isConn = inputs.some(c => c.Estado_Instalacion === 'Conectado');
        const pill = document.createElement('div');
        pill.className = `port-pill input ${isConn ? 'connected' : 'pending'}`;
        pill.innerHTML = `<span class="material-icons" style="font-size:0.8rem">login</span>`;
        if (inputs.length === 1) pill.innerHTML += inputs[0].Puerto_Destino;
        else pill.appendChild(renderPortSelect(id, inputs, 'back'));
        el.appendChild(pill);
    }

    if (outputs.length > 0) {
        const isConn = outputs.some(c => c.Estado_Instalacion === 'Conectado');
        const pill = document.createElement('div');
        pill.className = `port-pill output ${isConn ? 'connected' : 'pending'}`;
        pill.innerHTML = `<span class="material-icons" style="font-size:0.8rem">logout</span>`;
        if (outputs.length === 1) pill.innerHTML += outputs[0].Puerto_Origen;
        else pill.appendChild(renderPortSelect(id, outputs, 'forward'));
        el.appendChild(pill);
    }

    if (isCentral) {
        const estadoOpciones = ['En Uso', 'Guardado', 'Devuelto', 'Instalado', 'Preparado para instalar', 'Preparado para guardar'];
        const currentEstado = info?.Estado_Logistica || 'Guardado';
        
        el.innerHTML += `
            <button class="close-ficha-btn" onclick="clearSearch()" title="Cerrar"><span class="material-icons">close</span></button>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px; padding-right:30px;">
                <span class="material-icons" style="color:var(--accent-cyan); font-size:1.5rem;">${isCable ? 'cable' : 'speaker'}</span>
                <h2 style="margin:0; font-size:1.2rem; line-height:1.2">${info?.Nombre || info?.Tipo_Conector || 'Sin Nombre'}</h2>
                <span class="badge-id" style="font-size:0.75rem; padding:0.3rem 0.6rem;">${id}</span>
            </div>
            
            <div class="compact-meta">
                <div class="meta-pill" title="Propietario"><span class="material-icons" style="font-size:0.9rem">person</span> ${info?.Propietario || '-'}</div>
                <div class="meta-pill" title="Ubicación"><span class="material-icons" style="font-size:0.9rem">location_on</span> ${info?.Ubicacion_Uso || '-'}</div>
                <div class="meta-pill" title="Contenedor"><span class="material-icons" style="font-size:0.9rem">inventory_2</span> ${info?.Lugar_Guardado_Final || '-'}</div>
            </div>

            <div style="margin-top:10px; margin-bottom:15px;">
                <label style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-bottom:4px;">Estado Logístico:</label>
                <select class="premium-select" style="width:100%" onchange="handleUpdateLogistica('${id}', this.value)">
                    ${estadoOpciones.map(opt => `<option value="${opt}" ${opt === currentEstado ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>

            ${(() => {
                let meta = { historial: [], notas: [] };
                try { if (info?.Metadatos) meta = JSON.parse(info.Metadatos); } catch(e){}
                const lastNote = meta.notas.length > 0 ? meta.notas[meta.notas.length-1] : null;
                const lastMove = meta.historial.length > 0 ? meta.historial[meta.historial.length-1] : null;
                
                return `
                                <details class="premium-details mini">
                        <summary>
                            <span class="material-icons chevron">expand_more</span>
                            <span class="material-icons" style="font-size:1rem; color:var(--accent-cyan)">chat</span>
                            ${lastNote ? `<span style="font-size:0.75rem"><b>${formatRelativeDate(lastNote.timestamp)}</b> ${lastNote.detalle}</span>` : '<span style="font-size:0.75rem; color:var(--text-secondary)">Sin notas</span>'}
                        </summary>
                        <div class="details-content notes-list">
                            <div class="add-note-box">
                                <textarea id="note_input_${id}" placeholder="Escribe una nota..."></textarea>
                                <button class="action-btn btn-primary btn-mini" onclick="addNote('${id}')">Agregar Nota</button>
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
                `;
            })()}

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
        `;
    } else {
        el.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center">
                <div style="cursor:pointer" onclick="renderResults('${id}')">
                    <span class="badge-id">${id}</span>
                    <div style="font-size:0.85rem; font-weight:600">${info?.Nombre || info?.Tipo_Conector || ''}</div>
                    <div class="node-metadata" style="font-size:0.7rem">${info?.Ubicacion_Uso || ''} | ${info?.Estado_Logistica || ''}</div>
                </div>
                <span class="material-icons" style="color:var(--text-secondary)">${isCable ? 'cable' : 'speaker'}</span>
            </div>
        `;
    }

    return el;
}

function renderPortListEntry(conn, type) {
    const isConn = conn.Estado_Instalacion === 'Conectado';
    const targetId = type === 'in' ? conn.ID_Origen : conn.ID_Destino;
    const port = type === 'in' ? conn.Puerto_Destino : conn.Puerto_Origen;
    const targetInfo = getItemById(targetId);
    const targetName = targetInfo?.Nombre || targetInfo?.Tipo_Conector || targetId;

    return `
        <div class="port-entry ${isConn ? 'connected' : 'pending'}" onclick="renderResults('${targetId}')">
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
    
    sel.innerHTML = conns.map(c => {
        const targetId = direction === 'forward' ? c.ID_Destino : c.ID_Origen;
        const port = direction === 'forward' ? c.Puerto_Origen : c.Puerto_Destino;
        return `<option value="${targetId}" ${targetId === currentChoice ? 'selected' : ''}>${port} → ${targetId}</option>`;
    }).join('');

    sel.onchange = (e) => {
        selectedBranches[`${nodeId}_${direction}`] = e.target.value;
        const centralId = document.querySelector('.tree-node.central .badge-id').innerText;
        renderTree(centralId);
    };
    return sel;
}

function renderTreeConnection(conn, direction) {
    const isConnected = conn.Estado_Instalacion === 'Conectado';
    const el = document.createElement('div');
    el.className = 'connection-jump';
    el.innerHTML = `
        <div class="arrow-line ${isConnected ? 'connected' : 'pending'}" 
             style="cursor:pointer" title="Cambiar estado: ${conn.Estado_Instalacion}" 
             onclick="togglePatch('${conn.ID_Patch}')">
            <div class="signal-pill">${conn.Tipo_Senial}</div>
        </div>
    `;
    return el;
}

async function togglePatch(idPatch, checkboxEl) {
    console.log('Toggling patch:', idPatch);
    const conn = db.conexiones.find(c => c.ID_Patch === idPatch);
    if (!conn) return;

    if (checkboxEl) {
        checkboxEl.disabled = true;
        const entryDiv = checkboxEl.closest('.port-entry');
        if (entryDiv) entryDiv.style.opacity = '0.5';
    }

    const newState = conn.Estado_Instalacion === 'Conectado' ? 'Pendiente' : 'Conectado';

    try {
        await handleAction('UPDATE_PATCH', { id: idPatch, value: newState });
        await logActivity(idPatch, 'MOVE', `Conexión: ${newState}`);
        
        // Refresh UI
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
    }
}

/**
 * 3.1 Funciones de Administración
 */
function showAdminTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // Reset form
    adminFormContainer.style.display = 'none';
    formContainerInner.innerHTML = '';
    
    const type = tabId === 'tabEquipo' ? 'equipos' : (tabId === 'tabCable' ? 'cables' : 'conexiones');
    renderAdminTable(type);
    updateSelects();
}

function renderAdminTable(type) {
    currentSort.type = type;
    const data = [...db[type]];
    
    if (currentSort.column) {
        data.sort((a, b) => {
            const valA = String(a[currentSort.column]).toLowerCase();
            const valB = String(b[currentSort.column]).toLowerCase();
            return currentSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
    }

    const headers = {
        equipos: ['ID_Equipo', 'Nombre', 'Categoria', 'Ubicacion_Uso', 'Estado_Logistica'],
        cables: ['ID_Cable', 'Tipo_Conector', 'Longitud_m', 'Estado_Logistica'],
        conexiones: ['ID_Patch', 'ID_Origen', 'Puerto_Origen', 'ID_Destino', 'Puerto_Destino', 'Estado_Instalacion']
    };

    adminTableHead.innerHTML = `<tr>${headers[type].map(h => `<th onclick="sortTable('${h}')">${h}</th>`).join('')}<th>Acciones</th></tr>`;
    
    adminTableBody.innerHTML = data.map(row => `
        <tr>
            ${headers[type].map(h => `<td>${row[h] || '-'}</td>`).join('')}
            <td>
                <button class="action-btn btn-warning" style="padding:4px 8px; font-size:0.7rem" 
                        onclick="editItem('${type}', '${row[headers[type][0]]}')">
                    <span class="material-icons" style="font-size:1rem">edit</span>
                </button>
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
    let formId = 'formEquipo';
    if (type === 'cables') formId = 'formCable';
    if (type === 'conexiones') formId = 'formRuteo';
    
    const form = document.getElementById(formId).cloneNode(true);
    form.style.display = 'grid';
    form.id = 'activeAdminForm';
    
    // Reset to "New" mode
    form.querySelector('[name="isEdit"]').value = 'false';
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerText = "Guardar Nuevo";
    
    formContainerInner.innerHTML = '';
    formContainerInner.appendChild(form);
    document.getElementById('adminModal').style.display = 'flex';
    
    // Attach Auto-ID listeners to the CLONED form elements
    if (type === 'equipos') {
        const catIn = form.querySelector('[name="categoria"]');
        const nomIn = form.querySelector('[name="nombre"]');
        [catIn, nomIn].forEach(el => el?.addEventListener('input', () => autoGenerateId('equipo', form)));
    } else if (type === 'cables') {
        const tipIn = form.querySelector('[name="tipo"]');
        tipIn?.addEventListener('input', () => autoGenerateId('cable', form));
    }

    // Re-attach listener
    form.addEventListener('submit', (e) => handleFormSubmit(e, formId));
}

function closeAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
    formContainerInner.innerHTML = '';
}

function editItem(type, id) {
    console.log('editItem triggered:', type, id);
    const item = db[type].find(i => {
        const itemId = String(i.ID_Equipo || i.ID_Cable || i.ID_Patch || '');
        return itemId === String(id);
    });
    if (!item) {
        console.error('Item not found in db[' + type + '] with ID:', id);
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
        'ubicacion': 'Ubicacion_Uso',
        'propietario': 'Propietario',
        'lugar': 'Lugar_Guardado_Final',
        'notas': 'Notas',
        'tipo': 'Tipo_Conector',
        'longitud': 'Longitud_m',
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
            input.readOnly = true; // Prevent changing ID
        }
    });

    formContainerInner.innerHTML = '';
    formContainerInner.appendChild(form);
    document.getElementById('adminModal').style.display = 'flex';

    form.addEventListener('submit', (e) => handleFormSubmit(e, formId));
}

async function handleFormSubmit(e, formId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    const isEdit = body.isEdit === 'true';

    let action = '';
    if (formId === 'formEquipo') action = isEdit ? 'EDIT_EQUIPO' : 'ADD_EQUIPO';
    if (formId === 'formCable') action = isEdit ? 'EDIT_CABLE' : 'ADD_CABLE';
    if (formId === 'formRuteo') action = isEdit ? 'EDIT_CONEXION' : 'ADD_CONEXION';

    const success = await handleAction(action, body);
    if (success) {
        closeAdminModal();
        renderInventory(); // Refresh view
        populateDatalists();
    }
}

async function handleUpdateLogisticaOld(id, value) {
    // Deleted duplicate
}

async function handleAction(action, body) {
    const originalText = searchInput.placeholder;
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
        const index = db[type].findIndex(i => i[idKey] === idVal);
        if (index !== -1) {
            const entry = mapToDb(body, type);
            db[type][index] = { ...db[type][index], ...entry };
        }
    } else if (action === 'UPDATE_LOGISTICA') {
        const item = getItemById(body.id);
        if (item) item.Estado_Logistica = body.value;
    } else if (action === 'UPDATE_PATCH') {
        const conn = db.conexiones.find(c => c.ID_Patch === body.id);
        if (conn) conn.Estado_Instalacion = body.value;
    } else if (action === 'UPDATE_METADATOS') {
        const item = getItemById(body.id) || db.conexiones.find(c => c.ID_Patch === body.id);
        if (item) item.Metadatos = body.value;
    }

    localStorage.setItem('av_tech_db', JSON.stringify(db));

    if (navigator.onLine) {
        try {
            await sendToServer(action, body);
            searchInput.placeholder = "¡Guardado!";
            setTimeout(() => searchInput.placeholder = originalText, 2000);
            return true;
        } catch (e) {
            queueAction({ action, body });
        }
    } else {
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

async function handleUpdateLogistica(id, newState) {
    const item = getItemById(id);
    if (!item) return;

    const oldState = item.Estado_Logistica || 'Desconocido';
    await handleAction('UPDATE_LOGISTICA', { id: id, value: newState });
    
    // Log activity
    logActivity(id, 'MOVE', `Cambio de estado: ${oldState} -> ${newState}`);
    
    renderTree(id);
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
    if(selOrigen) selOrigen.innerHTML = placeholder + options;
    if(selDestino) selDestino.innerHTML = placeholder + options;
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

function autoGenerateId(formType, formEl) {
    if (!formEl) return;
    let prefix = '';
    if (formType === 'equipo') {
        const cat = formEl.querySelector('[name="categoria"]')?.value.substring(0, 3).toUpperCase();
        const nom = formEl.querySelector('[name="nombre"]')?.value.substring(0, 3).toUpperCase();
        if (cat && nom) prefix = `${cat}-${nom}`;
    } else {
        const tip = formEl.querySelector('[name="tipo"]')?.value.substring(0, 3).toUpperCase();
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
    const targetInput = formEl.querySelector('[name="id"]');
    if (targetInput && !targetInput.value.includes(prefix)) {
        targetInput.value = newId;
    }
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
            await sendToServer(action.action, action.body);
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
function setMode(mode, pushState = true) {
    currentMode = mode;
    const modeTitle = mode === 'OPERACION' ? 'Operación' : 'Administración';
    document.getElementById('activeModeDisplay').innerText = modeTitle;
    
    sideMenu.classList.remove('active');
    if (pushState) history.pushState({ mode }, '', `?mode=${mode}`);
    
    if (mode === 'ADMIN') {
        document.querySelector('.search-container').style.display = 'none';
        resultsContainer.style.display = 'none';
        adminPanel.style.display = 'block';
        renderInventory(); // Mirror mode in adminInventoryContainer
    } else {
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

// Start
init();
