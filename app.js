/**
 * AV Tech SPA - Logic Core
 * Vanilla JS + Graph Traversal + PWA Sync
 */

let API_URL = "";

// State
let db = { equipos: [], cables: [], conexiones: [] };
let currentMode = 'ARMADO'; 
let offlineQueue = JSON.parse(localStorage.getItem('av_tech_queue') || '[]');
let currentSort = { type: '', column: '', direction: 'asc' };
let selectedBranches = {}; // nodeId -> choiceId (for tree navigation)
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

    if (!rawQuery && !specificId) {
        renderInventory();
        return;
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
    const parents = tracePath(centralId, 'back');
    parents.reverse().forEach(p => {
        container.appendChild(renderTreeNode(p.id, false));
        container.appendChild(renderTreeConnection(p.conn, 'down'));
    });

    // 2. Central Node
    container.appendChild(renderTreeNode(centralId, true));

    // 3. Trace Forwards (Children)
    const children = tracePath(centralId, 'forward');
    children.forEach(c => {
        container.appendChild(renderTreeConnection(c.conn, 'down'));
        container.appendChild(renderTreeNode(c.id, false));
    });

    resultsContainer.appendChild(container);
}

function tracePath(startId, direction) {
    const path = [];
    let currentId = startId;
    const visited = new Set([startId]);

    while (true) {
        const conns = direction === 'forward' 
            ? db.conexiones.filter(c => c.ID_Origen === currentId)
            : db.conexiones.filter(c => c.ID_Destino === currentId);

        if (conns.length === 0) break;

        // Si hay bifurcación, elegir la seleccionada o la primera
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

    if (isCentral) {
        el.innerHTML = `
            <div class="back-header" style="margin-bottom:10px">
                <button class="back-btn" onclick="clearSearch()"><span class="material-icons">arrow_back</span></button>
                <span class="badge-id">${id}</span>
            </div>
            <h2>${info?.Nombre || info?.Tipo_Conector || 'Sin Nombre'}</h2>
            <div class="node-metadata" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.8rem">
                <div><strong>Propietario:</strong> ${info?.Propietario || 'S/D'}</div>
                <div><strong>Ubicación:</strong> ${info?.Ubicacion_Uso || 'S/D'}</div>
                <div><strong>Lugar:</strong> ${info?.Lugar_Guardado_Final || 'S/D'}</div>
                <div><strong>Estado:</strong> ${info?.Estado_Logistica || 'S/D'}</div>
            </div>
            ${info?.Notas ? `<div class="node-metadata" style="margin-top:10px; border-top:1px solid #333; padding-top:5px"><em>${info.Notas}</em></div>` : ''}
        `;
    } else {
        el.innerHTML = `
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

    // Bifurcations check
    const outputs = db.conexiones.filter(c => c.ID_Origen === id);
    const inputs = db.conexiones.filter(c => c.ID_Destino === id);

    if (outputs.length > 1) {
        el.appendChild(renderBranchSelector(id, outputs, 'forward'));
    }
    if (inputs.length > 1) {
        el.appendChild(renderBranchSelector(id, inputs, 'back'));
    }

    return el;
}

function renderBranchSelector(nodeId, conns, direction) {
    const sel = document.createElement('select');
    sel.className = 'branch-selector';
    const currentChoice = selectedBranches[`${nodeId}_${direction}`];
    
    sel.innerHTML = conns.map(c => {
        const targetId = direction === 'forward' ? c.ID_Destino : c.ID_Origen;
        const port = direction === 'forward' ? c.Puerto_Origen : c.Puerto_Destino;
        return `<option value="${targetId}" ${targetId === currentChoice ? 'selected' : ''}>Ruta por: ${port} (${targetId})</option>`;
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
        <div class="connection-info">
            ${conn.Puerto_Origen} <span class="material-icons" style="font-size:0.8rem">arrow_downward</span> ${conn.Puerto_Destino}
            <span style="margin-left:5px; color:var(--text-secondary)">(${conn.Tipo_Senial})</span>
        </div>
        <div class="arrow-line ${isConnected ? 'connected' : 'pending'}" 
             style="cursor:pointer" title="Cambiar estado" 
             onclick="togglePatch('${conn.ID_Patch}')"></div>
    `;
    return el;
}

async function togglePatch(idPatch) {
    const conn = db.conexiones.find(c => c.ID_Patch === idPatch);
    if (!conn) return;

    const newState = conn.Estado_Instalacion === 'Conectado' ? 'Pendiente' : 'Conectado';
    await handleAction('EDIT_CONEXION', { id_patch: idPatch, Estado_Instalacion: newState });
    
    // Refresh UI
    const centralId = document.querySelector('.tree-node.central .badge-id').innerText;
    renderTree(centralId);
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

function toggleAdminForm() {
    if (adminFormContainer.style.display === 'none') {
        const activeTabBtn = document.querySelector('.admin-tabs .tab-btn.active');
        const tabText = activeTabBtn.innerText;
        const formId = tabText.includes('Equipos') ? 'formEquipo' : (tabText.includes('Cables') ? 'formCable' : 'formRuteo');
        
        const form = document.getElementById(formId).cloneNode(true);
        form.style.display = 'grid';
        form.id = 'activeAdminForm';
        
        // Reset to "New" mode
        form.querySelector('[name="isEdit"]').value = 'false';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerText = "Guardar Nuevo";
        
        formContainerInner.innerHTML = '';
        formContainerInner.appendChild(form);
        adminFormContainer.style.display = 'block';
        
        // Re-attach listener
        form.addEventListener('submit', (e) => handleFormSubmit(e, formId));
    } else {
        adminFormContainer.style.display = 'none';
    }
}

function editItem(type, id) {
    const item = db[type].find(i => (i.ID_Equipo || i.ID_Cable || i.ID_Patch) === id);
    if (!item) return;

    const formId = type === 'equipos' ? 'formEquipo' : (type === 'cables' ? 'formCable' : 'formRuteo');
    const form = document.getElementById(formId).cloneNode(true);
    form.style.display = 'grid';
    form.id = 'activeAdminForm';
    
    // Fill data
    form.querySelector('[name="isEdit"]').value = 'true';
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerText = "Actualizar";
    submitBtn.classList.replace('btn-primary', 'btn-warning');

    // Mapeo de campos
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        const name = input.name;
        // Normalizar nombres de campos (form name vs db key)
        let dbKey = name;
        if (name === 'id') dbKey = type === 'equipos' ? 'ID_Equipo' : 'ID_Cable';
        if (name === 'id_patch') dbKey = 'ID_Patch';
        if (name === 'id_origen') dbKey = 'ID_Origen';
        if (name === 'id_destino') dbKey = 'ID_Destino';
        
        if (item[dbKey] !== undefined) input.value = item[dbKey];
    });

    formContainerInner.innerHTML = '';
    formContainerInner.appendChild(form);
    adminFormContainer.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth' });

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
        adminFormContainer.style.display = 'none';
        renderAdminTable(currentSort.type);
        populateDatalists();
    }
}

