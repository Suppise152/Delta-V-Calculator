// ─── Node positions ────────────────────────────────
const NODE_POSITIONS = {
    interplanetary: { x: 493, y: 488 },

    kerbol_orbit: { x: 215, y: 490 },
    kerbol_land: { x: 55, y: 490 },
    kerbol_label: { x: -25, y: 488 },

    moho_intercept: { x: 325, y: 401 },
    moho_orbit: { x: 185, y: 401 },
    moho_land: { x: 55, y: 401 },
    moho_label: { x: -10, y: 401 },

    eve_intercept: { x: 360, y: 333 },
    eve_orbit: { x: 200, y: 333 },
    eve_land: { x: 55, y: 333 },
    eve_label: { x: -5, y: 333 },

    gilly_intercept: { x: 280, y: 251 },
    gilly_orbit: { x: 165, y: 251 },
    gilly_land: { x: 75, y: 251 },
    gilly_label: { x: 0, y: 251 },

    kerbin_flyby: { x: 493, y: 570 },
    kerbin_orbit: { x: 493, y: 641 },
    kerbin_land: { x: 493, y: 712 },
    kerbin_label: { x: 470, y: 765 },

    mun_intercept: { x: 370, y: 606 },
    mun_orbit: { x: 260, y: 606 },
    mun_land: { x: 150, y: 606 },
    mun_label: { x: 95, y: 606 },

    minmus_intercept: { x: 616, y: 606 },
    minmus_orbit: { x: 725, y: 606 },
    minmus_land: { x: 835, y: 606 },
    minmus_label: { x: 870, y: 606 },

    duna_intercept: { x: 310, y: 171 },
    duna_orbit: { x: 170, y: 171 },
    duna_land: { x: 55, y: 171 },
    duna_label: { x: -15, y: 171 },

    ike_intercept: { x: 230, y: 90 },
    ike_orbit: { x: 155, y: 90 },
    ike_land: { x: 75, y: 90 },
    ike_label: { x: 10, y: 90 },

    dres_intercept: { x: 470, y: 189 },
    dres_orbit: { x: 240, y: 26 },
    dres_land: { x: 55, y: 26 },
    dres_label: { x: -10, y: 26 },

    jool_intercept: { x: 630, y: 256 },
    jool_orbit: { x: 880, y: 256 },
    jool_land: { x: 920, y: 355 },
    jool_label: { x: 950, y: 355 },

    laythe_intercept: { x: 880, y: 200 },
    laythe_orbit: { x: 910, y: 110 },
    laythe_land: { x: 910, y: 32 },
    laythe_label: { x: 890, y: -10 },

    vall_intercept: { x: 818, y: 180 },
    vall_orbit: { x: 836, y: 105 },
    vall_land: { x: 836, y: 32 },
    vall_label: { x: 816, y: -10 },

    tylo_intercept: { x: 756, y: 180 },
    tylo_orbit: { x: 756, y: 109 },
    tylo_land: { x: 756, y: 32 },
    tylo_label: { x: 736, y: -10 },

    bop_intercept: { x: 694, y: 180 },
    bop_orbit: { x: 678, y: 107 },
    bop_land: { x: 678, y: 32 },
    bop_label: { x: 668, y: -10 },

    pol_intercept: { x: 630, y: 200 },
    pol_orbit: { x: 600, y: 108 },
    pol_land: { x: 600, y: 32 },
    pol_label: { x: 590, y: -10 },

    eeloo_intercept: { x: 705, y: 490 },
    eeloo_orbit: { x: 825, y: 490 },
    eeloo_land: { x: 960, y: 490 },
    eeloo_label: { x: 1000, y: 490 },
};

const NODE_R = 20;
const NODE_R_HUB = 30;
const PATH_STROKE_W = 15;
const INDICATOR_HEIGHT = 18;
const INDICATOR_WIDTH = PATH_STROKE_W;
const SVG_NS = 'http://www.w3.org/2000/svg';

// ─── Module state ─────────────────────────────────────────────────────────────
let _bodies = null;
let _systemMeta = null;
let _centralBody = null;   // the star id (e.g. 'kerbol') — read from JSON meta
let _mapSvgEl = null;

// Default: set from JSON meta.originBody on initMap
let _pointA = { body: null, node: null };
let _pointB = { body: null, node: null };

