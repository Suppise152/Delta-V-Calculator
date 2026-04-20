/**
 * map.js — SVG map renderer
 * Reads stock.json, builds the SVG entirely from data.
 * No hardcoded body references — adding a new pack just means a new JSON file.
 */

// ─── Layout: node positions derived from v1 CSS percentages ──────────────────
// Keyed by bodyId + nodeKey (e.g. 'duna_intercept', 'kerbin_orbit')
// ViewBox: 1000 x 820
const NODE_POSITIONS = {
    // Kerbol
    kerbol_orbit: { x: 215, y: 490 },
    kerbol_land: { x: 55, y: 490 },
    kerbol_label: { x: 10, y: 488 },

    // Moho
    moho_intercept: { x: 325, y: 401 },
    moho_orbit: { x: 185, y: 401 },
    moho_land: { x: 55, y: 401 },
    moho_label: { x: 15, y: 401 },

    // Eve
    eve_intercept: { x: 360, y: 333 },
    eve_orbit: { x: 200, y: 333 },
    eve_land: { x: 55, y: 333 },
    eve_label: { x: 25, y: 333 },

    // Gilly
    gilly_intercept: { x: 280, y: 251 },
    gilly_orbit: { x: 165, y: 251 },
    gilly_land: { x: 55, y: 251 },
    gilly_label: { x: 10, y: 254 },

    // Kerbin
    kerbin_orbit: { x: 493, y: 641 },
    kerbin_escape: { x: 493, y: 488 },
    kerbin_label: { x: 480, y: 786 },

    // Mun
    mun_intercept: { x: 360, y: 579 },
    mun_orbit: { x: 195, y: 579 },
    mun_land: { x: 55, y: 579 },
    mun_label: { x: 20, y: 575 },

    // Minmus
    minmus_intercept: { x: 615, y: 580 },
    minmus_orbit: { x: 770, y: 579 },
    minmus_land: { x: 940, y: 579 },
    minmus_label: { x: 930, y: 615 },

    // Duna
    duna_intercept: { x: 290, y: 171 },
    duna_orbit: { x: 170, y: 171 },
    duna_land: { x: 55, y: 171 },
    duna_label: { x: 15, y: 175 },

    // Ike
    ike_intercept: { x: 290, y: 125 },
    ike_orbit: { x: 205, y: 82 },
    ike_land: { x: 55, y: 82 },
    ike_label: { x: 20, y: 90 },

    // Dres
    dres_intercept: { x: 470, y: 189 },
    dres_orbit: { x: 240, y: 26 },
    dres_land: { x: 55, y: 26 },
    dres_label: { x: 15, y: 36 },

    // Jool
    jool_intercept: { x: 730, y: 256 },
    jool_orbit: { x: 910, y: 297 },
    jool_land: { x: 925, y: 388 },
    jool_label: { x: 920, y: 432 },

    // Laythe
    laythe_intercept: { x: 815, y: 203 },
    laythe_orbit: { x: 955, y: 110 },
    laythe_land: { x: 970, y: 32 },
    laythe_label: { x: 950, y: 10 },

    // Vall
    vall_intercept: { x: 770, y: 159 },
    vall_orbit: { x: 850, y: 105 },
    vall_land: { x: 865, y: 32 },
    vall_label: { x: 855, y: 10 },

    // Tylo
    tylo_intercept: { x: 725, y: 192 },
    tylo_orbit: { x: 725, y: 109 },
    tylo_land: { x: 725, y: 32 },
    tylo_label: { x: 715, y: 10 },

    // Bop
    bop_intercept: { x: 680, y: 153 },
    bop_orbit: { x: 620, y: 107 },
    bop_land: { x: 610, y: 32 },
    bop_label: { x: 600, y: 10 },

    // Pol
    pol_intercept: { x: 650, y: 203 },
    pol_orbit: { x: 500, y: 108 },
    pol_land: { x: 495, y: 32 },
    pol_label: { x: 485, y: 10 },

    // Eeloo
    eeloo_intercept: { x: 705, y: 490 },
    eeloo_orbit: { x: 825, y: 490 },
    eeloo_land: { x: 960, y: 490 },
    eeloo_label: { x: 950, y: 527 },
};

// Node radius
const NODE_R = 20;
const PATH_STROKE_W = 15;

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

