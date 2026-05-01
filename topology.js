/**
 * AntV X6 Topology Map Engine
 * Migrated from app.js to keep the main logic clean.
 * v2.0.0 — Stabilized hierarchical ELK layout
 *
 * Key fixes over v1:
 *   - ELK returns RELATIVE coords for children; X6 uses ABSOLUTE.
 *     We now compute absolute positions: childAbsX = parent.x + child.x
 *   - Added elk.hierarchyHandling = INCLUDE_CHILDREN so cross-container
 *     edges are routed in a single unified pass.
 *   - ELK edges now use primitive format (source/target/sourcePort/targetPort)
 *     instead of extended arrays, placed at root level.
 *   - Container nodes are positioned & sized BEFORE children are added,
 *     then children get absolute coords, then addChild() is called last
 *     (so future drags move them together).
 */

let x6Graph = null;
let activeMapFilters = { signal: null, ubicacion: null, categoria: null };

function openConnectionModal(conn) {
    if (!conn) return;
    if (typeof editItem === 'function') {
        editItem('conexiones', conn.ID_Patch);
    }
}

function renderMapTopology() {
    if (!db || !db.equipos) return;

    // 1 — Color helpers
    const signalColors = {};
    let colorIdx = 0;
    const baseHues = [185,4,210,270,134,30,330,60,160,20,280,90,350,45,240,110,300,15,170,55];
    function getSignalColor(signal) {
        if (!signal) return '#777';
        if (!signalColors[signal]) {
            const hue = baseHues[colorIdx % baseHues.length];
            const lum = colorIdx < 8 ? 60 : (colorIdx < 16 ? 50 : 40);
            signalColors[signal] = `hsl(${hue}, 85%, ${lum}%)`;
            colorIdx++;
        }
        return signalColors[signal];
    }
    const stateColor = (estado) => estado === 'Conectado' ? '#3fb950' : '#f85149';

    // 2 — Edge Collapsing: cables with exactly 2 connections become direct edges
    const collapsedCables = new Set();
    const directEdges = [];
    db.cables.forEach(cable => {
        const conns = db.conexiones.filter(c =>
            c.ID_Origen === cable.ID_Cable || c.ID_Destino === cable.ID_Cable
        );
        if (conns.length === 2) {
            const entrada = conns.find(c => c.ID_Destino === cable.ID_Cable);
            const salida  = conns.find(c => c.ID_Origen  === cable.ID_Cable);
            if (entrada && salida) {
                collapsedCables.add(cable.ID_Cable);
                directEdges.push({
                    id: `edge-${cable.ID_Cable}`,
                    source: entrada.ID_Origen, target: salida.ID_Destino,
                    sourcePort: entrada.ID_Patch + '-out',
                    targetPort: salida.ID_Patch + '-in',
                    portSrc: entrada.Puerto_Origen, portDst: salida.Puerto_Destino,
                    cableId: cable.ID_Cable,
                    cableLabel: `${cable.Tipo || ''} ${cable.Largo ? cable.Largo + 'm' : ''}`.trim(),
                    signal: entrada.Tipo_Senial || salida.Tipo_Senial,
                    color: getSignalColor(entrada.Tipo_Senial || salida.Tipo_Senial),
                    status: entrada.Estado
                });
            }
        }
    });

    // 3 — Initialize X6
    if (x6Graph) { x6Graph.dispose(); x6Graph = null; }
    const container = document.getElementById('cy');
    if (!container) return;
    container.innerHTML = '';
    x6Graph = new X6.Graph({
        container,
        width: container.clientWidth || window.innerWidth,
        height: container.clientHeight || window.innerHeight,
        background: { color: '#0d1117' },
        grid: false,
        panning: { enabled: true, eventTypes: ['leftMouseDown'] },
        mousewheel: { enabled: true, modifiers: null, minScale: 0.1, maxScale: 5 },
        interacting: false,
        connecting: { enabled: false }
    });

    // 4 — Port groups (Triangle=In, Circle=Out)
    const PORT_GROUPS = {
        'in-left': {
            position: 'left',
            markup: [{ tagName: 'path', selector: 'portShape' }, { tagName: 'text', selector: 'portLabel' }],
            attrs: {
                portShape: { d: 'M 8 -5 0 0 8 5 Z', fill: '#f85149', stroke: 'none', refX: -4 },
                portLabel: { fontSize: 7, fill: '#ccc', textAnchor: 'end', refX: -12, refY: 3 }
            }
        },
        'in-top': {
            position: 'top',
            markup: [{ tagName: 'path', selector: 'portShape' }, { tagName: 'text', selector: 'portLabel' }],
            attrs: {
                portShape: { d: 'M -5 8 0 0 5 8 Z', fill: '#f85149', stroke: 'none', refY: -4 },
                portLabel: { fontSize: 7, fill: '#ccc', textAnchor: 'middle', refY: -14 }
            }
        },
        'out-right': {
            position: 'right',
            markup: [{ tagName: 'circle', selector: 'portShape' }, { tagName: 'text', selector: 'portLabel' }],
            attrs: {
                portShape: { r: 5, fill: '#f85149', stroke: 'none' },
                portLabel: { fontSize: 7, fill: '#ccc', textAnchor: 'start', refX: 9, refY: 3 }
            }
        },
        'out-bottom': {
            position: 'bottom',
            markup: [{ tagName: 'circle', selector: 'portShape' }, { tagName: 'text', selector: 'portLabel' }],
            attrs: {
                portShape: { r: 5, fill: '#f85149', stroke: 'none' },
                portLabel: { fontSize: 7, fill: '#ccc', textAnchor: 'middle', refY: 10 }
            }
        }
    };

    // 5 — Location container nodes
    const locationNodes = {};
    const locations = new Set();
    [...db.equipos, ...db.cables].forEach(item => {
        if (item.ID_Cable && collapsedCables.has(item.ID_Cable)) return;
        if (item.Ubicacion) locations.add(item.Ubicacion);
    });
    locations.forEach(loc => {
        if (activeMapFilters.ubicacion && loc !== activeMapFilters.ubicacion) return;
        locationNodes[loc] = x6Graph.addNode({
            id: 'LOC_' + loc, shape: 'rect', x: 0, y: 0, width: 100, height: 100,
            label: loc, zIndex: 0,
            attrs: {
                body: { fill: 'rgba(255,255,255,0.03)', stroke: '#444', strokeDasharray: '6,3', rx: 12, ry: 12 },
                label: { fill: '#aaa', fontSize: 13, fontFamily: 'Outfit', fontWeight: 'bold',
                         textVerticalAnchor: 'top', textAnchor: 'left', refX: 12, refY: 8 }
            }
        });
    });

    // 6 — Equipment nodes
    // Global set to prevent any port ID duplication across the entire graph
    const globalPortIds = new Set();

    db.equipos.forEach(equipo => {
        const id = equipo.ID_Equipo;
        if (activeMapFilters.ubicacion && equipo.Ubicacion !== activeMapFilters.ubicacion) return;
        if (activeMapFilters.categoria && equipo.Categoria !== activeMapFilters.categoria) return;

        const allInputs = [
            ...db.conexiones.filter(c => c.ID_Destino === id && (!c.ID_Cable || !collapsedCables.has(c.ID_Cable))),
            ...directEdges.filter(e => e.target === id)
        ];
        const allOutputs = [
            ...db.conexiones.filter(c => c.ID_Origen === id && (!c.ID_Cable || !collapsedCables.has(c.ID_Cable))),
            ...directEdges.filter(e => e.source === id)
        ];

        const ports = [];
        allInputs.forEach((conn, i) => {
            const pid = (conn.ID_Patch || conn.id) + '-in';
            if (globalPortIds.has(pid)) return;
            globalPortIds.add(pid);
            const group = i < Math.ceil(allInputs.length / 2) ? 'in-left' : 'in-top';
            ports.push({
                id: pid, group,
                attrs: {
                    portShape: { fill: stateColor(conn.Estado || conn.status) },
                    portLabel: { text: conn.Puerto_Destino || conn.portDst || '' }
                },
                data: { connId: conn.ID_Patch || conn.id?.replace('edge-', '') }
            });
        });
        allOutputs.forEach((conn, i) => {
            const pid = (conn.ID_Patch || conn.id) + '-out';
            if (globalPortIds.has(pid)) return;
            globalPortIds.add(pid);
            const group = i < Math.ceil(allOutputs.length / 2) ? 'out-right' : 'out-bottom';
            ports.push({
                id: pid, group,
                attrs: {
                    portShape: { fill: stateColor(conn.Estado || conn.status) },
                    portLabel: { text: conn.Puerto_Origen || conn.portSrc || '' }
                },
                data: { connId: conn.ID_Patch || conn.id?.replace('edge-', '') }
            });
        });

        x6Graph.addNode({
            id, shape: 'rect', width: Math.max(120, 80 + ports.length * 8), height: 60,
            label: equipo.Nombre, zIndex: 1,
            ports: { groups: PORT_GROUPS, items: ports },
            data: { type: 'equipo', item: equipo },
            attrs: {
                body: { fill: '#161b22', stroke: 'var(--accent-cyan)', strokeWidth: 2, rx: 8, ry: 8 },
                label: { fill: '#fff', fontSize: 11, fontFamily: 'Outfit', fontWeight: 'bold' }
            }
        });
    });

    // 7 — Cable hub nodes (non-collapsed cables with 3+ connections)
    db.cables.forEach(cable => {
        const id = cable.ID_Cable;
        if (collapsedCables.has(id)) return;
        if (activeMapFilters.ubicacion && cable.Ubicacion !== activeMapFilters.ubicacion) return;

        const cableConns = db.conexiones.filter(c => c.ID_Origen === id || c.ID_Destino === id);
        if (cableConns.length === 0) return;
        
        const sc = getSignalColor(cableConns[0]?.Tipo_Senial);
        const ports = [];
        cableConns.forEach(c => {
            const pid = c.ID_Patch + (c.ID_Origen === id ? '-out' : '-in');
            if (globalPortIds.has(pid)) return;
            globalPortIds.add(pid);
            ports.push({
                id: pid,
                group: c.ID_Origen === id ? 'out-right' : 'in-left',
                attrs: { portShape: { fill: stateColor(c.Estado) } }
            });
        });
        
        x6Graph.addNode({
            id, shape: 'ellipse', width: 40, height: 40,
            label: cable.Tipo || id, zIndex: 1,
            ports: { groups: PORT_GROUPS, items: ports },
            data: { type: 'cable', item: cable },
            attrs: {
                body: { fill: sc + '33', stroke: sc, strokeWidth: 2 },
                label: { fill: '#fff', fontSize: 8, fontFamily: 'Outfit' }
            }
        });
    });

    // 8 — Edges
    directEdges.forEach(edge => {
        if (activeMapFilters.signal && edge.signal !== activeMapFilters.signal) return;
        if (!x6Graph.getCellById(edge.source) || !x6Graph.getCellById(edge.target)) return;
        x6Graph.addEdge({
            id: edge.id,
            source: { cell: edge.source, port: edge.sourcePort },
            target: { cell: edge.target, port: edge.targetPort },
            router: { name: 'manhattan', args: { padding: 15 } },
            connector: { name: 'rounded', args: { radius: 10 } },
            data: { type: 'collapsed', edge },
            labels: [{ attrs: {
                label: { text: edge.signal || '', fill: '#fff', fontSize: 8, fontFamily: 'Outfit' },
                rect: { fill: '#0d1117', stroke: edge.color, strokeWidth: 1, rx: 4, ry: 4 }
            }}],
            attrs: { line: {
                stroke: edge.color, strokeWidth: 2,
                sourceMarker: { name: 'circle', r: 4, fill: stateColor(edge.status), stroke: 'none' },
                targetMarker: { name: 'block', size: 8, fill: stateColor(edge.status), stroke: 'none' }
            }}
        });
    });

    db.conexiones.forEach(conn => {
        if (collapsedCables.has(conn.ID_Cable)) return;
        if (activeMapFilters.signal && conn.Tipo_Senial !== activeMapFilters.signal) return;
        if (!x6Graph.getCellById(conn.ID_Origen) || !x6Graph.getCellById(conn.ID_Destino)) return;
        
        const color = getSignalColor(conn.Tipo_Senial);
        x6Graph.addEdge({
            id: conn.ID_Patch,
            source: { cell: conn.ID_Origen, port: conn.ID_Patch + '-out' },
            target: { cell: conn.ID_Destino, port: conn.ID_Patch + '-in' },
            router: { name: 'manhattan', args: { padding: 15 } },
            connector: { name: 'rounded', args: { radius: 10 } },
            data: { type: 'direct', conn },
            attrs: { line: {
                stroke: color, strokeWidth: 2,
                sourceMarker: { name: 'circle', r: 4, fill: stateColor(conn.Estado), stroke: 'none' },
                targetMarker: { name: 'block', size: 8, fill: stateColor(conn.Estado), stroke: 'none' }
            }}
        });
    });

    // 9 — Hierarchical ELK Layout
    const buildElkHierarchy = () => {
        // Classify nodes into location groups or flat (cross-location cables)
        const nodesByLoc = {};
        const flatNodes = [];
        
        x6Graph.getNodes().forEach(n => {
            if (n.id.startsWith('LOC_')) return; // skip container nodes themselves
            const loc = n.getData()?.item?.Ubicacion;
            
            let targetLoc = loc;
            // Cables that connect across locations should NOT be locked inside one container
            if (n.getData()?.type === 'cable') {
                const cableConns = db.conexiones.filter(c => c.ID_Origen === n.id || c.ID_Destino === n.id);
                const isCross = cableConns.some(c => {
                    const otherId = c.ID_Origen === n.id ? c.ID_Destino : c.ID_Origen;
                    const other = db.equipos.find(eq => eq.ID_Equipo === otherId) || db.cables.find(cb => cb.ID_Cable === otherId);
                    return other && other.Ubicacion && other.Ubicacion !== loc;
                });
                if (isCross) targetLoc = null;
            }

            if (targetLoc && locationNodes[targetLoc]) {
                if (!nodesByLoc[targetLoc]) nodesByLoc[targetLoc] = [];
                nodesByLoc[targetLoc].push(n);
            } else {
                flatNodes.push(n);
            }
        });

        const children = [];

        // Build compound nodes for each location
        Object.entries(nodesByLoc).forEach(([loc, nodes]) => {
            children.push({
                id: 'ELK_LOC_' + loc,
                layoutOptions: { 
                    'elk.padding': '[top=40,left=20,bottom=20,right=20]',
                    'elk.spacing.nodeNode': '40'
                },
                children: nodes.map(n => ({
                    id: n.id, width: n.getSize().width, height: n.getSize().height,
                    ports: (n.getPorts?.() || []).map(p => ({
                        id: p.id,
                        layoutOptions: { 'port.side': p.group?.startsWith('in') ? 'WEST' : 'EAST' }
                    }))
                }))
            });
        });

        // Flat nodes (cross-location cables, orphans)
        flatNodes.forEach(n => {
            children.push({
                id: n.id, width: n.getSize().width, height: n.getSize().height,
                ports: (n.getPorts?.() || []).map(p => ({
                    id: p.id,
                    layoutOptions: { 'port.side': p.group?.startsWith('in') ? 'WEST' : 'EAST' }
                }))
            });
        });

        // Build edges using PRIMITIVE format (source/target, not sources/targets)
        // All edges at root level for cross-hierarchy routing
        const elkEdges = [];
        x6Graph.getEdges().forEach(e => {
            const src = e.getSource();
            const tgt = e.getTarget();
            if (!src || !tgt) return;
            
            const edgeDef = { id: 'elk_' + e.id };
            
            // Use port if available, otherwise node
            if (src.port) {
                edgeDef.sources = [src.port];
            } else {
                edgeDef.sources = [src.cell || src];
            }
            if (tgt.port) {
                edgeDef.targets = [tgt.port];
            } else {
                edgeDef.targets = [tgt.cell || tgt];
            }
            
            elkEdges.push(edgeDef);
        });

        return {
            id: 'root',
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': 'RIGHT',
                'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
                'elk.padding': '[top=50,left=50,bottom=50,right=50]',
                'elk.spacing.componentComponent': '80',
                'elk.spacing.nodeNode': '40',
                'elk.layered.spacing.nodeNodeBetweenLayers': '100'
            },
            children,
            edges: elkEdges
        };
    };

    new ELK().layout(buildElkHierarchy()).then(layout => {
        // Apply positions from ELK to X6
        // ELK children coords are RELATIVE to their parent.
        // X6 coords are ABSOLUTE (canvas-global).
        // Strategy:
        //   1. Position containers at their absolute coords, set their size
        //   2. Position children at absolute coords (parent.x + child.x, parent.y + child.y)
        //   3. THEN call addChild() so dragging works as a group

        layout.children.forEach(item => {
            if (item.id.startsWith('ELK_LOC_')) {
                // This is a compound/container node
                const loc = item.id.replace('ELK_LOC_', '');
                const locNode = locationNodes[loc];
                if (!locNode) return;

                // Set container absolute position and computed size
                locNode.setPosition(item.x, item.y);
                locNode.setSize(item.width, item.height);

                // Position children using ABSOLUTE coords
                if (item.children) {
                    item.children.forEach(child => {
                        const node = x6Graph.getCellById(child.id);
                        if (!node) return;
                        // Convert ELK relative → X6 absolute
                        node.setPosition(item.x + child.x, item.y + child.y);
                        // Now establish parent-child relationship for group dragging
                        locNode.addChild(node);
                    });
                }
            } else {
                // Flat/orphan node — coords are already absolute (relative to root)
                const node = x6Graph.getCellById(item.id);
                if (node) node.setPosition(item.x, item.y);
            }
        });

        // Remove empty containers
        Object.values(locationNodes).forEach(ln => {
            if (!ln.getChildren() || ln.getChildren().length === 0) ln.remove();
        });

        x6Graph.zoomToFit({ padding: 100 });

    }).catch(err => {
        console.error('ELK layout failed:', err);
        // Fallback: simple grid layout so the map is at least visible
        let col = 0, row = 0;
        x6Graph.getNodes().forEach(n => {
            if (n.id.startsWith('LOC_')) { n.remove(); return; }
            n.setPosition(col * 250, row * 120);
            col++;
            if (col > 6) { col = 0; row++; }
        });
        x6Graph.zoomToFit({ padding: 80 });
    });

    // 10 — Events
    const tooltip = document.getElementById('mapTooltip');
    if (tooltip) {
        x6Graph.on('node:mouseenter', ({ node }) => {
            const d = node.getData();
            if (!d || node.id.startsWith('LOC_')) return;
            tooltip.innerHTML = d.type === 'equipo'
                ? `<b>${d.item.Nombre}</b><br><small>${d.item.Ubicacion || ''}</small>`
                : `<b>${d.item.Tipo || node.id}</b><br><small>Largo: ${d.item.Largo || '-'} | ${d.item.Categoria || '-'}</small>`;
            tooltip.style.display = 'block';
        });
        x6Graph.on('edge:mouseenter', ({ edge }) => {
            const d = edge.getData();
            if (d?.type !== 'collapsed') return;
            const e = d.edge;
            const sn = (db.equipos.find(eq => eq.ID_Equipo === e.source)||{}).Nombre || e.source;
            const dn = (db.equipos.find(eq => eq.ID_Equipo === e.target)||{}).Nombre || e.target;
            tooltip.innerHTML = `<b>${sn}</b> [${e.portSrc}] <span style="color:${e.color};font-weight:bold">→ ${e.cableLabel} →</span> [${e.portDst}] <b>${dn}</b>`;
            tooltip.style.display = 'block';
        });
        x6Graph.on('node:mouseleave edge:mouseleave', () => tooltip.style.display = 'none');
        document.getElementById('cy')?.addEventListener('mousemove', ev => {
            tooltip.style.left = (ev.clientX + 15) + 'px';
            tooltip.style.top  = (ev.clientY + 15) + 'px';
        });
    }

    x6Graph.on('node:click', ({ node }) => {
        const d = node.getData();
        if (!d || node.id.startsWith('LOC_')) return;
        document.getElementById('mapView').style.display = 'none';
        document.getElementById('resultsContainer').style.display = 'block';
        document.getElementById('activeModeDisplay').innerText = 'Operación';
        if (typeof currentMode !== 'undefined') currentMode = 'OPERACION';
        setTimeout(() => { 
            if (typeof searchInput !== 'undefined') searchInput.value = node.id;
            if (typeof renderResults === 'function') renderResults(node.id); 
        }, 50);
    });

    x6Graph.on('edge:click', ({ edge }) => {
        const d = edge.getData();
        if (!d) return;
        if (d.type === 'direct' && d.conn) {
            // Open the connection modal directly
            openConnectionModal(d.conn);
        } else if (d.type === 'collapsed' && d.edge) {
            // Open the cable detail view
            document.getElementById('mapView').style.display = 'none';
            document.getElementById('resultsContainer').style.display = 'block';
            document.getElementById('activeModeDisplay').innerText = 'Operación';
            if (typeof currentMode !== 'undefined') currentMode = 'OPERACION';
            setTimeout(() => { 
                if (typeof searchInput !== 'undefined') searchInput.value = d.edge.cableId;
                if (typeof renderResults === 'function') renderResults(d.edge.cableId); 
            }, 50);
        }
    });

    x6Graph.on('node:port:click', ({ node, port, e }) => {
        e.stopPropagation();
        const portData = node.getPort(port);
        const connId = portData?.data?.connId;
        if (connId) {
            const conn = db.conexiones.find(c => c.ID_Patch === connId);
            if (conn) openConnectionModal(conn);
        }
    });

    updateMapFilterUI();
}