async function handleAction(action, body) {
    const originalText = searchInput.placeholder;
    searchInput.placeholder = "Sincronizando...";
    
    // Actualización optimista del estado local
    if (action.startsWith('ADD_')) {
        const type = action.includes('EQUIPO') ? 'equipos' : (action.includes('CABLE') ? 'cables' : 'conexiones');
        // Adaptar nombres de campos de formulario a DB
        const entry = { ...body };
        if (body.id) entry[type === 'equipos' ? 'ID_Equipo' : 'ID_Cable'] = body.id;
        db[type].push(entry);
    } else if (action.startsWith('EDIT_')) {
        const type = action.includes('EQUIPO') ? 'equipos' : (action.includes('CABLE') ? 'cables' : 'conexiones');
        const idKey = type === 'equipos' ? 'ID_Equipo' : (type === 'cables' ? 'ID_Cable' : 'ID_Patch');
        const idVal = body.id || body.id_patch;
        const index = db[type].findIndex(i => i[idKey] === idVal);
        if (index !== -1) {
            const entry = { ...body };
            if (body.id) entry[idKey] = body.id;
            db[type][index] = { ...db[type][index], ...entry };
        }
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
    if (!API_URL) return;
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...body })
    });
    return response.json();
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

function autoGenerateId(formType) {
    let prefix = '';
    if (formType === 'equipo') {
        const cat = document.getElementById('equip_cat')?.value.substring(0, 3).toUpperCase();
        const nom = document.getElementById('equip_nombre')?.value.substring(0, 3).toUpperCase();
        if (cat && nom) prefix = `${cat}-${nom}`;
    } else {
        const tip = document.getElementById('cable_tipo')?.value.substring(0, 3).toUpperCase();
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
        showAdminTab('tabEquipo', document.querySelector('.tab-btn'));
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