let _overlayEls = [];
let _routeNodeEls = []; let _routePathEls = []; let _activeNodeEl = null;

// ─── Public API ──────────────────────────────────────────────────────────────

function initMap(systemData) {
    _bodies = {};
    _systemMeta = systemData.meta;
    _centralBody = systemData.meta.centralBody;   // 'kerbol' for stock
    systemData.bodies.forEach(b => { _bodies[b.id] = b; });

    // Default pointA: the origin body's land node (read from JSON meta)
    const originId = systemData.meta.originBody;
    const originBody = _bodies[originId];
    if (originBody) {
        const nodeKeys = Object.keys(originBody.nodes).filter(k => k !== 'comment');
        const landKey = nodeKeys.includes('land') ? 'land' : nodeKeys[nodeKeys.length - 1];
        _pointA = { body: originId, node: landKey };
    }
    _pointB = { body: null, node: null };

    const container = document.getElementById('map-container');
    const placeholder = document.getElementById('map-placeholder');
    if (placeholder) placeholder.remove();

    const existing = container.querySelector('svg');
    if (existing) existing.remove();

    const svg = _buildSVG(systemData);
    container.appendChild(svg);
    _mapSvgEl = svg;
}

function setPointA(bodyId, nodeKey) {
    _pointA = { body: bodyId, node: nodeKey };
    if (_pointB.body) refreshMapDisplay();
}

function setPointB(bodyId, nodeKey) {
    _pointB = { body: bodyId, node: nodeKey };
    refreshMapDisplay();
}

function refreshMapDisplay() {
    _clearActive();

    const roundTrip = document.getElementById('toggle1')?.checked ?? false;
    const returnOnly = document.getElementById('toggle4')?.checked ?? false;

    if (!_pointB.body) {
        const allNodes = _collectAerobrakeNodeIds();
        _activateAerobrakeIndicators(allNodes, allNodes, roundTrip, returnOnly);
        return;
    }

    if (_mapSvgEl) _mapSvgEl.classList.add('has-selection');

    // Mark terminal node (pointB)
    const termEl = document.getElementById(`node_${_pointB.body}_${_pointB.node}`);
    if (termEl) { termEl.classList.add('is-active'); _activeNodeEl = termEl; }

    // Collect full route: ordered array of segment IDs from pointA → pointB
    const routeData = _collectRoute();
    const segmentIds = routeData.segmentIds;
    const routeNodeIds = routeData.routeNodeIds;
    const aNodes = routeData.aNodes;
    const bNodes = routeData.bNodes;

    // Mark route nodes
    routeNodeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('is-route'); _routeNodeEls.push(el); }
    });

    // Mark IPS hub if route passes through it
    if (_routePassesThroughIPS()) {
        const hub = document.getElementById('node_interplanetary');
        if (hub) { hub.classList.add('is-route'); _routeNodeEls.push(hub); }
    }

    const pathsGroup = document.getElementById('map-paths');
    if (returnOnly) {
        _spawnOverlays(segmentIds, pathsGroup, 'return');
    } else if (roundTrip) {
        _spawnOverlays(segmentIds, pathsGroup, 'forward', true);
        _spawnOverlays(segmentIds, pathsGroup, 'return', true);
    } else {
        _spawnOverlays(segmentIds, pathsGroup, 'forward');
    }

    // Handle aerobrake indicators
    _activateAerobrakeIndicators(aNodes, bNodes, roundTrip, returnOnly);
}

// ─── SVG Construction ─────────────────────────────────────────────────────────

function _buildSVG(systemData) {
    const svg = _el('svg', {
        viewBox: '0 -25 1000 810',
        preserveAspectRatio: 'xMidYMid meet',
        class: 'dv-map',
    });

    const pathsGroup = _el('g', { class: 'map-paths', id: 'map-paths' });
    svg.appendChild(pathsGroup);
    const nodesGroup = _el('g', { class: 'map-nodes', id: 'map-nodes' });
    svg.appendChild(nodesGroup);
    const indicatorsGroup = _el('g', { class: 'aerobrake-indicators', id: 'aerobrake-indicators' });
    svg.appendChild(indicatorsGroup);

    systemData.bodies.forEach(body => {
        _drawBodyPaths(pathsGroup, body);
        _drawAerobrakeIndicators(indicatorsGroup, body);
        _drawBodyNodes(nodesGroup, body);
    });

    _drawHubNode(nodesGroup, systemData.meta);
    return svg;
}

