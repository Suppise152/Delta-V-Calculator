(function attachDeltaVCalcRouteBuilder(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const {
        INTERPLANETARY_ID,
        getNodeKeys,
        stateId,
    } = api;

    /**
     * Inputs: route graph, source/target state ids, route cost, and edge descriptor.
     * Outputs: mutates graph by appending one directed edge.
     */
    function addDirectedEdge(graph, fromId, toId, dv, descriptor) {
        if (!graph.has(fromId)) graph.set(fromId, []);
        if (!graph.has(toId)) graph.set(toId, []);

        graph.get(fromId).push({
            to: toId,
            dv,
            bodyId: descriptor.bodyId,
            nodeKey: descriptor.nodeKey,
            branchType: descriptor.branchType || null,
            originBodyId: descriptor.originBodyId || null,
            targetBodyId: descriptor.targetBodyId || null,
            hostBodyId: descriptor.hostBodyId || null,
            transferCenterBodyId: descriptor.transferCenterBodyId || null,
        });
    }

    /**
     * Inputs: route graph, two state ids, route cost, and descriptors for each direction.
     * Outputs: mutates graph by adding forward and reverse directed edges.
     */
    function addBidirectionalEdge(graph, fromId, toId, dv, forwardDescriptor, reverseDescriptor) {
        addDirectedEdge(graph, fromId, toId, dv, forwardDescriptor);
        addDirectedEdge(graph, toId, fromId, dv, reverseDescriptor);
    }

    /**
     * Inputs: route graph, body data, and ordered node keys.
     * Outputs: mutates graph with intra-body branch edges.
     */
    function addBodyChainEdges(graph, body, nodeKeys) {
        for (let index = 0; index < nodeKeys.length - 1; index += 1) {
            const currentKey = nodeKeys[index];
            const deeperKey = nodeKeys[index + 1];
            const dv = Number(body.nodes[deeperKey]) || 0;
            const reverseNodeKey = index === 0 ? 'escape' : currentKey;

            addBidirectionalEdge(
                graph,
                stateId(body.id, currentKey),
                stateId(body.id, deeperKey),
                dv,
                { bodyId: body.id, nodeKey: deeperKey },
                { bodyId: body.id, nodeKey: reverseNodeKey },
            );
        }
    }

    /**
     * Inputs: route graph, top-level body, node keys, and fallback interplanetary branch DV.
     * Outputs: mutates graph with surface/orbit/interplanetary transitions.
     */
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

    /**
     * Inputs: body lookup, system metadata, and fallback interplanetary branch DV.
     * Outputs: complete route graph used for pathfinding.
     * Purpose: converts the loaded system data into navigable calculation states.
     */
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
            const parentInboundAttachKey = parentNodeKeys[0];
            const parentOutboundAttachKey = parentNodeKeys.includes('orbit')
                ? 'orbit'
                : parentInboundAttachKey;
            if (!parentInboundAttachKey || !parentOutboundAttachKey) return;

            addDirectedEdge(
                graph,
                stateId(parentBody.id, parentInboundAttachKey),
                stateId(body.id, firstKey),
                Number(body.nodes[firstKey]) || 0,
                { bodyId: body.id, nodeKey: firstKey },
            );
            if (parentNodeKeys.includes('orbit')) {
                addDirectedEdge(
                    graph,
                    stateId(parentBody.id, 'orbit'),
                    stateId(body.id, firstKey),
                    Number(body.nodes[firstKey]) || 0,
                    { bodyId: body.id, nodeKey: firstKey },
                );
            }
            addDirectedEdge(
                graph,
                stateId(body.id, firstKey),
                stateId(parentBody.id, parentOutboundAttachKey),
                Number(body.nodes[firstKey]) || 0,
                { bodyId: parentBody.id, nodeKey: parentOutboundAttachKey },
            );
            if (parentBody.parent === centralBodyId) {
                addDirectedEdge(
                    graph,
                    stateId(body.id, firstKey),
                    INTERPLANETARY_ID,
                    Number(parentBody.nodes?.orbit) || 0,
                    { bodyId: parentBody.id, nodeKey: 'escape' },
                );
            }
        });

        addTopLevelBodyTransferEdges(graph, bodies, centralBodyId);
        addSiblingMoonTransferEdges(graph, bodies, centralBodyId);

        return graph;
    }

    /**
     * Inputs: route graph, body lookup, and central body id.
     * Outputs: mutates graph with direct top-level planet transfer edges.
     */
    function addTopLevelBodyTransferEdges(graph, bodies, centralBodyId) {
        if (!centralBodyId) return;

        const topLevelBodies = Object.values(bodies || {}).filter((body) => (
            body?.parent === centralBodyId
            && getNodeKeys(body).includes('orbit')
        ));

        topLevelBodies.forEach((originBody) => {
            topLevelBodies.forEach((targetBody) => {
                if (originBody.id === targetBody.id) return;

                addDirectedEdge(
                    graph,
                    stateId(originBody.id, 'orbit'),
                    stateId(targetBody.id, 'orbit'),
                    0,
                    {
                        bodyId: targetBody.id,
                        nodeKey: 'orbit',
                        branchType: 'direct_orbital_transfer',
                        originBodyId: originBody.id,
                        targetBodyId: targetBody.id,
                        transferCenterBodyId: centralBodyId,
                    },
                );
            });
        });
    }

    /**
     * Inputs: route graph, body lookup, and central body id.
     * Outputs: mutates graph with direct same-host moon transfer edges.
     */
    function addSiblingMoonTransferEdges(graph, bodies, centralBodyId) {
        const moonsByHost = new Map();

        Object.values(bodies || {}).forEach((body) => {
            if (!body?.parent || body.parent === centralBodyId) return;
            if (!getNodeKeys(body).includes('orbit')) return;

            if (!moonsByHost.has(body.parent)) {
                moonsByHost.set(body.parent, []);
            }
            moonsByHost.get(body.parent).push(body);
        });

        moonsByHost.forEach((moons, hostBodyId) => {
            moons.forEach((originMoon) => {
                moons.forEach((targetMoon) => {
                    if (originMoon.id === targetMoon.id) return;

                    addDirectedEdge(
                        graph,
                        stateId(originMoon.id, 'orbit'),
                        stateId(targetMoon.id, 'orbit'),
                        0,
                        {
                            bodyId: targetMoon.id,
                            nodeKey: 'orbit',
                            branchType: 'direct_moon_transfer',
                            originBodyId: originMoon.id,
                            targetBodyId: targetMoon.id,
                            hostBodyId,
                        },
                    );
                });
            });
        });
    }

    Object.assign(api, {
        addBidirectionalEdge,
        addBodyChainEdges,
        addDirectedEdge,
        addSiblingMoonTransferEdges,
        addTopLevelBodyTransferEdges,
        addTopLevelBodyEdges,
        buildRouteGraph,
    });
})(typeof window !== 'undefined' ? window : globalThis);
