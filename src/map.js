/**
 * map.js — SVG map renderer
 * Reads system JSON, builds SVG entirely from data.
 */

const NODE_POSITIONS = {
    kerbol_orbit: { x: 215, y: 490 },
    kerbol_land: { x: 55, y: 490 },
    kerbol_label: { x: 10, y: 488 },
    moho_intercept: { x: 325, y: 401 },
    moho_orbit: { x: 185, y: 401 },
    moho_land: { x: 55, y: 401 },
    moho_label: { x: 15, y: 401 },
    eve_intercept: { x: 360, y: 333 },
    eve_orbit: { x: 200, y: 333 },
    eve_land: { x: 55, y: 333 },
    eve_label: { x: 25, y: 333 },
    gilly_intercept: { x: 280, y: 251 },
    gilly_orbit: { x: 165, y: 251 },
    gilly_land: { x: 55, y: 251 },
    gilly_label: { x: 10, y: 254 },
    kerbin_orbit: { x: 493, y: 641 },
    kerbin_escape: { x: 493, y: 488 },
    kerbin_label: { x: 480, y: 786 },
    mun_intercept: { x: 360, y: 579 },
    mun_orbit: { x: 195, y: 579 },
    mun_land: { x: 55, y: 579 },
    mun_label: { x: 20, y: 575 },
    minmus_intercept: { x: 615, y: 580 },
    minmus_orbit: { x: 770, y: 579 },
    minmus_land: { x: 940, y: 579 },
    minmus_label: { x: 930, y: 615 },
    duna_intercept: { x: 290, y: 171 },
    duna_orbit: { x: 170, y: 171 },
    duna_land: { x: 55, y: 171 },
    duna_label: { x: 15, y: 175 },
    ike_intercept: { x: 290, y: 125 },
    ike_orbit: { x: 205, y: 82 },
    ike_land: { x: 55, y: 82 },
    ike_label: { x: 20, y: 90 },
    dres_intercept: { x: 470, y: 189 },
    dres_orbit: { x: 240, y: 26 },
    dres_land: { x: 55, y: 26 },
    dres_label: { x: 15, y: 36 },
    jool_intercept: { x: 730, y: 256 },
    jool_orbit: { x: 880, y: 286 },
    jool_land: { x: 920, y: 376 },
    jool_label: { x: 920, y: 432 },
    laythe_intercept: { x: 815, y: 203 },
    laythe_orbit: { x: 955, y: 110 },
    laythe_land: { x: 970, y: 32 },
    laythe_label: { x: 950, y: 10 },
    vall_intercept: { x: 770, y: 159 },
    vall_orbit: { x: 850, y: 105 },
    vall_land: { x: 865, y: 32 },
    vall_label: { x: 855, y: 10 },
    tylo_intercept: { x: 725, y: 192 },
    tylo_orbit: { x: 725, y: 109 },
    tylo_land: { x: 725, y: 32 },
    tylo_label: { x: 715, y: 10 },
    bop_intercept: { x: 680, y: 153 },
    bop_orbit: { x: 620, y: 107 },
    bop_land: { x: 610, y: 32 },
    bop_label: { x: 600, y: 10 },
    pol_intercept: { x: 650, y: 203 },
    pol_orbit: { x: 500, y: 108 },
    pol_land: { x: 495, y: 32 },
    pol_label: { x: 485, y: 10 },
    eeloo_intercept: { x: 705, y: 490 },
    eeloo_orbit: { x: 825, y: 490 },
    eeloo_land: { x: 960, y: 490 },
    eeloo_label: { x: 950, y: 527 },
};

const NODE_R = 20;
const PATH_STROKE_W = 15;
const SVG_NS = 'http://www.w3.org/2000/svg';

let _bodies = null;
let _activePath = null;
let _activeNodeEl = null;
let _mapSvgEl = null;
let _activeRouteNodes = null;

// ─── Public API ──────────────────────────────────────────────────────────────

function initMap(systemData) {
    _bodies = {};
    systemData.bodies.forEach(b => { _bodies[b.id] = b; });

    const container = document.getElementById('map-container');

    // Remove placeholder without destroying the container element
    const placeholder = document.getElementById('map-placeholder');
    if (placeholder) placeholder.remove();

    // Remove any previously injected SVG (pack switching)
    const existing = container.querySelector('svg');
    if (existing) existing.remove();

    const svg = _buildSVG(systemData);
    container.appendChild(svg);
    _mapSvgEl = svg;
}

function setActiveNode(bodyId, nodeKey) {
    _clearActive();

    const nodeEl = document.getElementById(`node_${bodyId}_${nodeKey}`);
    if (nodeEl) {
        nodeEl.classList.add('is-active');
        _activeNodeEl = nodeEl;
    }

    if (_mapSvgEl) _mapSvgEl.classList.add('has-selection');

    _activatePath(bodyId, nodeKey);
}

