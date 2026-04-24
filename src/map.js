/**
 * map.js — SVG map renderer
 * Fully data-driven. No hardcoded body references.
 *
 * Point A / Point B architecture:
 *   pointA — origin (defaults to 'interplanetary', set to 'kerbin'+'orbit' when LKO active)
 *   pointB — destination (set by node click)
 *
 * For v2.0, pointA.body is always 'interplanetary' or 'kerbin'.
 * v2.1 will allow any body as pointA.
 */

// ─── Node positions (ViewBox: 0 -25 1450 810) ─────────────────────────────────
const NODE_POSITIONS = {
    // ── Interplanetary hub ──────────────────────────────────────────────────
    interplanetary: { x: 493, y: 488 },  // central hub, replaces kerbin_escape

    // ── Kerbol ──────────────────────────────────────────────────────────────
    kerbol_orbit: { x: 215, y: 490 },
    kerbol_land: { x: 55, y: 490 },
    kerbol_label: { x: 10, y: 488 },

    // ── Moho ────────────────────────────────────────────────────────────────
    moho_intercept: { x: 325, y: 401 },
    moho_orbit: { x: 185, y: 401 },
    moho_land: { x: 55, y: 401 },
    moho_label: { x: 15, y: 401 },

    // ── Eve ─────────────────────────────────────────────────────────────────
    eve_intercept: { x: 360, y: 333 },
    eve_orbit: { x: 200, y: 333 },
    eve_land: { x: 55, y: 333 },
    eve_label: { x: 25, y: 333 },

    // ── Gilly ───────────────────────────────────────────────────────────────
    gilly_intercept: { x: 280, y: 251 },
    gilly_orbit: { x: 165, y: 251 },
    gilly_land: { x: 55, y: 251 },
    gilly_label: { x: 10, y: 254 },

    // ── Kerbin ──────────────────────────────────────────────────────────────
    // Branch runs downward from interplanetary hub
    kerbin_flyby: { x: 493, y: 570 },
    kerbin_orbit: { x: 493, y: 641 },
    kerbin_land: { x: 493, y: 712 },
    kerbin_label: { x: 505, y: 736 },

    // ── Mun ─────────────────────────────────────────────────────────────────
    mun_intercept: { x: 360, y: 579 },
    mun_orbit: { x: 195, y: 579 },
    mun_land: { x: 55, y: 579 },
    mun_label: { x: 20, y: 575 },

    // ── Minmus ──────────────────────────────────────────────────────────────
    minmus_intercept: { x: 615, y: 580 },
    minmus_orbit: { x: 770, y: 579 },
    minmus_land: { x: 940, y: 579 },
    minmus_label: { x: 930, y: 615 },

    // ── Duna ────────────────────────────────────────────────────────────────
    duna_intercept: { x: 290, y: 171 },
    duna_orbit: { x: 170, y: 171 },
    duna_land: { x: 55, y: 171 },
    duna_label: { x: 15, y: 175 },

    // ── Ike ─────────────────────────────────────────────────────────────────
    ike_intercept: { x: 290, y: 125 },
    ike_orbit: { x: 205, y: 82 },
    ike_land: { x: 55, y: 82 },
    ike_label: { x: 20, y: 90 },

    // ── Dres ────────────────────────────────────────────────────────────────
    dres_intercept: { x: 470, y: 189 },
    dres_orbit: { x: 240, y: 26 },
    dres_land: { x: 55, y: 26 },
    dres_label: { x: 15, y: 36 },

    // ── Jool ────────────────────────────────────────────────────────────────
    jool_intercept: { x: 730, y: 256 },
    jool_orbit: { x: 880, y: 286 },
    jool_land: { x: 920, y: 376 },
    jool_label: { x: 920, y: 432 },

    // ── Laythe ──────────────────────────────────────────────────────────────
    laythe_intercept: { x: 815, y: 203 },
    laythe_orbit: { x: 955, y: 110 },
    laythe_land: { x: 970, y: 32 },
    laythe_label: { x: 950, y: 10 },

    // ── Vall ────────────────────────────────────────────────────────────────
    vall_intercept: { x: 770, y: 159 },
    vall_orbit: { x: 850, y: 105 },
    vall_land: { x: 865, y: 32 },
    vall_label: { x: 855, y: 10 },

    // ── Tylo ────────────────────────────────────────────────────────────────
    tylo_intercept: { x: 725, y: 192 },
    tylo_orbit: { x: 725, y: 109 },
    tylo_land: { x: 725, y: 32 },
    tylo_label: { x: 715, y: 10 },

    // ── Bop ─────────────────────────────────────────────────────────────────
    bop_intercept: { x: 680, y: 153 },
    bop_orbit: { x: 620, y: 107 },
    bop_land: { x: 610, y: 32 },
    bop_label: { x: 600, y: 10 },

    // ── Pol ─────────────────────────────────────────────────────────────────
    pol_intercept: { x: 650, y: 203 },
    pol_orbit: { x: 500, y: 108 },
    pol_land: { x: 495, y: 32 },
    pol_label: { x: 485, y: 10 },

    // ── Eeloo ───────────────────────────────────────────────────────────────
    eeloo_intercept: { x: 705, y: 490 },
    eeloo_orbit: { x: 825, y: 490 },
    eeloo_land: { x: 960, y: 490 },
    eeloo_label: { x: 950, y: 527 },
};

