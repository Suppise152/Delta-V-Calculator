(function attachDeltaVCalcAssemble(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const {
        formatEntryLabel,
        parseStateId,
        resolveMarkerBodyId,
        stateId,
    } = api;

    function findPath(graph, startId, endId) {
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
                    return reconstructPath(previous, endId);
                }

                queue.push(edge.to);
            }
        }

        return [];
    }

    function reconstructPath(previous, endId) {
        const path = [];
        let currentId = endId;

        while (currentId) {
            path.push(currentId);
            currentId = previous.get(currentId) ?? null;
        }

        return path.reverse();
    }

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

    function collectRouteSegments(graph, startPoint, endPoint, bodies) {
        const path = findPath(
            graph,
            stateId(startPoint.body, startPoint.node),
            stateId(endPoint.body, endPoint.node),
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
            });
        }

        return segments;
    }

    function collectLegBreakdown(graph, startPoint, endPoint, bodies) {
        const path = findPath(
            graph,
            stateId(startPoint.body, startPoint.node),
            stateId(endPoint.body, endPoint.node),
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
