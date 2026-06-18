(function attachDeltaVCalcAssemble(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const {
        formatEntryLabel,
        parseStateId,
        resolveMarkerBodyId,
        stateId,
    } = api;

    /**
     * Inputs: route graph, start/end state ids, body lookup, and system metadata.
     * Outputs: ordered state id path, or an empty array if no path exists.
     */
    function findPath(graph, startId, endId, bodies, meta) {
        if (startId === endId) return [startId];

        const queue = [startId];
        const previous = new Map([[startId, null]]);
        const targetState = parseStateId(endId);
        const targetBody = bodies?.[targetState.bodyId] || null;
        const targetHostId = targetBody?.parent || null;

        while (queue.length) {
            const currentId = queue.shift();
            const edges = _sortEdgesForTarget(graph.get(currentId) || [], currentId, targetState, targetHostId, bodies, meta);

            for (const edge of edges) {
                if (_shouldSkipEdgeForTarget(edge, targetState, targetHostId)) continue;
                if (previous.has(edge.to)) continue;

                previous.set(edge.to, currentId);
                if (edge.to === endId) {
                    return reconstructPath(previous, endId);
                }

                queue.push(edge.to);
            }
        }

        return [];
    }

    /**
     * Inputs: edge and final target context.
     * Outputs: true when the edge would over-commit to a host body before reaching its moon.
     */
    function _shouldSkipEdgeForTarget(edge, targetState, targetHostId) {
        return Boolean(
            edge.branchType === 'direct_orbital_transfer'
            && edge.targetBodyId
            && targetState?.bodyId !== edge.targetBodyId
            && targetHostId === edge.targetBodyId
        );
    }

    /**
     * Inputs: candidate edges plus current/target route context.
     * Outputs: edge list sorted to prefer sensible moon-host routing.
     */
    function _sortEdgesForTarget(edges, currentId, targetState, targetHostId, bodies, meta) {
        const currentState = parseStateId(currentId);
        const currentBody = bodies?.[currentState.bodyId] || null;
        if (!currentBody || currentState.nodeKey == null || !targetState?.bodyId) {
            return edges;
        }

        const centralBodyId = meta?.centralBody;
        const currentPrimaryNode = _getPrimaryNodeKey(currentBody);
        const currentIsMoonTransferNode = (
            currentBody.parent
            && currentBody.parent !== centralBodyId
            && (
                currentState.nodeKey === currentPrimaryNode
                || currentState.nodeKey === 'orbit'
            )
        );
        if (!currentIsMoonTransferNode) return edges;

        const targetIsSameHostSystem = targetState.bodyId === currentBody.parent || targetHostId === currentBody.parent;
        return [...edges].sort((left, right) => (
            _edgePriority(left, currentBody, targetIsSameHostSystem)
            - _edgePriority(right, currentBody, targetIsSameHostSystem)
        ));
    }

    /**
     * Inputs: edge, current body, and whether the target stays in the same host system.
     * Outputs: numeric priority used by moon transfer pathfinding.
     */
    function _edgePriority(edge, currentBody, targetIsSameHostSystem) {
        if (targetIsSameHostSystem) {
            if (edge.branchType === 'direct_moon_transfer') return 0;
            if (edge.to === stateId(currentBody.parent, 'orbit')) return 1;
            if (edge.to === api.INTERPLANETARY_ID) return 3;
            return 2;
        }

        if (edge.to === api.INTERPLANETARY_ID) return 0;
        if (edge.to === stateId(currentBody.parent, 'orbit')) return 2;
        return 1;
    }

    /**
     * Inputs: body data.
     * Outputs: first configured node key or null.
     */
    function _getPrimaryNodeKey(body) {
        return api.getNodeKeys(body)[0] || null;
    }

    /**
     * Inputs: predecessor map from pathfinding and final state id.
     * Outputs: ordered state id path from start to end.
     */
    function reconstructPath(previous, endId) {
        const path = [];
        let currentId = endId;

        while (currentId) {
            path.push(currentId);
            currentId = previous.get(currentId) ?? null;
        }

        return path.reverse();
    }

    /**
     * Inputs: graph edge and body lookup.
     * Outputs: basic display breakdown entry.
     */
    function buildBreakdownEntry(edge, bodies) {
        const body = bodies[edge.bodyId];
        const label = formatEntryLabel(body, edge.nodeKey);

        return {
            label,
            dv: edge.dv,
            type: edge.nodeKey,
            markerBodyId: resolveMarkerBodyId(body, edge.nodeKey),
            zeroed: false,
        };
    }

    /**
     * Inputs: route graph, endpoint points, body lookup, and system metadata.
     * Outputs: ordered calculation segment descriptors.
     * Purpose: turns graph path edges into branch-evaluator inputs.
     */
    function collectRouteSegments(graph, startPoint, endPoint, bodies, meta) {
        const path = findPath(
            graph,
            stateId(startPoint.body, startPoint.node),
            stateId(endPoint.body, endPoint.node),
            bodies,
            meta,
        );

        if (path.length < 2) return [];

        const segments = [];
        for (let index = 0; index < path.length - 1; index += 1) {
            const fromId = path[index];
            const toId = path[index + 1];
            const edge = (graph.get(fromId) || []).find((candidate) => candidate.to === toId);
            if (!edge) continue;

            const body = bodies[edge.bodyId];
            const nodeKeys = body ? api.getNodeKeys(body) : [];
            segments.push({
                from: parseStateId(fromId),
                to: parseStateId(toId),
                bodyId: edge.bodyId,
                nodeKey: edge.nodeKey,
                primaryNodeKey: nodeKeys[0] || edge.nodeKey,
                branchType: edge.branchType || null,
                originBodyId: edge.originBodyId || null,
                targetBodyId: edge.targetBodyId || null,
                hostBodyId: edge.hostBodyId || null,
                transferCenterBodyId: edge.transferCenterBodyId || null,
            });
        }

        return segments;
    }

    /**
     * Inputs: route graph, endpoint points, body lookup, and system metadata.
     * Outputs: legacy/simple breakdown entries from raw graph edges.
     */
    function collectLegBreakdown(graph, startPoint, endPoint, bodies, meta) {
        const path = findPath(
            graph,
            stateId(startPoint.body, startPoint.node),
            stateId(endPoint.body, endPoint.node),
            bodies,
            meta,
        );

        if (path.length < 2) return [];

        const breakdown = [];
        for (let index = 0; index < path.length - 1; index += 1) {
            const fromId = path[index];
            const toId = path[index + 1];
            const edge = (graph.get(fromId) || []).find((candidate) => candidate.to === toId);
            if (!edge) continue;

            breakdown.push(buildBreakdownEntry(edge, bodies));
        }

        return breakdown;
    }

    Object.assign(api, {
        buildBreakdownEntry,
        collectLegBreakdown,
        collectRouteSegments,
        findPath,
        reconstructPath,
    });
})(typeof window !== 'undefined' ? window : globalThis);