function updateMapFilterUI() {
    const filterPanel = document.getElementById('mapFilterContent');
    const toggle = document.getElementById('mapFilterToggle');
    if (!filterPanel || !toggle) return;
    
    toggle.onclick = () => { filterPanel.style.display = filterPanel.style.display === 'none' ? 'block' : 'none'; };
    
    const signals = [...new Set(db.conexiones.map(c => c.Tipo_Senial))].filter(Boolean).sort();
    const locs = [...new Set([...db.equipos, ...db.cables].map(i => i.Ubicacion))].filter(Boolean).sort();
    const cats = [...new Set([...db.equipos, ...db.cables].map(i => i.Categoria))].filter(Boolean).sort();
    
    const filterSignal = document.getElementById('filterSignal');
    if (filterSignal) {
        filterSignal.innerHTML = `
            <label style="display:block; font-size:0.75rem; color:#888; margin-bottom:4px;">Señal</label>
            <select onchange="activeMapFilters.signal = this.value || null; renderMapTopology()" style="width:100%; background:#2a2a2a; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;">
                <option value="">Todas</option>${signals.map(s => `<option value="${s}" ${activeMapFilters.signal === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>`;
    }
    
    const filterUbicacion = document.getElementById('filterUbicacion');
    if (filterUbicacion) {
        filterUbicacion.innerHTML = `
            <label style="display:block; font-size:0.75rem; color:#888; margin-bottom:4px;">Ubicación</label>
            <select onchange="activeMapFilters.ubicacion = this.value || null; renderMapTopology()" style="width:100%; background:#2a2a2a; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;">
                <option value="">Todas</option>${locs.map(l => `<option value="${l}" ${activeMapFilters.ubicacion === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>`;
    }
    
    const filterCategoria = document.getElementById('filterCategoria');
    if (filterCategoria) {
        filterCategoria.innerHTML = `
            <label style="display:block; font-size:0.75rem; color:#888; margin-bottom:4px;">Categoría</label>
            <select onchange="activeMapFilters.categoria = this.value || null; renderMapTopology()" style="width:100%; background:#2a2a2a; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;">
                <option value="">Todas</option>${cats.map(c => `<option value="${c}" ${activeMapFilters.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>`;
    }
}

function clearMapFilters() { 
    activeMapFilters = { signal: null, ubicacion: null, categoria: null }; 
    renderMapTopology(); 
}

function verEnMapa(id) {
    if (typeof setMode === 'function') setMode('MAPA');
    if (x6Graph) setTimeout(() => {
        const cell = x6Graph.getCellById(id);
        if (cell) { x6Graph.centerCell(cell); x6Graph.zoom(1.5); }
    }, 150);
}
