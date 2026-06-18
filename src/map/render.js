(function attachMapRender(global) {
    const NODE_R = 20;
    const NODE_R_HUB = 40;
    const PATH_STROKE_W = 17;
    const SOLAR_BRANCH_STROKE_W = 21;
    const INDICATOR_HEIGHT = 18;
    const INDICATOR_WIDTH = PATH_STROKE_W;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    /**
     * Inputs: SVG tag name and attribute map.
     * Outputs: SVG element with attributes applied.
     */
    function _el(tag, attrs = {}) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
        return el;
    }

    /**
     * Inputs: node key.
     * Outputs: short label rendered inside a map node.
     */
    function _nodeLabel(key) {
        return { intercept: 'Fly-by', flyby: 'Fly-by', orbit: 'Orbit', land: 'Land', escape: 'Escape' }[key] || key;
    }

    /**
     * Inputs: body data and node key.
     * Outputs: true when the node should show atmospheric landing glow.
     */
    function _shouldGlowTerminalNode(body, nodeKey) {
        if (!body.surface?.canAerobrake) return false;
        return nodeKey === 'land';
    }

    /**
     * Inputs: body data object.
     * Outputs: ordered node keys excluding metadata comments.
     */
    function _getNodeKeys(body) {
        return Object.keys(body?.nodes || {}).filter(key => key !== 'comment');
    }

    /**
     * Inputs: body data and render context.
     * Outputs: stroke width for that body's path branch.
     */
    function _getBodyPathStrokeWidth(body, context) {
        const isCentralBody = body.id === context.centralBody;
        const isDirectIpsBranch = body.parent === context.centralBody;
        return isCentralBody || isDirectIpsBranch ? SOLAR_BRANCH_STROKE_W : PATH_STROKE_W;
    }

    /**
     * Inputs: render context and position key.
     * Outputs: layout coordinate or null.
     */
    function _getPosition(context, key) {
        return context.layout.positions[key] || null;
    }

    /**
     * Inputs: render context.
     * Outputs: host body id for the current origin branch, or null.
     */
    function _getPointABranchHostId(context) {
        const pointABody = context.bodies?.[context.pointA?.body];
        if (!pointABody) return null;

        if (pointABody.parent && pointABody.parent !== context.centralBody) {
            return pointABody.parent;
        }

        return pointABody.id;
    }

    /**
     * Inputs: render context and body id.
     * Outputs: true when the body is an ancestor of the current origin.
     */
    function _isPointAAncestorBody(context, bodyId) {
        let currentId = context.bodies?.[context.pointA?.body]?.parent || null;

        while (currentId && currentId !== context.centralBody) {
            if (currentId === bodyId) return true;
            currentId = context.bodies?.[currentId]?.parent || null;
        }

        return false;
    }

    /**
     * Inputs: hex color and brightness multiplier.
     * Outputs: darker hex color.
     */
    function _mixHexWithBlack(hex, amount) {
        const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        if (!match) return hex || '#888888';

        const channels = match.slice(1).map(value => parseInt(value, 16));
        const mixed = channels.map(channel => Math.round(channel * amount));
        return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    /**
     * Inputs: base route color.
     * Outputs: inline CSS custom properties for path states.
     */
    function _pathStyle(colour) {
        return [
            `--pathColour: ${colour}`,
            `--pathDimColour: ${_mixHexWithBlack(colour, 0.48)}`,
            `--pathRouteColour: ${_mixHexWithBlack(colour, 0.82)}`,
        ].join('; ');
    }

    /**
     * Inputs: render context and body.
     * Outputs: coordinate where that body's trunk path starts.
     */
    function _getTrunkStart(context, body) {
        if (!body.parent || body.parent === context.centralBody) {
            return _getPosition(context, 'interplanetary');
        }

        const parentBody = context.bodies[body.parent];
        const parentKeys = _getNodeKeys(parentBody);
        const orbitKey = parentKeys.includes('orbit') ? 'orbit' : parentKeys[0];

        if (body.parent === _getPointABranchHostId(context) || _isPointAAncestorBody(context, body.id)) {
            return _getPosition(context, `${body.parent}_${orbitKey}`);
        }

        const flybyKey = parentKeys.includes('flyby') ? 'flyby' : null;
        const interceptKey = parentKeys.includes('intercept') ? 'intercept' : null;
        const parentKey = flybyKey || interceptKey || orbitKey;
        return parentKey ? _getPosition(context, `${body.parent}_${parentKey}`) : null;
    }

    /**
     * Inputs: SVG group, body, color, and render context.
     * Outputs: appends the body trunk line when positions exist.
     */
    function _drawTrunkLine(group, body, colour, context) {
        const nodeKeys = _getNodeKeys(body);
        const firstPos = _getPosition(context, `${body.id}_${nodeKeys[0]}`);
        const strokeWidth = _getBodyPathStrokeWidth(body, context);
        if (!firstPos) return;

        const originPos = _getTrunkStart(context, body);
        if (!originPos) return;

        group.appendChild(_el('line', {
            id: `trunk_${body.id}`,
            class: 'map-path map-trunk',
            x1: originPos.x,
            y1: originPos.y,
            x2: firstPos.x,
            y2: firstPos.y,
            stroke: colour,
            style: _pathStyle(colour),
            'stroke-width': strokeWidth,
        }));
    }

    /**
     * Inputs: SVG group, body data, and render context.
     * Outputs: appends intra-body path lines and trunk line.
     */
    function _drawBodyPaths(group, body, context) {
        const nodeKeys = _getNodeKeys(body);
        const colour = body.mapColour || '#888888';
        const strokeWidth = _getBodyPathStrokeWidth(body, context);

        for (let i = 0; i < nodeKeys.length - 1; i += 1) {
            const fromPos = _getPosition(context, `${body.id}_${nodeKeys[i]}`);
            const toPos = _getPosition(context, `${body.id}_${nodeKeys[i + 1]}`);
            if (!fromPos || !toPos) continue;

            group.appendChild(_el('line', {
                id: `path_${body.id}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
                class: 'map-path',
                x1: fromPos.x,
                y1: fromPos.y,
                x2: toPos.x,
                y2: toPos.y,
                stroke: colour,
                style: _pathStyle(colour),
                'stroke-width': strokeWidth,
            }));
        }

        _drawTrunkLine(group, body, colour, context);
    }

    /**
     * Inputs: SVG group, body data, and render context.
     * Outputs: appends aerobrake indicator polygons for atmospheric bodies.
     */
    function _drawAerobrakeIndicators(group, body, context) {
        if (!body.surface?.canAerobrake) return;

        const nodeKeys = _getNodeKeys(body);
        nodeKeys.forEach((nodeKey, index) => {
            if (!['orbit', 'land'].includes(nodeKey)) return;

            const pos = _getPosition(context, `${body.id}_${nodeKey}`);
            if (!pos) return;

            let dirX;
            let dirY;

            if (index === 0) {
                const trunkStart = _getTrunkStart(context, body);
                if (!trunkStart) return;
                dirX = pos.x - trunkStart.x;
                dirY = pos.y - trunkStart.y;
            } else {
                const prevPos = _getPosition(context, `${body.id}_${nodeKeys[index - 1]}`);
                if (!prevPos) return;
                dirX = pos.x - prevPos.x;
                dirY = pos.y - prevPos.y;
            }

            const len = Math.sqrt((dirX * dirX) + (dirY * dirY));
            if (len === 0) return;

            dirX /= len;
            dirY /= len;

            const tipOffset = NODE_R + 1;
            const tipX = pos.x - (dirX * tipOffset);
            const tipY = pos.y - (dirY * tipOffset);
            const baseX = tipX - (dirX * INDICATOR_HEIGHT);
            const baseY = tipY - (dirY * INDICATOR_HEIGHT);
            const perpX = -dirY * (INDICATOR_WIDTH / 2);
            const perpY = dirX * (INDICATOR_WIDTH / 2);
            const points = [
                tipX, tipY,
                baseX + perpX, baseY + perpY,
                baseX - perpX, baseY - perpY,
            ].join(' ');

            group.appendChild(_el('polygon', {
                points,
                fill: 'white',
                class: 'aerobrake-indicator',
                id: `indicator_${body.id}_${nodeKey}`,
            }));
        });
    }

    /**
     * Inputs: SVG group, moon body, and render context.
     * Outputs: appends special return aerobrake indicator for host-orbit arrivals.
     */
    function _drawReturnHostAerobrakeIndicator(group, body, context) {
        const parentBody = context.bodies[body.parent];
        if (!parentBody?.surface?.canAerobrake) return;
        if (parentBody.id !== _getPointABranchHostId(context)) return;
        if (!['land', 'orbit'].includes(context.pointA?.node)) return;

        const parentKeys = _getNodeKeys(parentBody);
        const parentOrbitKey = parentKeys.includes('orbit') ? 'orbit' : null;
        const bodyKeys = _getNodeKeys(body);
        const firstBodyKey = bodyKeys[0];
        if (!parentOrbitKey || !firstBodyKey) return;

        const parentOrbitPos = _getPosition(context, `${parentBody.id}_${parentOrbitKey}`);
        const bodyFirstPos = _getPosition(context, `${body.id}_${firstBodyKey}`);
        if (!parentOrbitPos || !bodyFirstPos) return;

        let dirX = parentOrbitPos.x - bodyFirstPos.x;
        let dirY = parentOrbitPos.y - bodyFirstPos.y;
        const len = Math.sqrt((dirX * dirX) + (dirY * dirY));
        if (len === 0) return;

        dirX /= len;
        dirY /= len;

        const tipOffset = NODE_R + 1;
        const tipX = parentOrbitPos.x - (dirX * tipOffset);
        const tipY = parentOrbitPos.y - (dirY * tipOffset);
        const baseX = tipX - (dirX * INDICATOR_HEIGHT);
        const baseY = tipY - (dirY * INDICATOR_HEIGHT);
        const perpX = -dirY * (INDICATOR_WIDTH / 2);
        const perpY = dirX * (INDICATOR_WIDTH / 2);
        const points = [
            tipX, tipY,
            baseX + perpX, baseY + perpY,
            baseX - perpX, baseY - perpY,
        ].join(' ');

        group.appendChild(_el('polygon', {
            points,
            fill: 'white',
            class: 'aerobrake-indicator aerobrake-indicator--return-host',
            id: `indicator_${parentBody.id}_${parentOrbitKey}_from_${body.id}`,
            'data-return-aerobrake-trunk': `trunk_${body.id}`,
            'data-return-aerobrake-parent': parentBody.id,
        }));
    }

    /**
     * Inputs: SVG group, body data, and render context.
     * Outputs: appends body label and clickable node groups.
     */
    function _drawBodyNodes(group, body, context) {
        const nodeKeys = _getNodeKeys(body);
        const colour = body.mapColour || '#888888';
        const labelPos = _getPosition(context, `${body.id}_label`);

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

        nodeKeys.forEach(nodeKey => {
            const pos = _getPosition(context, `${body.id}_${nodeKey}`);
            if (!pos) return;

            const hasGlow = _shouldGlowTerminalNode(body, nodeKey);
            const node = _el('g', {
                id: `node_${body.id}_${nodeKey}`,
                class: hasGlow ? 'map-node has-atmo-glow' : 'map-node',
                'data-body-id': body.id,
                'data-node-key': nodeKey,
            });

            if (hasGlow) {
                node.style.setProperty('--node-glow-color', colour);
            }

            node.addEventListener('click', (event) => {
                if (typeof context.onNodeClick === 'function') {
                    context.onNodeClick(body.id, nodeKey, {
                        invertEndpoint: event.ctrlKey || event.metaKey,
                    });
                }
            });

            node.appendChild(_el('circle', {
                cx: pos.x,
                cy: pos.y,
                r: NODE_R,
                stroke: colour,
                'stroke-width': 1.5,
            }));

            const text = _el('text', {
                x: pos.x,
                y: pos.y,
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
            });
            text.textContent = _nodeLabel(nodeKey);
            node.appendChild(text);
            group.appendChild(node);
        });
    }

    /**
     * Inputs: SVG group, system metadata, and render context.
     * Outputs: appends interplanetary hub node.
     */
    function _drawHubNode(group, meta, context) {
        const pos = _getPosition(context, 'interplanetary');
        const colour = meta.interplanetaryNode?.mapColour || '#c8c8d4';
        const hub = _el('g', { id: 'node_interplanetary', class: 'map-node map-node--hub' });
        hub.appendChild(_el('circle', {
            cx: pos.x,
            cy: pos.y,
            r: NODE_R_HUB,
            stroke: colour,
            'stroke-width': 2,
        }));

        const text = _el('text', {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
        });
        text.textContent = 'IPS';
        hub.appendChild(text);
        group.appendChild(hub);
    }

    /**
     * Inputs: render context with system data, layout, bodies, and click handler.
     * Outputs: complete SVG map element.
     * Purpose: constructs the static map before route highlighting is applied.
     */
    function buildSvg(context) {
        const svg = _el('svg', {
            viewBox: context.layout.viewBox,
            preserveAspectRatio: 'xMidYMid meet',
            class: 'dv-map',
        });

        const pathsGroup = _el('g', { class: 'map-paths', id: 'map-paths' });
        const nodesGroup = _el('g', { class: 'map-nodes', id: 'map-nodes' });
        const indicatorsGroup = _el('g', { class: 'aerobrake-indicators', id: 'aerobrake-indicators' });

        svg.appendChild(pathsGroup);
        svg.appendChild(nodesGroup);
        svg.appendChild(indicatorsGroup);

        context.systemData.bodies.forEach(body => {
            _drawBodyPaths(pathsGroup, body, context);
            _drawAerobrakeIndicators(indicatorsGroup, body, context);
            _drawReturnHostAerobrakeIndicator(indicatorsGroup, body, context);
            _drawBodyNodes(nodesGroup, body, context);
        });

        _drawHubNode(nodesGroup, context.systemData.meta, context);
        return svg;
    }

    /**
     * Inputs: route segment ids, path group, direction, overlay state, and round-trip flag.
     * Outputs: appends animated route overlays and records affected elements.
     */
    function spawnOverlays(segmentIds, pathsGroup, direction, overlayState, isRoundTrip = false) {
        const duration = 0.9;

        segmentIds.forEach((segment, index) => {
            const base = document.getElementById(segment.id);
            if (!base) return;

            if (!base.classList.contains('is-route')) {
                base.classList.add('is-route');
                overlayState.routePathEls.push(base);
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
                const baseWidth = parseFloat(base.getAttribute('stroke-width')) || PATH_STROKE_W;
                const laneOffset = baseWidth * 0.28;
                const x1 = parseFloat(base.getAttribute('x1'));
                const y1 = parseFloat(base.getAttribute('y1'));
                const x2 = parseFloat(base.getAttribute('x2'));
                const y2 = parseFloat(base.getAttribute('y2'));
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt((dx * dx) + (dy * dy)) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const sign = direction === 'forward' ? 1 : -1;
                const tx = nx * laneOffset * sign;
                const ty = ny * laneOffset * sign;

                overlay.setAttribute('transform', `translate(${tx.toFixed(2)}, ${ty.toFixed(2)})`);

                overlay.setAttribute('stroke-width', (baseWidth * 0.55).toFixed(1));
            }

            const stagger = -(index / Math.max(segmentIds.length, 1)) * duration;
            overlay.style.animationDelay = `${stagger.toFixed(3)}s`;

            pathsGroup.appendChild(overlay);
            overlayState.overlayEls.push(overlay);
        });
    }

    /**
     * Inputs: current map overlay/highlight state.
     * Outputs: removes route overlays and active CSS classes from the DOM.
     */
    function clearActive(state) {
        if (state.mapSvgEl) state.mapSvgEl.classList.remove('has-selection');
        state.overlayEls.forEach(el => el.remove());
        state.routeNodeEls.forEach(el => el.classList.remove('is-route'));
        state.routePathEls.forEach(el => el.classList.remove('is-route'));
        document.querySelectorAll('.map-path.is-route').forEach(el => el.classList.remove('is-route'));
        if (state.activeNodeEl) state.activeNodeEl.classList.remove('is-active');
        document.querySelectorAll('.aerobrake-indicator').forEach(el => el.classList.remove('is-active'));

        state.overlayEls = [];
        state.routeNodeEls = [];
        state.routePathEls = [];
        state.activeNodeEl = null;
    }

    /**
     * Inputs: endpoint-side node ids, trip mode flags, route segments, and origin point.
     * Outputs: marks the applicable aerobrake indicators active.
     */
    function activateAerobrakeIndicators(aNodes, bNodes, roundTrip, returnOnly, routeSegments = [], pointA = null) {
        const aerobrakeArrivalOrbit = document.getElementById('aeroLowOrbitDest')?.checked ?? false;
        const aerobrakeArrivalIntercept = document.getElementById('aeroInterceptDest')?.checked ?? false;
        const aerobrakeReturnOrbit = document.getElementById('aeroLowOrbitOrigin')?.checked ?? false;
        const aerobrakeReturnIntercept = document.getElementById('aeroInterceptOrigin')?.checked ?? false;
        const activeIndicators = [];

        if (!returnOnly) {
            if (aerobrakeArrivalIntercept) {
                bNodes.forEach(nodeId => {
                    const parts = nodeId.split('_');
                    const nodeKey = parts[2];
                    if (['orbit', 'land'].includes(nodeKey)) {
                        activeIndicators.push(`indicator_${parts[1]}_${nodeKey}`);
                    }
                });
            } else if (aerobrakeArrivalOrbit) {
                bNodes.forEach(nodeId => {
                    const parts = nodeId.split('_');
                    if (parts[2] === 'land') {
                        activeIndicators.push(`indicator_${parts[1]}_${parts[2]}`);
                    }
                });
            }
        }

        if (roundTrip || returnOnly) {
            if (aerobrakeReturnIntercept) {
                const returnHostAerobrakeIndicatorIds = _getReturnHostAerobrakeIndicatorIds(routeSegments, pointA);
                const suppressOriginOrbitIndicator = returnHostAerobrakeIndicatorIds.length > 0;
                aNodes.forEach(nodeId => {
                    const parts = nodeId.split('_');
                    const nodeKey = parts[2];
                    if (['orbit', 'land'].includes(nodeKey)) {
                        if (
                            suppressOriginOrbitIndicator
                            && parts[1] === pointA?.body
                            && nodeKey === 'orbit'
                        ) {
                            return;
                        }
                        activeIndicators.push(`indicator_${parts[1]}_${nodeKey}`);
                    }
                });
                activeIndicators.push(...returnHostAerobrakeIndicatorIds);
            } else if (aerobrakeReturnOrbit) {
                aNodes.forEach(nodeId => {
                    const parts = nodeId.split('_');
                    if (parts[2] === 'land') {
                        activeIndicators.push(`indicator_${parts[1]}_${parts[2]}`);
                    }
                });
            }
        }

        activeIndicators.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('is-active');
        });
    }

    /**
     * Inputs: visible route segments and origin point.
     * Outputs: special return-host aerobrake indicator ids.
     */
    function _getReturnHostAerobrakeIndicatorIds(routeSegments, pointA) {
        if (!pointA?.body || !['land', 'orbit'].includes(pointA?.node)) return [];

        const indicatorIds = [];
        routeSegments.forEach(segment => {
            document
                .querySelectorAll('.aerobrake-indicator[data-return-aerobrake-trunk]')
                .forEach(indicator => {
                    if (indicator.getAttribute('data-return-aerobrake-trunk') !== segment.id) return;
                    if (indicator.getAttribute('data-return-aerobrake-parent') !== pointA.body) return;
                    if (indicator.id) indicatorIds.push(indicator.id);
                });
        });
        return indicatorIds;
    }

    /**
     * Inputs: body lookup.
     * Outputs: node ids that can display aerobrake indicators.
     */
    function collectAerobrakeNodeIds(bodies) {
        const nodeIds = [];

        Object.values(bodies || {}).forEach(body => {
            if (!body?.surface?.canAerobrake) return;

            Object.keys(body.nodes)
                .filter(key => key !== 'comment' && ['orbit', 'land'].includes(key))
                .forEach(key => nodeIds.push(`node_${body.id}_${key}`));
        });

        return nodeIds;
    }

    global.DeltaVMapRender = {
        buildSvg,
        spawnOverlays,
        clearActive,
        activateAerobrakeIndicators,
        collectAerobrakeNodeIds,
    };
})(window);

(function attachMapCoordinator(global) {
    const positionsApi = global.DeltaVMapPositions;
    const routeApi = global.DeltaVMapRoute;
    const renderApi = global.DeltaVMapRender;

    let _systemData = null;
    let _bodies = null;
    let _systemMeta = null;
    let _centralBody = null;
    let _mapSvgEl = null;
    let _activeMapId = 'stock';
    let _activeLayout = positionsApi.getMapLayout(_activeMapId);

    let _pointA = { body: null, node: null };
    let _pointB = { body: null, node: null };

    let _overlayEls = [];
    let _routeNodeEls = [];
    let _routePathEls = [];
    let _activeNodeEl = null;

    /**
     * Inputs: body data object.
     * Outputs: ordered node keys excluding metadata comments.
     */
    function _getNodeKeys(body) {
        return Object.keys(body?.nodes || {}).filter(key => key !== 'comment');
    }

    /**
     * Inputs: selected point.
     * Outputs: boolean indicating whether the point exists in the active system.
     */
    function _isValidPoint(point) {
        if (!point?.body) return false;
        if (point.body === 'interplanetary') return true;

        const body = _bodies?.[point.body];
        if (!body) return false;
        return _getNodeKeys(body).includes(point.node);
    }

    /**
     * Inputs: none.
     * Outputs: default origin point for the active system.
     */
    function _getDefaultPointA() {
        const originId = _systemData?.meta?.originBody;
        const originBody = originId ? _bodies[originId] : null;
        if (!originBody) return { body: null, node: null };

        const nodeKeys = _getNodeKeys(originBody);
        const landKey = nodeKeys.includes('land') ? 'land' : nodeKeys[nodeKeys.length - 1];
        return { body: originId, node: landKey };
    }

    /**
     * Inputs: none.
     * Outputs: rebuilds and swaps the active map SVG in the DOM.
     */
    function _replaceSvg() {
        const container = document.getElementById('map-container');
        const placeholder = document.getElementById('map-placeholder');
        if (placeholder) placeholder.remove();

        const existing = container.querySelector('svg');
        if (existing) existing.remove();

        const svg = renderApi.buildSvg({
            systemData: _systemData,
            layout: _activeLayout,
            bodies: _bodies,
            centralBody: _centralBody,
            pointA: _pointA,
            onNodeClick: global.onNodeClick,
        });

        container.appendChild(svg);
        _mapSvgEl = svg;
    }

    /**
     * Inputs: none.
     * Outputs: current route context for map route collection.
     */
    function _getRouteContext() {
        return {
            bodies: _bodies,
            centralBody: _centralBody,
            pointA: _pointA,
            pointB: _pointB,
        };
    }

    /**
     * Inputs: loaded system data and map initialization options.
     * Outputs: initializes map state, rebuilds SVG, and refreshes highlights.
     */
    function initMap(systemData, options = {}) {
        const preservedPointA = options.preserveSelection ? { ..._pointA } : null;
        const preservedPointB = options.preserveSelection ? { ..._pointB } : null;

        _systemData = systemData;
        _systemMeta = systemData.meta;
        _centralBody = systemData.meta.centralBody;
        _bodies = {};
        systemData.bodies.forEach(body => { _bodies[body.id] = body; });

        _activeMapId = options.mapId || _activeMapId || systemData.meta.pack || 'stock';
        _activeLayout = positionsApi.getMapLayout(_activeMapId);

        _pointA = preservedPointA && _isValidPoint(preservedPointA) ? preservedPointA : _getDefaultPointA();
        _pointB = preservedPointB && _isValidPoint(preservedPointB) ? preservedPointB : { body: null, node: null };

        _replaceSvg();
        refreshMapDisplay();
    }

    /**
     * Inputs: map pack/layout id.
     * Outputs: switches active layout and rebuilds the map if data is loaded.
     */
    function setMapLayout(mapId) {
        if (!mapId) return;
        _activeMapId = mapId;
        _activeLayout = positionsApi.getMapLayout(mapId);

        if (_systemData) {
            initMap(_systemData, { mapId, preserveSelection: true });
        }
    }

    /**
     * Inputs: origin body id and node key.
     * Outputs: updates origin selection and rebuilds route-sensitive map geometry.
     */
    function setPointA(bodyId, nodeKey) {
        _pointA = { body: bodyId, node: nodeKey };
        _replaceSvg();
        refreshMapDisplay();
    }

    /**
     * Inputs: destination body id and node key.
     * Outputs: updates destination selection and refreshes map highlighting.
     */
    function setPointB(bodyId, nodeKey) {
        _pointB = { body: bodyId, node: nodeKey };
        refreshMapDisplay();
    }

    /**
     * Inputs: none.
     * Outputs: restores default origin and clears destination.
     */
    function resetSelection() {
        _pointA = _getDefaultPointA();
        _pointB = { body: null, node: null };
        _replaceSvg();
        refreshMapDisplay();
    }

    /**
     * Inputs: none.
     * Outputs: updates active node, route overlays, and aerobrake indicators.
     */
    function refreshMapDisplay() {
        renderApi.clearActive({
            mapSvgEl: _mapSvgEl,
            overlayEls: _overlayEls,
            routeNodeEls: _routeNodeEls,
            routePathEls: _routePathEls,
            activeNodeEl: _activeNodeEl,
        });
        _overlayEls = [];
        _routeNodeEls = [];
        _routePathEls = [];
        _activeNodeEl = null;

        const roundTrip = document.getElementById('roundTripToggle')?.checked ?? false;
        const returnOnly = document.getElementById('returnOnlyToggle')?.checked ?? false;

        if (!_pointB.body) {
            const allNodes = renderApi.collectAerobrakeNodeIds(_bodies);
            renderApi.activateAerobrakeIndicators(allNodes, allNodes, roundTrip, returnOnly);
            return;
        }

        if (_mapSvgEl) _mapSvgEl.classList.add('has-selection');

        const termEl = document.getElementById(`node_${_pointB.body}_${_pointB.node}`);
        if (termEl) {
            termEl.classList.add('is-active');
            _activeNodeEl = termEl;
        }

        const routeContext = _getRouteContext();
        const routeData = routeApi.collectRoute(routeContext);
        const pathsGroup = document.getElementById('map-paths');

        routeData.routeNodeIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('is-route');
                _routeNodeEls.push(el);
            }
        });

        if (routeApi.routePassesThroughIPS(routeContext)) {
            const hub = document.getElementById('node_interplanetary');
            if (hub) {
                hub.classList.add('is-route');
                _routeNodeEls.push(hub);
            }
        }

        if (returnOnly) {
            renderApi.spawnOverlays(routeData.segmentIds, pathsGroup, 'return', {
                overlayEls: _overlayEls,
                routePathEls: _routePathEls,
            });
        } else if (roundTrip) {
            renderApi.spawnOverlays(routeData.segmentIds, pathsGroup, 'forward', {
                overlayEls: _overlayEls,
                routePathEls: _routePathEls,
            }, true);
            renderApi.spawnOverlays(routeData.segmentIds, pathsGroup, 'return', {
                overlayEls: _overlayEls,
                routePathEls: _routePathEls,
            }, true);
        } else {
            renderApi.spawnOverlays(routeData.segmentIds, pathsGroup, 'forward', {
                overlayEls: _overlayEls,
                routePathEls: _routePathEls,
            });
        }

        renderApi.activateAerobrakeIndicators(routeData.aNodes, routeData.bNodes, roundTrip, returnOnly, routeData.segmentIds, _pointA);
    }

    /**
     * Inputs: destination body id and node key.
     * Outputs: compatibility wrapper that sets Point B.
     */
    function setActiveNode(bodyId, nodeKey) {
        setPointB(bodyId, nodeKey);
    }

    /**
     * Inputs: none.
     * Outputs: active system metadata.
     */
    function getSystemMeta() {
        return _systemMeta;
    }

    /**
     * Inputs: none.
     * Outputs: active body lookup.
     */
    function getBodies() {
        return _bodies;
    }

    /**
     * Inputs: none.
     * Outputs: copies of selected origin and destination points.
     */
    function getSelectedPoints() {
        return {
            pointA: { ..._pointA },
            pointB: { ..._pointB },
        };
    }

    /**
     * Inputs: none.
     * Outputs: active map pack/layout id.
     */
    function getActiveMapId() {
        return _activeMapId;
    }

    global.initMap = initMap;
    global.setMapLayout = setMapLayout;
    global.setPointA = setPointA;
    global.setPointB = setPointB;
    global.resetSelection = resetSelection;
    global.refreshMapDisplay = refreshMapDisplay;
    global.setActiveNode = setActiveNode;
    global.getSystemMeta = getSystemMeta;
    global.getBodies = getBodies;
    global.getSelectedPoints = getSelectedPoints;
    global.getActiveMapId = getActiveMapId;
})(window);
