(function attachDeltaVCalculator(global) {
    const INTERPLANETARY_ID = 'interplanetary';
    const DEFAULT_IPS_BRANCH_DV = 1000;

    function jscalculate(pointA, pointB, options = {}, bodies = {}, meta = {}) {
        if (!_isValidPoint(pointA, bodies) || !_isValidPoint(pointB, bodies)) {
            return _emptyResult();
        }

        const legOptions = {
            ipsBranchDV: Number.isFinite(options.ipsBranchDV) ? options.ipsBranchDV : DEFAULT_IPS_BRANCH_DV,
            roundTrip: Boolean(options.roundTrip),
            returnOnly: Boolean(options.returnOnly),
            redundancyMultiplier: Number.isFinite(options.redundancyMultiplier) ? options.redundancyMultiplier : 1,
        };

        const graph = _buildRouteGraph(bodies, meta, legOptions.ipsBranchDV);
        const forwardBreakdown = _collectLegBreakdown(graph, pointA, pointB, bodies);
        const returnBreakdown = _collectLegBreakdown(graph, pointB, pointA, bodies);

        let breakdown = forwardBreakdown;
        if (legOptions.returnOnly) {
            breakdown = returnBreakdown;
        } else if (legOptions.roundTrip) {
            breakdown = [...forwardBreakdown, ...returnBreakdown];
        }

        const subtotal = breakdown.reduce((sum, entry) => sum + entry.dv, 0);
        const totalDV = Math.round((subtotal * legOptions.redundancyMultiplier) / 10) * 10;

        return {
            totalDV,
            breakdown,
            transferAngles: {
                arrive: null,
                depart: null,
            },
        };
    }

    function _emptyResult() {
        return {
            totalDV: 0,
            breakdown: [],
            transferAngles: {
                arrive: null,
                depart: null,
            },
        };
    }

    function _isValidPoint(point, bodies) {
        if (!point?.body) return false;
        if (point.body === INTERPLANETARY_ID) return true;

        const body = bodies[point.body];
        if (!body) return false;

        return _getNodeKeys(body).includes(point.node);
    }

    function _getNodeKeys(body) {
        return Object.keys(body?.nodes || {}).filter((key) => key !== 'comment');
    }

    function _getNodeModel(meta) {
        return meta?.nodeModel || {
            surfaceNodeKey: 'land',
            orbitNodeKey: 'orbit',
            flybyNodeKeys: ['flyby', 'intercept'],
            lowOrbitAltitudeMeters: 10000,
            flybyPeriapsisAltitudeMeters: 10000,
            lowOrbitAltitudeOverrides: {},
        };
    }

    function _getBodyPhysics(body) {
        return body?.physics || null;
    }

    function _getLowOrbitAltitude(body, meta) {
        const nodeModel = _getNodeModel(meta);
        const overrides = nodeModel.lowOrbitAltitudeOverrides || {};
        if (Object.prototype.hasOwnProperty.call(overrides, body.id)) {
            return Number(overrides[body.id]) || 0;
        }

        const physics = _getBodyPhysics(body);
        const atmosphereHeight = Number(physics?.atmosphereHeight) || 0;
        return Math.max(
            Number(nodeModel.lowOrbitAltitudeMeters) || 0,
            atmosphereHeight + (Number(nodeModel.lowOrbitAltitudeMeters) || 0),
        );
    }

    function _getFlybyPeriapsisAltitude(body, meta) {
        const nodeModel = _getNodeModel(meta);
        const physics = _getBodyPhysics(body);
        const atmosphereHeight = Number(physics?.atmosphereHeight) || 0;
        return Math.max(
            Number(nodeModel.flybyPeriapsisAltitudeMeters) || 0,
            atmosphereHeight + (Number(nodeModel.flybyPeriapsisAltitudeMeters) || 0),
        );
    }

    function _getPhysicalRadius(body, altitudeMeters) {
        const physics = _getBodyPhysics(body);
        if (!physics) return null;
        return (Number(physics.radius) || 0) + (Number(altitudeMeters) || 0);
    }

    function _describeCanonicalNodeState(body, nodeKey, meta) {
        const nodeModel = _getNodeModel(meta);
        if (nodeKey === nodeModel.surfaceNodeKey) {
            return { type: 'surface', bodyId: body.id };
        }
        if (nodeKey === nodeModel.orbitNodeKey) {
            return {
                type: 'orbit',
                bodyId: body.id,
                altitudeMeters: _getLowOrbitAltitude(body, meta),
                radiusMeters: _getPhysicalRadius(body, _getLowOrbitAltitude(body, meta)),
            };
        }
        if ((nodeModel.flybyNodeKeys || []).includes(nodeKey)) {
            return {
                type: 'flyby',
                bodyId: body.id,
                altitudeMeters: _getFlybyPeriapsisAltitude(body, meta),
                radiusMeters: _getPhysicalRadius(body, _getFlybyPeriapsisAltitude(body, meta)),
            };
        }

        return { type: nodeKey, bodyId: body.id };
    }

    function _stateId(bodyId, nodeKey) {
        return `${bodyId}::${nodeKey}`;
    }

    function _buildRouteGraph(bodies, meta, ipsBranchDV) {
        const graph = new Map();
        const centralBodyId = meta?.centralBody ?? null;

        Object.values(bodies).forEach((body) => {
            const nodeKeys = _getNodeKeys(body);
            if (!nodeKeys.length) return;

            const firstKey = nodeKeys[0];
            if (!body.parent) {
                _addBodyChainEdges(graph, body, nodeKeys);
                _addBidirectionalEdge(
                    graph,
                    INTERPLANETARY_ID,
                    _stateId(body.id, firstKey),
                    Number(body.nodes[firstKey]) || 0,
                    { bodyId: body.id, nodeKey: firstKey },
                    { bodyId: body.id, nodeKey: firstKey },
                );
                return;
            }

            if (body.parent === centralBodyId) {
                _addTopLevelBodyEdges(graph, body, nodeKeys, ipsBranchDV);
                return;
            }

            _addBodyChainEdges(graph, body, nodeKeys);

            const parentBody = bodies[body.parent];
            if (!parentBody) return;

            const parentNodeKeys = _getNodeKeys(parentBody);
            const parentAttachKey = parentNodeKeys.includes('orbit') ? 'orbit' : parentNodeKeys[0];
            if (!parentAttachKey) return;

            _addBidirectionalEdge(
                graph,
                _stateId(parentBody.id, parentAttachKey),
                _stateId(body.id, firstKey),
                Number(body.nodes[firstKey]) || 0,
                { bodyId: body.id, nodeKey: firstKey },
                { bodyId: body.id, nodeKey: firstKey },
            );
        });

        return graph;
    }

    function _addBodyChainEdges(graph, body, nodeKeys) {
        for (let index = 0; index < nodeKeys.length - 1; index += 1) {
            const currentKey = nodeKeys[index];
            const deeperKey = nodeKeys[index + 1];
            const dv = Number(body.nodes[deeperKey]) || 0;

            _addBidirectionalEdge(
                graph,
                _stateId(body.id, currentKey),
                _stateId(body.id, deeperKey),
                dv,
                { bodyId: body.id, nodeKey: deeperKey },
                { bodyId: body.id, nodeKey: currentKey },
            );
        }
    }

    function _addTopLevelBodyEdges(graph, body, nodeKeys, ipsBranchDV) {
        const firstKey = nodeKeys[0];
        const orbitKey = nodeKeys.includes('orbit') ? 'orbit' : null;
        const landKey = nodeKeys.includes('land') ? 'land' : null;

        if (orbitKey && landKey) {
            const landDv = Number(body.nodes[landKey]) || 0;
            _addBidirectionalEdge(
                graph,
                _stateId(body.id, orbitKey),
                _stateId(body.id, landKey),
                landDv,
                { bodyId: body.id, nodeKey: landKey },
                { bodyId: body.id, nodeKey: orbitKey },
            );
        }

        if (!firstKey || !orbitKey) return;

        _addDirectedEdge(
            graph,
            _stateId(body.id, orbitKey),
            _stateId(body.id, firstKey),
            ipsBranchDV,
            { bodyId: body.id, nodeKey: 'escape' },
        );
        _addDirectedEdge(
            graph,
            _stateId(body.id, firstKey),
            _stateId(body.id, orbitKey),
            ipsBranchDV,
            { bodyId: body.id, nodeKey: orbitKey },
        );
        _addDirectedEdge(
            graph,
            _stateId(body.id, orbitKey),
            INTERPLANETARY_ID,
            ipsBranchDV,
            { bodyId: body.id, nodeKey: 'escape' },
        );
        _addDirectedEdge(
            graph,
            _stateId(body.id, firstKey),
            INTERPLANETARY_ID,
            0,
            { bodyId: body.id, nodeKey: 'escape' },
        );
        _addDirectedEdge(
            graph,
            INTERPLANETARY_ID,
            _stateId(body.id, firstKey),
            ipsBranchDV,
            { bodyId: body.id, nodeKey: 'intercept' },
        );
    }

    function _addBidirectionalEdge(graph, fromId, toId, dv, forwardDescriptor, reverseDescriptor) {
        _addDirectedEdge(graph, fromId, toId, dv, forwardDescriptor);
        _addDirectedEdge(graph, toId, fromId, dv, reverseDescriptor);
    }

    function _addDirectedEdge(graph, fromId, toId, dv, descriptor) {
        if (!graph.has(fromId)) graph.set(fromId, []);
        if (!graph.has(toId)) graph.set(toId, []);

        graph.get(fromId).push({
            to: toId,
            dv,
            bodyId: descriptor.bodyId,
            nodeKey: descriptor.nodeKey,
        });
    }

    function _collectLegBreakdown(graph, startPoint, endPoint, bodies) {
        const path = _findPath(
            graph,
            _stateId(startPoint.body, startPoint.node),
            _stateId(endPoint.body, endPoint.node),
        );

        if (path.length < 2) return [];

        const breakdown = [];
        for (let index = 0; index < path.length - 1; index += 1) {
            const fromId = path[index];
            const toId = path[index + 1];
            const edge = (graph.get(fromId) || []).find((candidate) => candidate.to === toId);
            if (!edge) continue;

            breakdown.push(_buildBreakdownEntry(edge, bodies));
        }

        return breakdown;
    }

    function _findPath(graph, startId, endId) {
        if (startId === endId) return [startId];

        const queue = [startId];
        const previous = new Map([[startId, null]]);

        while (queue.length) {
            const currentId = queue.shift();
            const edges = graph.get(currentId) || [];

            for (const edge of edges) {
                if (previous.has(edge.to)) continue;

                previous.set(edge.to, currentId);
                if (edge.to === endId) {
                    return _reconstructPath(previous, endId);
                }

                queue.push(edge.to);
            }
        }

        return [];
    }

    function _reconstructPath(previous, endId) {
        const path = [];
        let currentId = endId;

        while (currentId) {
            path.push(currentId);
            currentId = previous.get(currentId) ?? null;
        }

        return path.reverse();
    }

    function _buildBreakdownEntry(edge, bodies) {
        const body = bodies[edge.bodyId];
        const label = _formatEntryLabel(body, edge.nodeKey);

        return {
            label,
            dv: edge.dv,
            type: edge.nodeKey,
            markerBodyId: _resolveMarkerBodyId(body, edge.nodeKey),
            zeroed: false,
        };
    }

    function _resolveMarkerBodyId(body, nodeKey) {
        if (!body) return null;

        if (nodeKey === 'intercept' || nodeKey === 'flyby') {
            return body.parent || body.id;
        }

        return body.id;
    }

    function _formatEntryLabel(body, nodeKey) {
        if (!body || !nodeKey) return 'Transfer';

        if (nodeKey === 'orbit') {
            return `Low ${body.label} Orbit`;
        }

        const nodeLabel = {
            flyby: 'Fly-by',
            intercept: 'Intercept',
            land: 'Surface',
            escape: 'Escape',
        }[nodeKey] || nodeKey;

        return `${body.label} ${nodeLabel}`;
    }

    global.jscalculate = jscalculate;
})(typeof window !== 'undefined' ? window : globalThis);