const NODE_R = 20;
const NODE_R_HUB = 30;   // interplanetary hub is larger
const PATH_STROKE_W = 15;
const SVG_NS = 'http://www.w3.org/2000/svg';

// ─── Module state ─────────────────────────────────────────────────────────────
let _bodies = null;
let _systemMeta = null;
let _mapSvgEl = null;

let _pointA = { body: 'duna', node: 'land' };
let _pointB = { body: null, node: null };

// Active display elements (cleared on each redraw)
let _activePaths = [];   // outbound path elements
let _returnPaths = [];   // return path elements (round trip)
let _activeNodes = [];   // all nodes on the active route
let _activeNodeEl = null; // the selected terminal node (pointB)

// ─── Public API ──────────────────────────────────────────────────────────────

function initMap(systemData) {
    _bodies = {};
    _systemMeta = systemData.meta;
    systemData.bodies.forEach(b => { _bodies[b.id] = b; });

    const container = document.getElementById('map-container');
    const placeholder = document.getElementById('map-placeholder');
    if (placeholder) placeholder.remove();

    const existing = container.querySelector('svg');
    if (existing) existing.remove();

    const svg = _buildSVG(systemData);
    container.appendChild(svg);
    _mapSvgEl = svg;
}

/**
 * Set pointA — the origin of the route.
 * Called by ui.js when LKO checkbox changes or in v2.1 when user picks a custom origin.
 * @param {string} bodyId  — 'interplanetary' or a body id
 * @param {string|null} nodeKey
 */
function setPointA(bodyId, nodeKey) {
    _pointA = { body: bodyId, node: nodeKey };
    // Update trunk positions for moons based on new point A
    for (const body of Object.values(_bodies)) {
        if (body.parent) {
            const trunk = document.getElementById(`trunk_${body.id}`);
            if (trunk) {
                let originPos = null;
                if (body.parent === _pointA.body) {
                    // Use orbit of parent
                    const parentBody = _bodies[body.parent];
                    if (parentBody) {
                        const parentNodes = Object.keys(parentBody.nodes).filter(k => k !== 'comment');
                        const orbitIndex = parentNodes.indexOf('orbit');
                        if (orbitIndex !== -1) {
                            originPos = NODE_POSITIONS[`${body.parent}_${parentNodes[orbitIndex]}`];
                        }
                    }
                } else if (body.parent === 'kerbol') {
                    originPos = NODE_POSITIONS['interplanetary'];
                } else {
                    // Use first node of parent
                    const pBody = _bodies[body.parent];
                    if (pBody) {
                        const pNodes = Object.keys(pBody.nodes).filter(k => k !== 'comment');
                        if (pNodes[0]) {
                            originPos = NODE_POSITIONS[`${body.parent}_${pNodes[0]}`];
                        }
                    }
                }
                if (originPos) {
                    trunk.setAttribute('x1', originPos.x);
                    trunk.setAttribute('y1', originPos.y);
                }
            }
        }
    }
    // Redraw if we already have a destination
    if (_pointB.body) refreshMapDisplay();
}

/**
 * Set pointB — the destination. Called when user clicks a node.
 * @param {string} bodyId
 * @param {string} nodeKey
 */