function _drawHubNode(group, meta) {
    const pos = NODE_POSITIONS['interplanetary'];
    const colour = meta.interplanetaryNode?.mapColour || '#c8c8d4';
    const g = _el('g', { id: 'node_interplanetary', class: 'map-node map-node--hub' });
    g.appendChild(_el('circle', { cx: pos.x, cy: pos.y, r: NODE_R_HUB, stroke: colour, 'stroke-width': 2 }));
    const txt = _el('text', { x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    txt.textContent = 'IPS';
    g.appendChild(txt);
    group.appendChild(g);
}

// ─── Path Drawing ─────────────────────────────────────────────────────────────

function _drawBodyPaths(group, body) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const colour = body.mapColour || '#888888';

    for (let i = 0; i < nodeKeys.length - 1; i++) {
        const fromPos = NODE_POSITIONS[`${body.id}_${nodeKeys[i]}`];
        const toPos = NODE_POSITIONS[`${body.id}_${nodeKeys[i + 1]}`];
        if (!fromPos || !toPos) continue;
        group.appendChild(_el('line', {
            id: `path_${body.id}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
            class: 'map-path',
            x1: fromPos.x, y1: fromPos.y,
            x2: toPos.x, y2: toPos.y,
            stroke: colour, 'stroke-width': PATH_STROKE_W,
        }));
    }

    _drawTrunkLine(group, body, colour);
}

function _drawTrunkLine(group, body, colour) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const firstPos = NODE_POSITIONS[`${body.id}_${nodeKeys[0]}`];
    if (!firstPos) return;

    let originPos = null;

    if (!body.parent) {
        // The star itself — trunk from IPS to its orbit node
        originPos = NODE_POSITIONS['interplanetary'];
    } else if (body.parent === _centralBody) {
        // Direct child of the star (planet) — trunk from IPS
        originPos = NODE_POSITIONS['interplanetary'];
    } else {
        const parentBody = _bodies[body.parent];
        const parentKeys = parentBody ? Object.keys(parentBody.nodes).filter(k => k !== 'comment') : [];
        const orbitKey = parentKeys.includes('orbit') ? 'orbit' : parentKeys[0];

        if (body.parent === _pointA.body) {
            // If pointA is the host planet, its moon branches should connect
            // from the planet orbit node rather than from the flyby node.
            originPos = NODE_POSITIONS[`${body.parent}_${orbitKey}`];
        } else {
            const flybyKey = parentKeys.includes('flyby') ? 'flyby' : null;
            const interceptKey = parentKeys.includes('intercept') ? 'intercept' : null;
            const parentKey = flybyKey || interceptKey || orbitKey;
            if (parentKey) {
                originPos = NODE_POSITIONS[`${body.parent}_${parentKey}`];
            }
        }
    }

    if (!originPos) return;

    group.appendChild(_el('line', {
        id: `trunk_${body.id}`,
        class: 'map-path map-trunk',
        x1: originPos.x, y1: originPos.y,
        x2: firstPos.x, y2: firstPos.y,
        stroke: colour, 'stroke-width': PATH_STROKE_W,
    }));
}

// ─── Aerobrake Indicators ─────────────────────────────────────────────────────

function _drawAerobrakeIndicators(group, body) {
    if (!body.surface?.canAerobrake) return;

    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');

    nodeKeys.forEach((nodeKey, i) => {
        if (!['flyby', 'intercept', 'orbit', 'land'].includes(nodeKey)) return;

        const pos = NODE_POSITIONS[`${body.id}_${nodeKey}`];
        if (!pos) return;

        // Anchor first-node indicators to the trunk-facing segment so they
        // sit on the IPS side of the node. Deeper nodes use the previous
        // branch segment.
        let dirX, dirY;
        if (i === 0) {
            const trunkStart = _getTrunkStart(body);
            if (!trunkStart) return;
            dirX = pos.x - trunkStart.x;
            dirY = pos.y - trunkStart.y;
        } else {
            const prevPos = NODE_POSITIONS[`${body.id}_${nodeKeys[i - 1]}`];
            if (!prevPos) return;
            dirX = pos.x - prevPos.x;
            dirY = pos.y - prevPos.y;
        }

        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len === 0) return;

        dirX /= len;
        dirY /= len;

        const tipOffset = NODE_R + 1;
        const tipX = pos.x - dirX * tipOffset;
        const tipY = pos.y - dirY * tipOffset;
        const baseX = tipX - dirX * INDICATOR_HEIGHT;
        const baseY = tipY - dirY * INDICATOR_HEIGHT;

        // Perpendicular vector
        const perpX = -dirY * (INDICATOR_WIDTH / 2);
        const perpY = dirX * (INDICATOR_WIDTH / 2);

        // Triangle points: tip, base left, base right
        const points = [
            tipX, tipY,
            baseX + perpX, baseY + perpY,
            baseX - perpX, baseY - perpY
        ].join(' ');

        const poly = _el('polygon', {
            points: points,
            fill: 'white',
            class: 'aerobrake-indicator',
            id: `indicator_${body.id}_${nodeKey}`
        });

        group.appendChild(poly);
    });
}

function _getTrunkStart(body) {
    let originPos = null;

    if (!body.parent) {
        originPos = NODE_POSITIONS['interplanetary'];
    } else if (body.parent === _centralBody) {
        originPos = NODE_POSITIONS['interplanetary'];
    } else {
        const parentBody = _bodies[body.parent];
        const parentKeys = parentBody ? Object.keys(parentBody.nodes).filter(k => k !== 'comment') : [];
        const orbitKey = parentKeys.includes('orbit') ? 'orbit' : parentKeys[0];

        if (body.parent === _pointA.body) {
            originPos = NODE_POSITIONS[`${body.parent}_${orbitKey}`];
        } else {
            const flybyKey = parentKeys.includes('flyby') ? 'flyby' : null;
            const interceptKey = parentKeys.includes('intercept') ? 'intercept' : null;
            const parentKey = flybyKey || interceptKey || orbitKey;

            if (parentKey) {
                originPos = NODE_POSITIONS[`${body.parent}_${parentKey}`];
            }
        }
    }

    return originPos;
}

// ─── Node Drawing ─────────────────────────────────────────────────────────────

function _drawBodyNodes(group, body) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const colour = body.mapColour || '#888888';

    const labelPos = NODE_POSITIONS[`${body.id}_label`];
    if (labelPos) {
        const label = _el('text', {
            id: `label_${body.id}`, class: 'map-label',
            x: labelPos.x, y: labelPos.y,
            'text-anchor': 'start', 'dominant-baseline': 'middle',
        });
        label.textContent = body.label;
        group.appendChild(label);
    }

    nodeKeys.forEach(key => {
        const pos = NODE_POSITIONS[`${body.id}_${key}`];
        if (!pos) return;

        const hasGlow = _shouldGlowTerminalNode(body, key);
        const g = _el('g', {
            id: `node_${body.id}_${key}`,
            class: hasGlow ? 'map-node has-atmo-glow' : 'map-node',
        });
        if (hasGlow) g.style.setProperty('--node-glow-color', colour);

        g.addEventListener('click', () => {
            if (typeof onNodeClick === 'function') onNodeClick(body.id, key);
        });

        g.appendChild(_el('circle', { cx: pos.x, cy: pos.y, r: NODE_R, stroke: colour, 'stroke-width': 1.5 }));
        const txt = _el('text', { x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        txt.textContent = _nodeLabel(key);
        g.appendChild(txt);
        group.appendChild(g);
    });
}

// ─── Route Collection ─────────────────────────────────────────────────────────

function _collectBodyPath(bodyId, fromNode, toNode, segmentIds, routeNodeIds) {
    const body = _bodies[bodyId];
    if (!body) return;

    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const fromIdx = nodeKeys.indexOf(fromNode);
    const toIdx = nodeKeys.indexOf(toNode);
    if (fromIdx === -1 || toIdx === -1) return;

    const rangeStart = Math.min(fromIdx, toIdx);
    const rangeEnd = Math.max(fromIdx, toIdx);
    const sameDirection = fromIdx < toIdx;

    for (let i = rangeStart; i <= rangeEnd; i++) {
        routeNodeIds.push(`node_${bodyId}_${nodeKeys[i]}`);
    }
    for (let i = rangeStart; i < rangeEnd; i++) {
        segmentIds.push({
            id: `path_${bodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
            sameDirection,
        });
    }
}

function _collectRoute() {
    const pA = _pointA;
    const pB = _pointB;
    const segmentIds = [];
    const routeNodeIds = [];
    const aNodes = [];
    const bNodes = [];

    // Special case: pointB is IPS itself — collect trunk from pointA to IPS
    if (pB.body === 'interplanetary') {
        const aBody = _bodies[pA.body];
        const aKeys = aBody ? Object.keys(aBody.nodes).filter(k => k !== 'comment') : [];
        const aIdx = aKeys.indexOf(pA.node);

        // Nodes on pointA body from node[0] (IPS-proximal) to node[aIdx]
        for (let i = 0; i <= aIdx; i++) {
            const id = `node_${pA.body}_${aKeys[i]}`;
            routeNodeIds.push(id);
            aNodes.push(id);
        }
        // Branch segments from node[0] to node[aIdx]
        for (let i = 0; i < aIdx; i++) {
            segmentIds.push({
                id: `path_${pA.body}_${aKeys[i]}_${aKeys[i + 1]}`,
                sameDirection: false,
            });
        }
        // Trunk of pointA body (pointA → IPS)
        segmentIds.push({ id: `trunk_${pA.body}`, sameDirection: false });

        // If pointA is a moon, also include the walk from its planet to IPS
        const aPlanet = aBody?.parent;
        if (aPlanet && aPlanet !== _centralBody) {
            const planetBody = _bodies[aPlanet];
            const planetKeys = planetBody ? Object.keys(planetBody.nodes).filter(k => k !== 'comment') : [];
            const orbitKey = planetKeys.includes('orbit') ? 'orbit' : planetKeys[0];
            const orbitIdx = planetKeys.indexOf(orbitKey);
            for (let i = 0; i <= orbitIdx; i++) {
                const id = `node_${aPlanet}_${planetKeys[i]}`;
                routeNodeIds.push(id);
                aNodes.push(id);
            }
            for (let i = 0; i < orbitIdx; i++) {
                segmentIds.push({
                    id: `path_${aPlanet}_${planetKeys[i]}_${planetKeys[i + 1]}`,
                    sameDirection: false,
                });
            }
            segmentIds.push({ id: `trunk_${aPlanet}`, sameDirection: false });
        }

        // Add IPS hub itself
        routeNodeIds.push('node_interplanetary');
        bNodes.push('node_interplanetary');
        return { segmentIds, routeNodeIds, aNodes, bNodes };
    }

    // Same-body route is just the branch path between two nodes
    if (pA.body === pB.body) {
        _collectBodyPath(pA.body, pA.node, pB.node, segmentIds, routeNodeIds);

        // If pointB is an interplanetary node (flyby/intercept), also include trunk to IPS
        const aBody = _bodies[pA.body];
        const aKeys = aBody ? Object.keys(aBody.nodes).filter(k => k !== 'comment') : [];
        const flywayNodes = ['flyby', 'intercept'];
        if (flywayNodes.includes(pB.node)) {
            segmentIds.push({ id: `trunk_${pA.body}`, sameDirection: false });
            routeNodeIds.push('node_interplanetary');
        }
        // For same body, aNodes and bNodes are the same
        aNodes.push(...routeNodeIds);
        bNodes.push(...routeNodeIds);
        return { segmentIds, routeNodeIds, aNodes, bNodes };
    }

    // Find the lowest common ancestor (LCA) between pointA and pointB bodies
    const aChain = _ancestorChain(pA.body);  // [pA.body, parent, grandparent, ...]
    const bChain = _ancestorChain(pB.body);

    // Find where the chains first share an ancestor
    let lca = null;
    for (const ancestor of aChain) {
        if (bChain.includes(ancestor)) { lca = ancestor; break; }
    }
    // If no common ancestor found (different star systems in future), route through IPS
    if (!lca) lca = 'interplanetary';

    // ── Collect B-side: IPS/LCA → pointB ──────────────────────────────────
    // Walk from pointB body upward to LCA, collecting in reverse, then flip
    const bSegs = [];
    _walkToAncestor(pB.body, pB.node, lca, bSegs, bNodes);

    // ── Collect A-side: pointA → IPS/LCA ──────────────────────────────────
    const aSegs = [];

    if (pA.body !== lca) {
        const aBody = _bodies[pA.body];
        const aKeys = aBody ? Object.keys(aBody.nodes).filter(k => k !== 'comment') : [];
        const aIdx = aKeys.indexOf(pA.node);

        // Nodes on pointA body from node[0] (IPS-proximal) to node[aIdx]
        for (let i = 0; i <= aIdx; i++) {
            aNodes.push(`node_${pA.body}_${aKeys[i]}`);
        }
        // Branch segments from node[0] to node[aIdx]
        for (let i = 0; i < aIdx; i++) {
            aSegs.push({
                id: `path_${pA.body}_${aKeys[i]}_${aKeys[i + 1]}`,
                sameDirection: false,
            });
        }
        // Trunk of pointA body (pointA → LCA/IPS direction)
        aSegs.push({ id: `trunk_${pA.body}`, sameDirection: false });

        // If pointA is a moon, also include the walk from its planet to IPS
        // (but stop at LCA)
        const aPlanet = aBody?.parent;
        if (aPlanet && aPlanet !== _centralBody && aPlanet !== lca) {
            const planetBody = _bodies[aPlanet];
            const planetKeys = planetBody ? Object.keys(planetBody.nodes).filter(k => k !== 'comment') : [];
            const orbitKey = planetKeys.includes('orbit') ? 'orbit' : planetKeys[0];
            const orbitIdx = planetKeys.indexOf(orbitKey);
            for (let i = 0; i <= orbitIdx; i++) {
                aNodes.push(`node_${aPlanet}_${planetKeys[i]}`);
            }
            for (let i = 0; i < orbitIdx; i++) {
                aSegs.push({
                    id: `path_${aPlanet}_${planetKeys[i]}_${planetKeys[i + 1]}`,
                    sameDirection: false,
                });
            }
            aSegs.push({ id: `trunk_${aPlanet}`, sameDirection: false });
        }
    } else if (bChain.includes(pA.body) && pA.body !== pB.body) {
        const aBody = _bodies[pA.body];
        const aKeys = aBody ? Object.keys(aBody.nodes).filter(k => k !== 'comment') : [];
        const child = bChain[bChain.indexOf(pA.body) - 1];
        let exitNode = 'orbit';

        if (aBody && child) {
            exitNode = aKeys.includes('orbit') ? 'orbit' : aKeys[0];
        }

        _collectBodyPath(pA.body, pA.node, exitNode, aSegs, aNodes);
    }

    // ── Merge: A-side (IPS-outward order) + B-side (IPS-outward order) ────
    // A-side is already in IPS-outward order (node[0]→node[aIdx], then trunk)
    // B-side from _walkToAncestor is in reverse (pointB→LCA), so we flip it
    bSegs.reverse();
    bNodes.reverse();

    // Deduplicate while preserving order
    for (const seg of [...aSegs, ...bSegs]) {
        if (!segmentIds.some(existing => existing.id === seg.id)) segmentIds.push(seg);
    }
    for (const id of [...aNodes, ...bNodes]) {
        if (!routeNodeIds.includes(id)) routeNodeIds.push(id);
    }
    return { segmentIds, routeNodeIds, aNodes, bNodes };
}

/**
 * Walk from bodyId/nodeKey up toward ancestor, collecting segments in
 * bottom-up order (will be reversed by caller for IPS-outward display).
 */
function _walkToAncestor(bodyId, nodeKey, ancestor, segs, nodes) {
    if (bodyId === ancestor) return;
    const body = _bodies[bodyId];
    if (!body) return;

    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const targetIdx = nodeKeys.indexOf(nodeKey);
    if (targetIdx === -1) return;

    // Collect nodes from targetIdx down to 0 (bottom-up)
    for (let i = targetIdx; i >= 0; i--) {
        nodes.push(`node_${bodyId}_${nodeKeys[i]}`);
    }
    // Collect branch segments from targetIdx down to 0
    for (let i = targetIdx - 1; i >= 0; i--) {
        segs.push({
            id: `path_${bodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
            sameDirection: true,
        });
    }

    // Trunk of this body (connects to parent or IPS)
    if (body.parent || bodyId === _centralBody) {
        segs.push({ id: `trunk_${bodyId}`, sameDirection: true });
    }

    // Continue up the parent chain
    const parent = body.parent;
    if (!parent || parent === _centralBody) return;  // reached IPS level or star level

    const parentBody = _bodies[parent];
    if (!parentBody || parent === ancestor) return;

    // Determine the node on the parent to connect to.
    // If the parent is pointA.body, use its orbit node so same-host moon routes connect correctly.
    const parentKeys = Object.keys(parentBody.nodes).filter(k => k !== 'comment');
    const firstKey = parentKeys[0];
    const orbitKey = parentKeys.includes('orbit') ? 'orbit' : firstKey;
    const nextKey = parent === _pointA.body ? orbitKey : firstKey;
    _walkToAncestor(parent, nextKey, ancestor, segs, nodes);
}

/**
 * Returns the chain of ancestor body IDs from bodyId up to and including
 * the central body's direct children (planets).
 */
function _ancestorChain(bodyId) {
    const chain = [];
    let id = bodyId;
    while (id) {
        chain.push(id);
        const b = _bodies[id];
        if (!b || !b.parent || b.parent === _centralBody) break;
        id = b.parent;
    }
    return chain;
}

function _routePassesThroughIPS() {
    const aTop = _topLevelBody(_pointA.body);
    const bTop = _topLevelBody(_pointB.body);
    return aTop !== bTop;
}

function _topLevelBody(bodyId) {
    let b = _bodies[bodyId];
    while (b && b.parent && b.parent !== _centralBody) {
        b = _bodies[b.parent];
    }
    return b ? b.id : bodyId;
}

// ─── Overlay Spawning ─────────────────────────────────────────────────────────

/**
 * Clone base path segments and append animated overlays.
 * direction: 'forward' (A→B) | 'return' (B→A)
 * isRoundTrip: when true, offset each stream to opposite edges of the base path
 *              so the two directions are visually separated and clearly readable.
 *
 * Perpendicular offset: for each segment we compute the unit normal to the line,
 * then translate the overlay by ±LANE_OFFSET in that direction. Forward stream
 * goes to one edge, return stream to the other.
 *
 * Stagger: each overlay gets a negative animation-delay proportional to its index
 * so the dashes appear as a continuous stream rather than resetting all at once.
 */
function _spawnOverlays(segmentIds, pathsGroup, direction, isRoundTrip = false) {
    const DURATION = 0.9;
    const LANE_OFFSET = PATH_STROKE_W * 0.28;  // ~4px offset at stroke-width 15

    segmentIds.forEach((segment, i) => {
        const base = document.getElementById(segment.id);
        if (!base) return;

        if (!base.classList.contains('is-route')) {
            base.classList.add('is-route');
            _routePathEls.push(base);
        }

        const overlay = base.cloneNode(false);
        overlay.removeAttribute('id');
        overlay.classList.remove('map-path');
        overlay.classList.remove('map-trunk');
        overlay.classList.remove('is-route');
        overlay.classList.add('map-path-overlay');
        overlay.classList.add(direction === 'forward' ? 'is-active' : 'is-return');

        const travelForward = direction === 'forward' ? segment.sameDirection : !segment.sameDirection;
        overlay.classList.add(travelForward ? 'flow-forward' : 'flow-return');

        if (isRoundTrip) {
            // Compute the perpendicular unit normal for this segment
            const x1 = parseFloat(base.getAttribute('x1'));
            const y1 = parseFloat(base.getAttribute('y1'));
            const x2 = parseFloat(base.getAttribute('x2'));
            const y2 = parseFloat(base.getAttribute('y2'));

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;

            // Perpendicular unit vector: (-dy/len, dx/len)
            const nx = -dy / len;
            const ny = dx / len;

            // Forward route goes to one side (+), return route to the other (-)
            const sign = direction === 'forward' ? 1 : -1;
            const tx = nx * LANE_OFFSET * sign;
            const ty = ny * LANE_OFFSET * sign;

            overlay.setAttribute('transform', `translate(${tx.toFixed(2)}, ${ty.toFixed(2)})`);

            // Keep full stroke width but reduce slightly so lanes don't bleed outside base path
            const baseWidth = parseFloat(base.getAttribute('stroke-width')) || PATH_STROKE_W;
            overlay.setAttribute('stroke-width', (baseWidth * 0.55).toFixed(1));
        }

        // Stagger resets across the full duration — eliminates synchronised jitter
        const stagger = -(i / Math.max(segmentIds.length, 1)) * DURATION;
        overlay.style.animationDelay = `${stagger.toFixed(3)}s`;

        pathsGroup.appendChild(overlay);
        _overlayEls.push(overlay);
    });
}

// ─── Clear Active State ───────────────────────────────────────────────────────

function _clearActive() {
    if (_mapSvgEl) _mapSvgEl.classList.remove('has-selection');
    _overlayEls.forEach(el => el.remove());
    _overlayEls = [];
    _routeNodeEls.forEach(el => el.classList.remove('is-route'));
    _routeNodeEls = [];
    _routePathEls.forEach(el => el.classList.remove('is-route'));
    _routePathEls = [];
    document.querySelectorAll('.map-path.is-route').forEach(el => el.classList.remove('is-route'));
    if (_activeNodeEl) { _activeNodeEl.classList.remove('is-active'); _activeNodeEl = null; }
    // Clear aerobrake indicators
    const indicators = document.querySelectorAll('.aerobrake-indicator');
    indicators.forEach(el => el.classList.remove('is-active'));
}

function _activateAerobrakeIndicators(aNodes, bNodes, roundTrip, returnOnly) {
    const aerobrakeArrivalOrbit = document.getElementById('toggle2')?.checked ?? false;
    const aerobrakeArrivalIntercept = document.getElementById('toggle3')?.checked ?? false;
    const aerobrakeReturnOrbit = document.getElementById('toggle5')?.checked ?? false;
    const aerobrakeReturnIntercept = document.getElementById('toggle6')?.checked ?? false;

    const activeIndicators = [];

    // Arrival (B side)
    if (!returnOnly) {
        if (aerobrakeArrivalIntercept) {
            // all indicators on B branch
            bNodes.forEach(nodeId => {
                const parts = nodeId.split('_');
                const nodeKey = parts[2];
                if (['flyby', 'intercept', 'orbit', 'land'].includes(nodeKey)) {
                    activeIndicators.push(`indicator_${parts[1]}_${nodeKey}`);
                }
            });
        } else if (aerobrakeArrivalOrbit) {
            // only land on B branch
            bNodes.forEach(nodeId => {
                const parts = nodeId.split('_');
                const nodeKey = parts[2];
                if (nodeKey === 'land') {
                    activeIndicators.push(`indicator_${parts[1]}_${nodeKey}`);
                }
            });
        }
    }

    // Origin / return (A side)
    if (roundTrip || returnOnly) {
        if (aerobrakeReturnIntercept) {
            // all indicators on A branch
            aNodes.forEach(nodeId => {
                const parts = nodeId.split('_');
                const nodeKey = parts[2];
                if (['flyby', 'intercept', 'orbit', 'land'].includes(nodeKey)) {
                    activeIndicators.push(`indicator_${parts[1]}_${nodeKey}`);
                }
            });
        } else if (aerobrakeReturnOrbit) {
            // only land on A branch
            aNodes.forEach(nodeId => {
                const parts = nodeId.split('_');
                const nodeKey = parts[2];
                if (nodeKey === 'land') {
                    activeIndicators.push(`indicator_${parts[1]}_${nodeKey}`);
                }
            });
        }
    }

    // Activate the indicators
    activeIndicators.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('is-active');
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _collectAerobrakeNodeIds() {
    const nodeIds = [];

    Object.values(_bodies || {}).forEach(body => {
        if (!body?.surface?.canAerobrake) return;

        Object.keys(body.nodes)
            .filter(key => key !== 'comment' && ['flyby', 'intercept', 'orbit', 'land'].includes(key))
            .forEach(key => nodeIds.push(`node_${body.id}_${key}`));
    });

    return nodeIds;
}

function _el(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

function _nodeLabel(key) {
    return { intercept: 'Fly-by', flyby: 'Fly-by', orbit: 'Orbit', land: 'Land', escape: 'Escape' }[key] || key;
}

function _shouldGlowTerminalNode(body, nodeKey) {
    if (!body.surface?.canAerobrake) return false;
    return nodeKey === 'land';
}

// Legacy alias
function setActiveNode(bodyId, nodeKey) { setPointB(bodyId, nodeKey); }

// Allow ui.js to read the loaded pack metadata without reaching into private state
function getSystemMeta() { return _systemMeta; }
function getBodies() { return _bodies; }
function getSelectedPoints() {
    return {
        pointA: { ..._pointA },
        pointB: { ..._pointB },
    };
}
