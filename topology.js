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
let activeMapFilters = { signal: null, ubicacion: null, categoria: null, showDisconnected: false, directLines: false };

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
                    portSrcCable: entrada.Puerto_Destino, portDstCable: salida.Puerto_Origen,
                    cableId: cable.ID_Cable,
                    cableLabel: cable.Tipo || '',
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
        panning: { enabled: true },
        mousewheel: { enabled: true, modifiers: null, minScale: 0.1, maxScale: 5 },
        interacting: false,
        connecting: { enabled: false }
    });

    // Manual Pinch-to-Zoom for Mobile
    let initialDist = 0;
    container.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            initialDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        }
    }, { passive: false });
    container.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && initialDist > 0) {
            e.preventDefault();
            const currentDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            const diff = currentDist - initialDist;
            if (Math.abs(diff) > 2) {
                const factor = diff > 0 ? 0.04 : -0.04;
                x6Graph.zoom(factor);
                initialDist = currentDist;
            }
        }
    }, { passive: false });
    container.addEventListener('touchend', () => { initialDist = 0; });

    // 4 — Port groups (Square shape, border color)
    const PORT_GROUPS = {
        'in-left': {
            position: 'left',
            markup: [{ tagName: 'rect', selector: 'portShape' }, { tagName: 'text', selector: 'portLabel' }],
            attrs: {
                portShape: { width: 8, height: 8, x: -4, y: -4, fill: '#161b22', stroke: 'var(--accent-cyan)', strokeWidth: 1 },
                portLabel: { fontSize: 8, fill: '#ccc', textAnchor: 'start', refX: 8, refY: 3 }
            }
        },
        'out-right': {
            position: 'right',
            markup: [{ tagName: 'rect', selector: 'portShape' }, { tagName: 'text', selector: 'portLabel' }],
            attrs: {
                portShape: { width: 8, height: 8, x: -4, y: -4, fill: '#161b22', stroke: 'var(--accent-cyan)', strokeWidth: 1 },
                portLabel: { fontSize: 8, fill: '#ccc', textAnchor: 'end', refX: -8, refY: 3 }
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
        
        let hash = 0;
        for (let i = 0; i < loc.length; i++) { hash = loc.charCodeAt(i) + ((hash << 5) - hash); }
        const hue = Math.abs(hash % 360);
        const locColor = `hsl(${hue}, 70%, 60%)`;
        const locBg = `hsla(${hue}, 70%, 60%, 0.05)`;

        locationNodes[loc] = x6Graph.addNode({
            id: 'LOC_' + loc, shape: 'rect', x: 0, y: 0, width: 100, height: 100,
            label: loc, zIndex: 0,
            attrs: {
                body: { fill: locBg, stroke: locColor, strokeDasharray: '6,3', rx: 12, ry: 12 },
                label: { fill: locColor, fontSize: 13, fontFamily: 'Outfit', fontWeight: 'bold',
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
            ...db.conexiones.filter(c => c.ID_Destino === id && !collapsedCables.has(c.ID_Origen) && !collapsedCables.has(c.ID_Destino)),
            ...directEdges.filter(e => e.target === id)
        ];
        const allOutputs = [
            ...db.conexiones.filter(c => c.ID_Origen === id && !collapsedCables.has(c.ID_Origen) && !collapsedCables.has(c.ID_Destino)),
            ...directEdges.filter(e => e.source === id)
        ];

        // Do not render completely disconnected equipment unless forced
        if (!activeMapFilters.showDisconnected && allInputs.length === 0 && allOutputs.length === 0) return;

        const ports = [];
        allInputs.forEach((conn, i) => {
            const pid = conn.targetPort || ((conn.ID_Patch || conn.id) + '-in');
            if (globalPortIds.has(pid)) return;
            globalPortIds.add(pid);
            ports.push({
                id: pid, group: 'in-left',
                attrs: {
                    portLabel: { text: conn.Puerto_Destino || conn.portDst || '' }
                },
                data: { connId: conn.ID_Patch || conn.id?.replace('edge-', '') }
            });
        });
        allOutputs.forEach((conn, i) => {
            const pid = conn.sourcePort || ((conn.ID_Patch || conn.id) + '-out');
            if (globalPortIds.has(pid)) return;
            globalPortIds.add(pid);
            ports.push({
                id: pid, group: 'out-right',
                attrs: {
                    portLabel: { text: conn.Puerto_Origen || conn.portSrc || '' }
                },
                data: { connId: conn.ID_Patch || conn.id?.replace('edge-', '') }
            });
        });

        const maxPorts = Math.max(allInputs.length, allOutputs.length);
        const dynamicHeight = Math.max(50, maxPorts * 16 + 20);

        x6Graph.addNode({
            id, shape: 'rect', width: 160, height: dynamicHeight,
            label: equipo.Nombre, zIndex: 1,
            ports: { groups: PORT_GROUPS, items: ports },
            data: { type: 'equipo', item: equipo },
            attrs: {
                body: { fill: '#161b22', stroke: 'var(--accent-cyan)', strokeWidth: 2, rx: 8, ry: 8 },
                label: { fill: '#fff', fontSize: 11, fontFamily: 'Outfit', fontWeight: 'bold', textWrap: { width: -20, height: -10, ellipsis: true } }
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
                attrs: { portLabel: { text: '' } }
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
            router: activeMapFilters.directLines ? { name: 'normal' } : { 
                name: 'metro', 
                args: { 
                    excludeNodes: Object.values(locationNodes),
                    startDirections: ['right'], 
                    endDirections: ['left']
                } 
            },
            connector: { name: 'rounded', args: { radius: 10 } },
            data: { type: 'collapsed', edge },
            labels: [
                { position: { distance: 20, offset: -8 }, attrs: { label: { text: edge.portSrcCable || '', fill: '#aaa', fontSize: 7, fontFamily: 'Outfit' }, rect: { fill: 'transparent', stroke: 'none' } } },
                { position: { distance: 0.5, offset: -8 }, attrs: { label: { text: edge.cableLabel || '', fill: edge.color, fontSize: 8, fontFamily: 'Outfit' }, rect: { fill: 'transparent', stroke: 'none' } } },
                { position: { distance: -20, offset: -8 }, attrs: { label: { text: edge.portDstCable || '', fill: '#aaa', fontSize: 7, fontFamily: 'Outfit' }, rect: { fill: 'transparent', stroke: 'none' } } }
            ],
            attrs: {
                line: {
                    stroke: edge.color, strokeWidth: 2,
                    sourceMarker: { name: 'circle', r: 4, fill: stateColor(edge.status), stroke: 'none' },
                    targetMarker: { name: 'block', size: 8, fill: stateColor(edge.status), stroke: 'none' }
                }
            }
        });
    });

    db.conexiones.forEach(conn => {
        if (collapsedCables.has(conn.ID_Cable)) return;
        if (activeMapFilters.signal && conn.Tipo_Senial !== activeMapFilters.signal) return;
        if (!x6Graph.getCellById(conn.ID_Origen) || !x6Graph.getCellById(conn.ID_Destino)) return;
        
        const color = getSignalColor(conn.Tipo_Senial);
        const isSrcEq = db.equipos.some(e => e.ID_Equipo === conn.ID_Origen);
        const cablePortStr = isSrcEq ? conn.Puerto_Destino : conn.Puerto_Origen;
        const lblPos = isSrcEq ? 20 : -20;

        x6Graph.addEdge({
            id: conn.ID_Patch,
            source: { cell: conn.ID_Origen, port: conn.ID_Patch + '-out' },
            target: { cell: conn.ID_Destino, port: conn.ID_Patch + '-in' },
            router: activeMapFilters.directLines ? { name: 'normal' } : { 
                name: 'metro', 
                args: { 
                    excludeNodes: Object.values(locationNodes),
                    startDirections: ['right'], 
                    endDirections: ['left']
                } 
            },
            connector: { name: 'rounded', args: { radius: 10 } },
            data: { type: 'direct', conn },
            labels: [
                { position: { distance: lblPos, offset: -8 }, attrs: { label: { text: cablePortStr || '', fill: '#aaa', fontSize: 7, fontFamily: 'Outfit' }, rect: { fill: 'transparent', stroke: 'none' } } }
            ],
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
                    'elk.padding': '[top=40,left=40,bottom=40,right=40]',
                    'elk.spacing.nodeNode': '60',
                    'elk.layered.spacing.nodeNodeBetweenLayers': '175',
                    'elk.edgeRouting': 'ORTHOGONAL'
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
            
            const edgeDef = { id: e.id };
            
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
                'elk.padding': '[top=30,left=30,bottom=30,right=30]',
                'elk.spacing.componentComponent': '80',
                'elk.spacing.nodeNode': '100',
                'elk.layered.spacing.nodeNodeBetweenLayers': '175',
                'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
                'elk.edgeRouting': 'ORTHOGONAL'
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
        
        let cableIdToOpen = null;
        if (d.type === 'direct' && d.conn) {
            cableIdToOpen = d.conn.ID_Cable;
        } else if (d.type === 'collapsed' && d.edge) {
            cableIdToOpen = d.edge.cableId;
        }

        if (cableIdToOpen) {
            document.getElementById('mapView').style.display = 'none';
            document.getElementById('resultsContainer').style.display = 'block';
            document.getElementById('activeModeDisplay').innerText = 'Operación';
            if (typeof currentMode !== 'undefined') currentMode = 'OPERACION';
            setTimeout(() => { 
                if (typeof searchInput !== 'undefined') searchInput.value = cableIdToOpen;
                if (typeof renderResults === 'function') renderResults(cableIdToOpen); 
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
    const filterContent = document.getElementById('mapFilterContent');
    const toggle = document.getElementById('mapFilterToggle');
    if (!filterContent || !toggle) return;
    
    toggle.onclick = (e) => {
        e.stopPropagation();
        const isHidden = filterContent.style.display === 'none';
        filterContent.style.display = isHidden ? 'block' : 'none';
        toggle.style.background = isHidden ? 'var(--accent-cyan)' : 'rgba(22, 27, 34, 0.9)';
        toggle.style.color = isHidden ? '#000' : '#fff';
    };
    
    const signals = [...new Set(db.conexiones.map(c => c.Tipo_Senial))].filter(Boolean).sort();
    const locs = [...new Set([...db.equipos, ...db.cables].map(i => i.Ubicacion))].filter(Boolean).sort();
    const cats = [...new Set([...db.equipos, ...db.cables].map(i => i.Categoria))].filter(Boolean).sort();
    
    const filterSignal = document.getElementById('filterSignal');
    if (filterSignal) {
        filterSignal.innerHTML = `
            <label style="display:block; font-size:0.75rem; color:#888; margin-bottom:4px;">Señal</label>
            <select onchange="activeMapFilters.signal = this.value || null; renderMapTopology()" style="width:100%; background:#2a2a2a; color:#fff; border:1px solid #444; border-radius:4px; padding:8px; font-size:16px;">
                <option value="">Todas</option>${signals.map(s => `<option value="${s}" ${activeMapFilters.signal === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>`;
    }
    
    const filterUbicacion = document.getElementById('filterUbicacion');
    if (filterUbicacion) {
        filterUbicacion.innerHTML = `
            <label style="display:block; font-size:0.75rem; color:#888; margin-bottom:4px;">Ubicación</label>
            <select onchange="activeMapFilters.ubicacion = this.value || null; renderMapTopology()" style="width:100%; background:#2a2a2a; color:#fff; border:1px solid #444; border-radius:4px; padding:8px; font-size:16px;">
                <option value="">Todas</option>${locs.map(l => `<option value="${l}" ${activeMapFilters.ubicacion === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>`;
    }
    
    const filterCategoria = document.getElementById('filterCategoria');
    if (filterCategoria) {
        filterCategoria.innerHTML = `
            <label style="display:block; font-size:0.75rem; color:#888; margin-bottom:4px;">Categoría</label>
            <select onchange="activeMapFilters.categoria = this.value || null; renderMapTopology()" style="width:100%; background:#2a2a2a; color:#fff; border:1px solid #444; border-radius:4px; padding:8px; font-size:16px;">
                <option value="">Todas</option>${cats.map(c => `<option value="${c}" ${activeMapFilters.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>`;
    }

    const filterDisc = document.getElementById('filterDisconnected');
    if (filterDisc) {
        filterDisc.innerHTML = `
            <label style="display:flex; align-items:center; font-size:0.85rem; color:#ccc; cursor:pointer;">
                <input type="checkbox" onchange="activeMapFilters.showDisconnected = this.checked; renderMapTopology()" ${activeMapFilters.showDisconnected ? 'checked' : ''} style="margin-right:8px;">
                Mostrar sueltos
            </label>`;
    }

    const filterDirect = document.getElementById('filterDirectLines');
    if (filterDirect) {
        filterDirect.innerHTML = `
            <label style="display:flex; align-items:center; font-size:0.85rem; color:#ccc; cursor:pointer;">
                <input type="checkbox" onchange="activeMapFilters.directLines = this.checked; renderMapTopology()" ${activeMapFilters.directLines ? 'checked' : ''} style="margin-right:8px;">
                Líneas directas
            </label>`;
    }
}

function clearMapFilters() { 
    activeMapFilters = { signal: null, ubicacion: null, categoria: null, showDisconnected: false, directLines: false }; 
    renderMapTopology(); 
}

function verEnMapa(id) {
    if (typeof setMode === 'function') setMode('MAPA');
    if (x6Graph) setTimeout(() => {
        const cell = x6Graph.getCellById(id);
        if (cell) { x6Graph.centerCell(cell); x6Graph.zoom(1.5); }
    }, 150);
}
function zoomMap(factor) {
    if (x6Graph) {
        const currentZoom = x6Graph.zoom();
        x6Graph.zoom(factor);
    }
}

function resetMapZoom() {
    if (x6Graph) {
        x6Graph.zoomToFit({ padding: 40, maxScale: 1 });
        x6Graph.centerContent();
    }
}

function exportMapSVG() {
    const toast = (msg, type) => (typeof showToast === 'function' ? showToast(msg, type) : null);

    if (!x6Graph) { toast('Abrí primero el mapa', 'warning'); return; }

    const liveSvg = document.querySelector('#cy svg');
    if (!liveSvg) { toast('No se encontró el SVG del mapa', 'error'); return; }

    // 1. Bounding box del contenido en coords del modelo (antes de transformar)
    const bbox = x6Graph.getContentBBox();
    if (!bbox || !bbox.width || !bbox.height) {
        toast('El mapa está vacío', 'warning');
        return;
    }
    const padding = 24;
    const vbX = bbox.x - padding;
    const vbY = bbox.y - padding;
    const vbW = bbox.width + padding * 2;
    const vbH = bbox.height + padding * 2;

    // 2. Clonar y resetear el transform de pan/zoom para que el viewBox calce
    const clone = liveSvg.cloneNode(true);
    const viewport = clone.querySelector('.x6-graph-svg-viewport');
    if (viewport) viewport.removeAttribute('transform');

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    clone.setAttribute('width', vbW);
    clone.setAttribute('height', vbH);

    // 3. Resolver CSS variables (X6 las usa en stroke/fill — no se renderizan fuera del browser)
    const rootStyle = getComputedStyle(document.documentElement);
    const cssVars = [
        '--accent-cyan', '--accent-magenta', '--accent-purple',
        '--bg-color', '--card-bg', '--text-primary', '--text-secondary',
        '--success', '--warning', '--danger', '--border-color'
    ];
    let serialized = new XMLSerializer().serializeToString(clone);
    for (const v of cssVars) {
        const value = rootStyle.getPropertyValue(v).trim();
        if (!value) continue;
        const re = new RegExp(`var\\(\\s*${v}\\s*(?:,[^)]*)?\\)`, 'g');
        serialized = serialized.replace(re, value);
    }

    // 4. Re-parsear para inyectar fondo y embeber fuente
    const doc = new DOMParser().parseFromString(serialized, 'image/svg+xml');
    const root = doc.documentElement;

    const bgColor = (rootStyle.getPropertyValue('--bg-color').trim() || '#0d1117');
    const bgRect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', vbX);
    bgRect.setAttribute('y', vbY);
    bgRect.setAttribute('width', vbW);
    bgRect.setAttribute('height', vbH);
    bgRect.setAttribute('fill', bgColor);
    root.insertBefore(bgRect, root.firstChild);

    const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = "text { font-family: 'Roboto Condensed', 'Outfit', Arial, sans-serif; }";
    root.insertBefore(styleEl, root.firstChild);

    // 5. Serializar y descargar
    const finalSvg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'
        + '<!-- Generado por Circuito AV Tech -->\n'
        + new XMLSerializer().serializeToString(root);
    const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    a.href = url;
    a.download = `topologia-${stamp}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    toast('SVG exportado', 'success');
}
