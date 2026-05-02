(function attachDeltaVCalcRouteBuilder(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const {
        INTERPLANETARY_ID,
        getNodeKeys,
        stateId,
    } = api;

    function addDirectedEdge(graph, fromId, toId, dv, descriptor) {
        if (!graph.has(fromId)) graph.set(fromId, []);
        if (!graph.has(toId)) graph.set(toId, []);

        graph.get(fromId).push({
            to: toId,
            dv,
            bodyId: descriptor.bodyId,
            nodeKey: descriptor.nodeKey,
        });
    }

    function addBidirectionalEdge(graph, fromId, toId, dv, forwardDescriptor, reverseDescriptor) {
        addDirectedEdge(graph, fromId, toId, dv, forwardDescriptor);
        addDirectedEdge(graph, toId, fromId, dv, reverseDescriptor);
    }

    function addBodyChainEdges(graph, body, nodeKeys) {
        for (let index = 0; index < nodeKeys.length - 1; index += 1) {
            const currentKey = nodeKeys[index];
            const deeperKey = nodeKeys[index + 1];
            const dv = Number(body.nodes[deeperKey]) || 0;

            addBidirectionalEdge(
                graph,
                stateId(body.id, currentKey),
                stateId(body.id, deeperKey),
                dv,
                { bodyId: body.id, nodeKey: deeperKey },
                { bodyId: body.id, nodeKey: currentKey },
            );
        }
    }

    function addTopLevelBodyEdges(graph, body, nodeKeys, ipsBranchDV) {
        const firstKey = nodeKeys[0];
        const orbitKey = nodeKeys.includes('orbit') ? 'orbit' : null;
        const landKey = nodeKeys.includes('land') ? 'land' : null;

        if (orbitKey && landKey) {
            const landDv = Number(body.nodes[landKey]) || 0;
            addBidirectionalEdge(
                graph,
                stateId(body.id, orbitKey),
                stateId(body.id, landKey),
                landDv,
                { bodyId: body.id, nodeKey: landKey },
                { bodyId: body.id, nodeKey: orbitKey },
            );
        }

        if (!firstKey || !orbitKey) return;

        addDirectedEdge(
            graph,
            stateId(body.id, orbitKey),
            stateId(body.id, firstKey),
            ipsBranchDV,
            { bodyId: body.id, nodeKey: 'escape' },
        );
        addDirectedEdge(
            graph,
            stateId(body.id, firstKey),
            stateId(body.id, orbitKey),
            ipsBranchDV,
            { bodyId: body.id, nodeKey: orbitKey },
        );
        addDirectedEdge(
            graph,
            stateId(body.id, orbitKey),
            INTERPLANETARY_ID,
            ipsBranchDV,
            { bodyId: body.id, nodeKey: 'escape' },
        );
        addDirectedEdge(
            graph,
            stateId(body.id, firstKey),
            INTERPLANETARY_ID,
            0,
            { bodyId: body.id, nodeKey: 'escape' },
        );
        addDirectedEdge(
            graph,
            INTERPLANETARY_ID,
            stateId(body.id, firstKey),
            ipsBranchDV,
            { bodyId: body.id, nodeKey: 'intercept' },
        );
    }

    function buildRouteGraph(bodies, meta, ipsBranchDV) {
        const graph = new Map();
        const centralBodyId = meta?.centralBody ?? null;

        Object.values(bodies).forEach((body) => {
            const nodeKeys = getNodeKeys(body);
            if (!nodeKeys.length) return;

            const firstKey = nodeKeys[0];
            if (!body.parent) {
                addBodyChainEdges(graph, body, nodeKeys);
                addBidirectionalEdge(
                    graph,
                    INTERPLANETARY_ID,
                    stateId(body.id, firstKey),
                    Number(body.nodes[firstKey]) || 0,
                    { bodyId: body.id, nodeKey: firstKey },
                    { bodyId: body.id, nodeKey: firstKey },
                );
                return;
            }

            if (body.parent === centralBodyId) {
                addTopLevelBodyEdges(graph, body, nodeKeys, ipsBranchDV);
                return;
            }

            addBodyChainEdges(graph, body, nodeKeys);

            const parentBody = bodies[body.parent];
            if (!parentBody) return;

            const parentNodeKeys = getNodeKeys(parentBody);
            const parentAttachKey = parentNodeKeys[0];
            if (!parentAttachKey) return;

            addBidirectionalEdge(
                graph,
                stateId(parentBody.id, parentAttachKey),
                stateId(body.id, firstKey),
                Number(body.nodes[firstKey]) || 0,
                { bodyId: body.id, nodeKey: firstKey },
                { bodyId: body.id, nodeKey: firstKey },
            );
        });

        return graph;
    }

    Object.assign(api, {
        addBidirectionalEdge,
        addBodyChainEdges,
        addDirectedEdge,
        addTopLevelBodyEdges,
        buildRouteGraph,
    });
})(typeof window !== 'undefined' ? window : globalThis);