// Module state
let _bodies = null;       // map of id → body from JSON
let _activePath = null;   // currently lit path elements
let _activeNodeEl = null; // currently highlighted node element

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialise the map with a loaded system JSON.
 * Called by ui.js after fetching the pack data.
 * @param {Object} systemData - parsed JSON from data/stock.json etc.
 */
function initMap(systemData) {
    _bodies = {};
    systemData.bodies.forEach(b => { _bodies[b.id] = b; });

    const container = document.getElementById('map-container');
    container.innerHTML = '';

    const svg = _buildSVG(systemData);
    container.appendChild(svg);
}

/**
 * Highlight the path to a given body+node, fire the node click callback.
 * Called externally when a node is clicked, or when state changes
 * (e.g. recalculate needs to refresh the active path).
 * @param {string} bodyId
 * @param {string} nodeKey  - 'intercept' | 'orbit' | 'land' | 'escape'
 */
function setActiveNode(bodyId, nodeKey) {
    _clearActive();

    // Highlight node circle
    const nodeEl = document.getElementById(`node_${bodyId}_${nodeKey}`);
    if (nodeEl) {
        nodeEl.classList.add('is-active');
        _activeNodeEl = nodeEl;
    }

    // Animate the path segments leading to this node
    _activatePath(bodyId, nodeKey);
}

// ─── SVG Construction ────────────────────────────────────────────────────────

function _buildSVG(systemData) {
    const svg = _el('svg', {
        viewBox: '260 -5 420 760',
        preserveAspectRatio: 'xMidYMid meet',
        class: 'dv-map',
    });

    // Paths layer (drawn first, sit behind nodes)
    const pathsGroup = _el('g', { class: 'map-paths', id: 'map-paths' });
    svg.appendChild(pathsGroup);

    // Nodes + labels layer
    const nodesGroup = _el('g', { class: 'map-nodes', id: 'map-nodes' });
    svg.appendChild(nodesGroup);

    // Draw each body
    systemData.bodies.forEach(body => {
        _drawBodyPaths(pathsGroup, body);
        _drawBodyNodes(nodesGroup, body);
    });

    return svg;
}

// ─── Path Drawing ─────────────────────────────────────────────────────────────

/**
 * Draw the branch lines connecting nodes for a body.
 * Each segment gets its own path element so we can animate subsets.
 */
function _drawBodyPaths(group, body) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const colour = body.mapColour || '#888888';

    // For each consecutive pair of nodes, draw a connecting line
    for (let i = 0; i < nodeKeys.length - 1; i++) {
        const fromKey = nodeKeys[i];
        const toKey = nodeKeys[i + 1];
        const fromPos = NODE_POSITIONS[`${body.id}_${fromKey}`];
        const toPos = NODE_POSITIONS[`${body.id}_${toKey}`];

        if (!fromPos || !toPos) continue;

        const path = _el('line', {
            id: `path_${body.id}_${fromKey}_${toKey}`,
            class: 'map-path',
            x1: fromPos.x,
            y1: fromPos.y,
            x2: toPos.x,
            y2: toPos.y,
            stroke: colour,
            'stroke-width': PATH_STROKE_W,
        });
        group.appendChild(path);
    }

    // For bodies with intercept node, also draw the branch root line
    // connecting from the "trunk" (kerbin escape or kerbol) to intercept
    _drawTrunkLine(group, body, colour);
}

/**
 * Draw the trunk connector from the origin/parent branch point to
 * the body's first node. This is the interplanetary transfer line.
 */
function _drawTrunkLine(group, body, colour) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const firstKey = body.id === 'kerbin' ? 'escape' : nodeKeys[0];
    const firstPos = NODE_POSITIONS[`${body.id}_${firstKey}`];
    if (!firstPos) return;

    let originPos = null;
    let strokeColour = colour;

    if (body.id === 'kerbol') return; // central body, no trunk

    if (body.id === 'kerbin') {
        // Root transfer spine from the sun branch to Kerbin escape.
        originPos = NODE_POSITIONS['kerbol_orbit'];
        strokeColour = (_bodies.kerbol && _bodies.kerbol.mapColour) || colour;
    } else if (body.parent === 'kerbol') {
        // Interplanetary: trunk from kerbin_escape
        originPos = NODE_POSITIONS['kerbin_escape'];
    } else if (body.parent === 'kerbin') {
        // Kerbin moon: trunk from kerbin_orbit
        originPos = NODE_POSITIONS['kerbin_orbit'];
    } else {
        // Moon of another planet: trunk from parent's intercept node
        const parentKeys = _bodies[body.parent]
            ? Object.keys(_bodies[body.parent].nodes).filter(k => k !== 'comment')
            : [];
        const parentFirstKey = parentKeys[0];
        if (parentFirstKey) {
            originPos = NODE_POSITIONS[`${body.parent}_${parentFirstKey}`];
        }
    }

    if (!originPos) return;

    const trunk = _el('line', {
        id: `trunk_${body.id}`,
        class: 'map-path map-trunk',
        x1: originPos.x,
        y1: originPos.y,
        x2: firstPos.x,
        y2: firstPos.y,
        stroke: strokeColour,
        'stroke-width': PATH_STROKE_W,
    });
    group.appendChild(trunk);
}