// ─── SVG Construction ─────────────────────────────────────────────────────────

function _buildSVG(systemData) {
    const svg = _el('svg', {
        viewBox: '0 -25 1450 810',
        preserveAspectRatio: 'xMidYMid meet',
        class: 'dv-map',
    });

    const pathsGroup = _el('g', { class: 'map-paths', id: 'map-paths' });
    svg.appendChild(pathsGroup);

    const nodesGroup = _el('g', { class: 'map-nodes', id: 'map-nodes' });
    svg.appendChild(nodesGroup);

    systemData.bodies.forEach(body => {
        _drawBodyPaths(pathsGroup, body);
        _drawBodyNodes(nodesGroup, body);
    });

    return svg;
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
            stroke: colour,
            'stroke-width': PATH_STROKE_W,
        }));
    }

    _drawTrunkLine(group, body, colour);
}

function _drawTrunkLine(group, body, colour) {
    if (body.id === 'kerbol') return;

    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const firstKey = body.id === 'kerbin' ? 'escape' : nodeKeys[0];
    const firstPos = NODE_POSITIONS[`${body.id}_${firstKey}`];
    if (!firstPos) return;

    let originPos = null;
    let strokeColour = colour;

    if (body.id === 'kerbin') {
        originPos = NODE_POSITIONS['kerbol_orbit'];
        strokeColour = (_bodies.kerbol && _bodies.kerbol.mapColour) || colour;
    } else if (body.parent === 'kerbol') {
        originPos = NODE_POSITIONS['kerbin_escape'];
    } else if (body.parent === 'kerbin') {
        originPos = NODE_POSITIONS['kerbin_orbit'];
    } else if (_bodies[body.parent]) {
        const pKeys = Object.keys(_bodies[body.parent].nodes).filter(k => k !== 'comment');
        if (pKeys[0]) originPos = NODE_POSITIONS[`${body.parent}_${pKeys[0]}`];
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

// ─── Active State ─────────────────────────────────────────────────────────────

function _clearActive() {
    if (_mapSvgEl) _mapSvgEl.classList.remove('has-selection');

    if (_activeRouteNodes) {
        _activeRouteNodes.forEach(el => el.classList.remove('is-route'));
        _activeRouteNodes = null;
    }
    if (_activeNodeEl) {
        _activeNodeEl.classList.remove('is-active');
        _activeNodeEl = null;
    }
    if (_activePath) {
        _activePath.forEach(el => el.classList.remove('is-active'));
        _activePath = null;
    }
}

function _activatePath(bodyId, nodeKey) {
    const activated = [];
    const routeNodes = [];

    if (bodyId === 'kerbol') {
        const spine = document.getElementById('trunk_kerbin');
        if (spine) { spine.classList.add('is-active'); activated.push(spine); }
    }

    _activatePathChain(bodyId, nodeKey, activated, routeNodes);
    _activePath = activated;
    _activeRouteNodes = routeNodes;
}

function _activatePathChain(bodyId, nodeKey, activated, routeNodes) {
    const body = _bodies[bodyId];
    if (!body) return;

    const parent = _parentTargetNode(body);
    if (parent) _activatePathChain(parent.bodyId, parent.nodeKey, activated, routeNodes);

    const nodeKeys = Object.keys(body.nodes).filter(k => k !== 'comment');
    const targetIndex = nodeKeys.indexOf(nodeKey);
    if (targetIndex === -1) return;

    for (let i = 0; i <= targetIndex; i++) {
        const el = document.getElementById(`node_${bodyId}_${nodeKeys[i]}`);
        if (el && !routeNodes.includes(el)) {
            el.classList.add('is-route');
            routeNodes.push(el);
        }
    }

    if (bodyId !== 'kerbin') {
        const trunk = document.getElementById(`trunk_${bodyId}`);
        if (trunk && !activated.includes(trunk)) {
            trunk.classList.add('is-active');
            activated.push(trunk);
        }
    }

    for (let i = 0; i < targetIndex; i++) {
        const seg = document.getElementById(`path_${bodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`);
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
    return { intercept: 'Fly-by', orbit: 'Orbit', land: 'Land', escape: 'Escape' }[key] || key;
}

function _parentTargetNode(body) {
    if (!body.parent || body.id === 'kerbin') return null;
    if (body.parent === 'kerbol') return { bodyId: 'kerbin', nodeKey: 'escape' };
    if (body.parent === 'kerbin') return { bodyId: 'kerbin', nodeKey: 'orbit' };
    return { bodyId: body.parent, nodeKey: 'intercept' };
}

function _shouldGlowTerminalNode(body, nodeKey) {
    if (!body.surface?.canAerobrake) return false;
    return body.id === 'kerbin' ? nodeKey === 'orbit' : nodeKey === 'land';
}