function setPointB(bodyId, nodeKey) {
    _pointB = { body: bodyId, node: nodeKey };
    refreshMapDisplay();
}

/**
 * Refresh the map display — re-evaluates pointA/pointB plus current toggle states.
 * Called by ui.js whenever toggles change.
 */
function refreshMapDisplay() {
    _clearActive();
    if (!_pointB.body) return;

    const roundTrip = document.getElementById('toggle1')?.checked ?? false;
    const returnOnly = document.getElementById('toggle4')?.checked ?? false;

    if (_mapSvgEl) _mapSvgEl.classList.add('has-selection');

    // Highlight selected terminal node
    const termEl = document.getElementById(`node_${_pointB.body}_${_pointB.node}`);
    if (termEl) {
        termEl.classList.add('is-active');
        _activeNodeEl = termEl;
    }

    if (returnOnly) {
        // Return only: animate path from pointB back to pointA (reverse direction)
        _buildReturnPath(_pointB.body, _pointB.node);
    } else {
        // Outbound path always drawn (one-way or round trip)
        _buildOutboundPath(_pointB.body, _pointB.node);
        if (roundTrip) {
            // Round trip: also draw the return path
            _buildReturnPath(_pointB.body, _pointB.node);
        }
    }
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

    // Draw bodies
    systemData.bodies.forEach(body => {
        _drawBodyPaths(pathsGroup, body);
        _drawBodyNodes(nodesGroup, body);
    });

    // Draw interplanetary hub last so it sits on top
    _drawHubNode(nodesGroup, systemData.meta);

    return svg;
}

// ─── Hub Node ─────────────────────────────────────────────────────────────────

function _drawHubNode(group, meta) {
    const pos = NODE_POSITIONS['interplanetary'];
    if (!pos) return;
    const colour = meta.interplanetaryNode?.mapColour || '#c8c8d4';

    const nodeGroup = _el('g', {
        id: 'node_interplanetary',
        class: 'map-node map-node--hub',
    });

    nodeGroup.appendChild(_el('circle', {
        cx: pos.x, cy: pos.y, r: NODE_R_HUB,
        stroke: colour, 'stroke-width': 2,
    }));

    const txt = _el('text', {
        x: pos.x, y: pos.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
    });
    txt.textContent = 'IPS';
    nodeGroup.appendChild(txt);

    group.appendChild(nodeGroup);
}

// ─── Path Drawing ─────────────────────────────────────────────────────────────