// ─── Node Drawing ─────────────────────────────────────────────────────────────

function _drawBodyNodes(group, body) {
    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const colour = body.mapColour || '#888888';

    // Label
    const labelPos = NODE_POSITIONS[`${body.id}_label`];
    if (labelPos) {
        const label = _el('text', {
            id: `label_${body.id}`,
            class: 'map-label',
            x: labelPos.x,
            y: labelPos.y,
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

        const nodeGroup = _el('g', {
            id: `node_${body.id}_${key}`,
            class: 'map-node',
        });

        // Click handler
        nodeGroup.addEventListener('click', () => {
            if (typeof onNodeClick === 'function') {
                onNodeClick(body.id, key);
            }
        });

        // Circle
        const circle = _el('circle', {
            cx: pos.x,
            cy: pos.y,
            r: NODE_R,
            stroke: colour,
            'stroke-width': 1.5,
        });
        nodeGroup.appendChild(circle);

        // Label text inside node
        const nodeLabel = _el('text', {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
        });
        nodeLabel.textContent = _nodeLabel(key);
        nodeGroup.appendChild(nodeLabel);

        group.appendChild(nodeGroup);
    });
}

// ─── Active State ─────────────────────────────────────────────────────────────

function _clearActive() {
    // Clear node highlight
    if (_activeNodeEl) {
        _activeNodeEl.classList.remove('is-active');
        _activeNodeEl = null;
    }

    // Clear all animated paths
    if (_activePath) {
        _activePath.forEach(el => {
            el.classList.remove('is-active');
        });
        _activePath = null;
    }
}

/**
 * Activate path segments from origin up to and including the selected node.
 * Walks: trunk → node[0] → node[1] → ... → selectedNodeIndex
 */
function _activatePath(bodyId, nodeKey) {
    const body = _bodies[bodyId];
    if (!body) return;

    const activated = [];

    if (bodyId === 'kerbol') {
        const rootSpine = document.getElementById('trunk_kerbin');
        if (rootSpine) {
            rootSpine.classList.add('is-active');
            activated.push(rootSpine);
        }
    }

    _activatePathChain(bodyId, nodeKey, activated);

    _activePath = activated;
}

function _activatePathChain(bodyId, nodeKey, activated) {
    const body = _bodies[bodyId];
    if (!body) return;

    const parentTarget = _parentTargetNode(body);
    if (parentTarget) {
        _activatePathChain(parentTarget.bodyId, parentTarget.nodeKey, activated);
    }

    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const targetIndex = nodeKeys.indexOf(nodeKey);
    if (targetIndex === -1) return;

    const trunk = bodyId === 'kerbin' ? null : document.getElementById(`trunk_${bodyId}`);
    if (trunk && !activated.includes(trunk)) {
        trunk.classList.add('is-active');
        activated.push(trunk);
    }

    for (let i = 0; i < targetIndex; i++) {
        const segId = `path_${bodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`;
        const seg = document.getElementById(segId);
        if (seg && !activated.includes(seg)) {
            seg.classList.add('is-active');
            activated.push(seg);
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _el(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

function _nodeLabel(key) {
    const labels = {
        intercept: 'Fly-by',
        orbit: 'Orbit',
        land: 'Land',
        escape: 'Escape',
    };
    return labels[key] || key;
}

function _parentTargetNode(body) {
    if (!body.parent) return null;

    if (body.id === 'kerbin') {
        return null;
    }

    if (body.parent === 'kerbol') {
        return { bodyId: 'kerbin', nodeKey: 'escape' };
    }

    if (body.parent === 'kerbin') {
        return { bodyId: 'kerbin', nodeKey: 'orbit' };
    }

    return { bodyId: body.parent, nodeKey: 'intercept' };
}