function _drawBodyPaths(group, body) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const colour = body.mapColour || '#888888';

    // Branch segments between consecutive nodes
    for (let i = 0; i < nodeKeys.length - 1; i++) {
        const fromPos = NODE_POSITIONS[`${body.id}_${nodeKeys[i]}`];
        const toPos = NODE_POSITIONS[`${body.id}_${nodeKeys[i + 1]}`];
        if (!fromPos || !toPos) continue;

        group.appendChild(_el('line', {
            id: `path_${body.id}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
            class: 'map-path',
            x1: fromPos.x, y1: fromPos.y,
            x2: toPos.x, y2: toPos.y,
            stroke: colour,
            'stroke-width': PATH_STROKE_W,
        }));
    }

    _drawTrunkLine(group, body, colour);
}

function _drawTrunkLine(group, body, colour) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    // Kerbin's first node toward the hub is 'flyby'
    const firstKey = nodeKeys[0];
    const firstPos = NODE_POSITIONS[`${body.id}_${firstKey}`];
    if (!firstPos) return;

    let originPos = null;
    let strokeColour = colour;

    if (body.id === 'kerbol') {
        originPos = NODE_POSITIONS['interplanetary'];
        strokeColour = colour;
    } else if (body.parent === _pointA.body) {
        // Use orbit of parent
        const parentBody = _bodies[body.parent];
        if (parentBody) {
            const parentNodes = Object.keys(parentBody.nodes).filter(k => k !== 'comment');
            const orbitIndex = parentNodes.indexOf('orbit');
            if (orbitIndex !== -1) {
                originPos = NODE_POSITIONS[`${body.parent}_${parentNodes[orbitIndex]}`];
            }
        }
    } else if (body.parent === 'kerbol') {
        // All interplanetary bodies: trunk from interplanetary hub
        originPos = NODE_POSITIONS['interplanetary'];
    } else {
        // Use first node of parent
        const pBody = _bodies[body.parent];
        if (pBody) {
            const pNodes = Object.keys(pBody.nodes).filter(k => k !== 'comment');
            if (pNodes[0]) {
                originPos = NODE_POSITIONS[`${body.parent}_${pNodes[0]}`];
            }
        }
    }

    if (!originPos) return;

    group.appendChild(_el('line', {
        id: `trunk_${body.id}`,
        class: 'map-path map-trunk',
        x1: originPos.x, y1: originPos.y,
        x2: firstPos.x, y2: firstPos.y,
        stroke: strokeColour,
        'stroke-width': PATH_STROKE_W,
    }));
}

// ─── Node Drawing ─────────────────────────────────────────────────────────────

function _drawBodyNodes(group, body) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const colour = body.mapColour || '#888888';

    // Body label
    const labelPos = NODE_POSITIONS[`${body.id}_label`];
    if (labelPos) {
        const label = _el('text', {
            id: `label_${body.id}`,
            class: 'map-label',
            x: labelPos.x, y: labelPos.y,
            'text-anchor': 'start',
            'dominant-baseline': 'middle',
        });
        label.textContent = body.label;
        group.appendChild(label);
    }

    // Nodes
    nodeKeys.forEach(key => {
        const pos = NODE_POSITIONS[`${body.id}_${key}`];
        if (!pos) return;

        const hasGlow = _shouldGlowTerminalNode(body, key);
        const nodeGroup = _el('g', {
            id: `node_${body.id}_${key}`,
            class: hasGlow ? 'map-node has-atmo-glow' : 'map-node',
        });
        if (hasGlow) nodeGroup.style.setProperty('--node-glow-color', colour);

        nodeGroup.addEventListener('click', () => {
            if (typeof onNodeClick === 'function') onNodeClick(body.id, key);
        });

        nodeGroup.appendChild(_el('circle', {
            cx: pos.x, cy: pos.y, r: NODE_R,
            stroke: colour, 'stroke-width': 1.5,
        }));

        const txt = _el('text', {
            x: pos.x, y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
        });
        txt.textContent = _nodeLabel(key);
        nodeGroup.appendChild(txt);

        group.appendChild(nodeGroup);
    });
}

// ─── Active Path Building ─────────────────────────────────────────────────────

/**
 * Build and animate the outbound path from pointA to pointB.
 * Collects all path segments and nodes along the route.
 */
function _buildOutboundPath(bodyId, nodeKey) {
    const segments = [];
    const routeNodes = [];

    _collectPathSegments(bodyId, nodeKey, segments, routeNodes);

    segments.forEach(({ el, reverse }, index) => {
        el.classList.add('is-active');
        if (reverse) el.classList.add('is-reverse');
        el.style.setProperty('--flow-delay', `${-(index * 0.12)}s`);
        _activePaths.push(el);
    });
    routeNodes.forEach(el => {
        el.classList.add('is-route');
        _activeNodes.push(el);
    });

    // Also highlight the interplanetary hub as part of the route when the route passes through IPS
    const hub = document.getElementById('node_interplanetary');
    if (hub && !_activeNodes.includes(hub)) {
        const passesThroughIPS = _pointA.body === 'interplanetary' || _pointB.body === 'interplanetary' ||
            _pointA.body === 'kerbol' || _pointB.body === 'kerbol';
        if (passesThroughIPS) {
            hub.classList.add('is-route');
            _activeNodes.push(hub);
        }
    }
}

/**
 * Build and animate the return path from pointB back to pointA.
 * Uses the same segments but with reversed animation direction.
 */
function _buildReturnPath(bodyId, nodeKey) {
    const segments = [];
    const routeNodes = [];

    _collectPathSegments(bodyId, nodeKey, segments, routeNodes);

    segments.forEach(({ el, reverse }, index) => {
        el.classList.add('is-return');
        // For return path, reverse the direction only when the outbound segment itself was reversed.
        if (reverse) el.classList.add('is-reverse');
        el.style.setProperty('--flow-delay', `${-(index * 0.12)}s`);
        _returnPaths.push(el);
    });
    routeNodes.forEach(el => {
        if (!_activeNodes.includes(el)) {
            el.classList.add('is-route');
            _activeNodes.push(el);
        }
    });

    // Hub for return too
    const hub = document.getElementById('node_interplanetary');
    if (hub && !_activeNodes.includes(hub)) {
        const passesThroughIPS = _pointA.body === 'interplanetary' || _pointB.body === 'interplanetary' ||
            _pointA.body === 'kerbol' || _pointB.body === 'kerbol';
        if (passesThroughIPS) {
            hub.classList.add('is-route');
            _activeNodes.push(hub);
        }
    }
}

/**
 * Recursively collect all path segment elements and node elements
 * from pointA up to the given bodyId/nodeKey.
 */
function _collectPathSegments(bodyId, nodeKey, segments, routeNodes) {
    const body = _bodies[bodyId];
    if (!body) return;

    // Recurse into parent chain first (so segments are ordered origin → destination)
    const parentTarget = _parentTargetNode(body);

    // Stop recursion when we've reached pointA
    const reachedPointA = (
        (_pointA.body === 'interplanetary' && parentTarget === null) ||
        (_pointA.body === bodyId && _pointA.node === nodeKey)
    );

    if (parentTarget && !reachedPointA) {
        _collectPathSegments(parentTarget.bodyId, parentTarget.nodeKey, segments, routeNodes);
    }

    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const targetIndex = nodeKeys.indexOf(nodeKey);
    if (targetIndex === -1) return;

    // Determine start index: if on pointA body, start from pointA node, else from first node
    let startIndex = 0;
    if (_pointA.body === bodyId && _pointA.node) {
        const pointAIndex = nodeKeys.indexOf(_pointA.node);
        if (pointAIndex !== -1) startIndex = pointAIndex;
    }

    // Collect node elements between startIndex and targetIndex regardless of direction
    const rangeStart = Math.min(startIndex, targetIndex);
    const rangeEnd = Math.max(startIndex, targetIndex);
    for (let i = rangeStart; i <= rangeEnd; i++) {
        const el = document.getElementById(`node_${bodyId}_${nodeKeys[i]}`);
        if (el && !routeNodes.includes(el)) routeNodes.push(el);
    }

    // Special case for Kerbol trunk (central body, no parent but has trunk)
    if (body.id === 'kerbol') {
        const trunk = document.getElementById(`trunk_${bodyId}`);
        if (trunk && !segments.some(s => s.el === trunk)) segments.push({ el: trunk, reverse: false });
    }

    // Collect trunk segment if body has a parent (connects to IPS)
    // Only collect if the trunk's starting node (first node, index 0) is in our collection range
    if (body.parent) {
        const trunk = document.getElementById(`trunk_${bodyId}`);
        if (trunk && !segments.some(s => s.el === trunk)) {
            // Trunk starts from first node (index 0), so only collect if range includes it
            if (rangeStart === 0) {
                const reverseTrunk = (startIndex > targetIndex && targetIndex === 0 && _pointA.body === bodyId);
                segments.push({ el: trunk, reverse: reverseTrunk });
            }
        }
    }

    // If pointB is a moon and we're currently on its parent planet, also collect the parent's intercept/flyby
    // BUT: only do this if pointA is NOT on the parent body itself (to avoid extra paths when starting from the parent)
    if (_pointB.body !== bodyId && _bodies[_pointB.body]?.parent === bodyId && _pointA.body !== bodyId) {
        const parentNodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
        const interceptIndex = parentNodeKeys.indexOf('intercept');
        if (interceptIndex !== -1) {
            // Collect nodes from startIndex to intercept
            const rangeStart = Math.min(startIndex, interceptIndex);
            const rangeEnd = Math.max(startIndex, interceptIndex);
            for (let i = rangeStart; i <= rangeEnd; i++) {
                const el = document.getElementById(`node_${bodyId}_${parentNodeKeys[i]}`);
                if (el && !routeNodes.includes(el)) routeNodes.push(el);
            }
            // Collect path segments from startIndex to intercept
            for (let i = rangeStart; i < rangeEnd; i++) {
                const seg = document.getElementById(`path_${bodyId}_${parentNodeKeys[i]}_${parentNodeKeys[i + 1]}`);
                if (seg && !segments.some(s => s.el === seg)) {
                    segments.push({ el: seg, reverse: startIndex > interceptIndex });
                }
            }
        }
    }

    // Collect branch segments between the two node indices regardless of direction
    for (let i = rangeStart; i < rangeEnd; i++) {
        const seg = document.getElementById(`path_${bodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`);
        if (seg && !segments.some(s => s.el === seg)) segments.push({ el: seg, reverse: startIndex > targetIndex });
    }


    // If point A is on a different body (and pointB is not a direct child of pointA),
    // collect the path from point A upward to IPS
    const pointBParent = _bodies[_pointB.body]?.parent;
    const shouldCollectPointAPaths = _pointA.body !== 'interplanetary' &&
        _pointA.body !== bodyId &&
        pointBParent !== _pointA.body;

    if (shouldCollectPointAPaths) {
        const aBody = _bodies[_pointA.body];
        if (aBody) {
            const nodeKeys = Object.keys(aBody.nodes).filter(k => k !== 'comment');
            const aIndex = nodeKeys.indexOf(_pointA.node);
            const interIndex = 0; // assume first node connects to IPS
            const rangeStart = Math.min(aIndex, interIndex);
            const rangeEnd = Math.max(aIndex, interIndex);
            for (let i = rangeStart; i <= rangeEnd; i++) {
                const el = document.getElementById(`node_${_pointA.body}_${nodeKeys[i]}`);
                if (el && !routeNodes.includes(el)) routeNodes.push(el);
            }
            for (let i = rangeStart; i < rangeEnd; i++) {
                const seg = document.getElementById(`path_${_pointA.body}_${nodeKeys[i]}_${nodeKeys[i + 1]}`);
                if (seg && !segments.some(s => s.el === seg)) segments.push({ el: seg, reverse: aIndex > interIndex });
            }
            // Include trunk for A body
            if (aBody.parent) {
                const trunk = document.getElementById(`trunk_${_pointA.body}`);
                if (trunk && !segments.some(s => s.el === trunk)) segments.push({ el: trunk, reverse: aIndex !== interIndex });
            }
        }
    }
}

// ─── Clear Active State ───────────────────────────────────────────────────────

function _clearActive() {
    if (_mapSvgEl) _mapSvgEl.classList.remove('has-selection');

    _activePaths.forEach(el => {
        el.classList.remove('is-active');
        el.classList.remove('is-reverse');
        el.style.removeProperty('--flow-delay');
    });
    _returnPaths.forEach(el => {
        el.classList.remove('is-return');
        el.classList.remove('is-reverse');
        el.style.removeProperty('--flow-delay');
    });
    _activeNodes.forEach(el => el.classList.remove('is-route'));
    if (_activeNodeEl) _activeNodeEl.classList.remove('is-active');

    _activePaths = [];
    _returnPaths = [];
    _activeNodes = [];
    _activeNodeEl = null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _el(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

function _nodeLabel(key) {
    return {
        intercept: 'Fly-by',
        flyby: 'Fly-by',
        orbit: 'Orbit',
        land: 'Land',
        escape: 'Escape',
    }[key] || key;
}

/**
 * Returns the "parent" route target for a body — the node in the
 * chain between this body and interplanetary space.
 * Returns null if the body IS the origin (interplanetary or pointA).
 */
function _parentTargetNode(body) {
    if (!body.parent) return null;
    if (body.parent === 'kerbol') return null;

    // For moons (parent's parent is kerbol), return the parent's orbit node if parent is pointA,
    // otherwise return the first node (flyby) for interplanetary connections
    if (_bodies[body.parent]?.parent === 'kerbol') {
        if (body.parent === _pointA.body) {
            return { bodyId: body.parent, nodeKey: 'orbit' };
        } else {
            const parentNodeKeys = Object.keys(_bodies[body.parent].nodes).filter(k => k !== 'comment');
            const firstNodeKey = parentNodeKeys[0];
            if (firstNodeKey) {
                return { bodyId: body.parent, nodeKey: firstNodeKey };
            }
            return null;
        }
    }

    return { bodyId: body.parent, nodeKey: 'intercept' };
}

function _shouldGlowTerminalNode(body, nodeKey) {
    if (!body.surface?.canAerobrake) return false;
    return nodeKey === 'land';
}

// Legacy compatibility — called by ui.js before full state.js is wired
function setActiveNode(bodyId, nodeKey) {
    setPointB(bodyId, nodeKey);
}