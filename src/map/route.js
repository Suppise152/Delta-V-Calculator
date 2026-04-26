(function attachMapRoute(global) {
    function _getNodeKeys(body) {
        return Object.keys(body?.nodes || {}).filter(key => key !== 'comment');
    }

    function _collectBodyPath(context, bodyId, fromNode, toNode, segmentIds, routeNodeIds) {
        const body = context.bodies[bodyId];
        if (!body) return;

        const nodeKeys = _getNodeKeys(body);
        const fromIdx = nodeKeys.indexOf(fromNode);
        const toIdx = nodeKeys.indexOf(toNode);
        if (fromIdx === -1 || toIdx === -1) return;

        const rangeStart = Math.min(fromIdx, toIdx);
        const rangeEnd = Math.max(fromIdx, toIdx);
        const sameDirection = fromIdx < toIdx;

        for (let i = rangeStart; i <= rangeEnd; i += 1) {
            routeNodeIds.push(`node_${bodyId}_${nodeKeys[i]}`);
        }

        for (let i = rangeStart; i < rangeEnd; i += 1) {
            segmentIds.push({
                id: `path_${bodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
                sameDirection,
            });
        }
    }

    function _walkToAncestor(context, bodyId, nodeKey, ancestor, segs, nodes) {
        if (bodyId === ancestor) return;

        const body = context.bodies[bodyId];
        if (!body) return;

        const nodeKeys = _getNodeKeys(body);
        const targetIdx = nodeKeys.indexOf(nodeKey);
        if (targetIdx === -1) return;

        for (let i = targetIdx; i >= 0; i -= 1) {
            nodes.push(`node_${bodyId}_${nodeKeys[i]}`);
        }

        for (let i = targetIdx - 1; i >= 0; i -= 1) {
            segs.push({
                id: `path_${bodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
                sameDirection: true,
            });
        }

        if (body.parent || bodyId === context.centralBody) {
            segs.push({ id: `trunk_${bodyId}`, sameDirection: true });
        }

        const parent = body.parent;
        if (!parent || parent === context.centralBody) return;

        const parentBody = context.bodies[parent];
        if (!parentBody || parent === ancestor) return;

        const parentKeys = _getNodeKeys(parentBody);
        const firstKey = parentKeys[0];
        const orbitKey = parentKeys.includes('orbit') ? 'orbit' : firstKey;
        const nextKey = parent === context.pointA.body ? orbitKey : firstKey;
        _walkToAncestor(context, parent, nextKey, ancestor, segs, nodes);
    }

    function _ancestorChain(context, bodyId) {
        const chain = [];
        let id = bodyId;

        while (id) {
            chain.push(id);
            const body = context.bodies[id];
            if (!body || !body.parent || body.parent === context.centralBody) break;
            id = body.parent;
        }

        return chain;
    }

    function _topLevelBody(context, bodyId) {
        let body = context.bodies[bodyId];
        while (body && body.parent && body.parent !== context.centralBody) {
            body = context.bodies[body.parent];
        }
        return body ? body.id : bodyId;
    }

    function collectRoute(context) {
        const pA = context.pointA;
        const pB = context.pointB;
        const segmentIds = [];
        const routeNodeIds = [];
        const aNodes = [];
        const bNodes = [];

        if (pB.body === 'interplanetary') {
            const aBody = context.bodies[pA.body];
            const aKeys = _getNodeKeys(aBody);
            const aIdx = aKeys.indexOf(pA.node);

            for (let i = 0; i <= aIdx; i += 1) {
                const id = `node_${pA.body}_${aKeys[i]}`;
                routeNodeIds.push(id);
                aNodes.push(id);
            }

            for (let i = 0; i < aIdx; i += 1) {
                segmentIds.push({
                    id: `path_${pA.body}_${aKeys[i]}_${aKeys[i + 1]}`,
                    sameDirection: false,
                });
            }

            segmentIds.push({ id: `trunk_${pA.body}`, sameDirection: false });

            const aPlanet = aBody?.parent;
            if (aPlanet && aPlanet !== context.centralBody) {
                const planetBody = context.bodies[aPlanet];
                const planetKeys = _getNodeKeys(planetBody);
                const orbitKey = planetKeys.includes('orbit') ? 'orbit' : planetKeys[0];
                const orbitIdx = planetKeys.indexOf(orbitKey);

                for (let i = 0; i <= orbitIdx; i += 1) {
                    const id = `node_${aPlanet}_${planetKeys[i]}`;
                    routeNodeIds.push(id);
                    aNodes.push(id);
                }

                for (let i = 0; i < orbitIdx; i += 1) {
                    segmentIds.push({
                        id: `path_${aPlanet}_${planetKeys[i]}_${planetKeys[i + 1]}`,
                        sameDirection: false,
                    });
                }

                segmentIds.push({ id: `trunk_${aPlanet}`, sameDirection: false });
            }

            routeNodeIds.push('node_interplanetary');
            bNodes.push('node_interplanetary');
            return { segmentIds, routeNodeIds, aNodes, bNodes };
        }

        if (pA.body === pB.body) {
            _collectBodyPath(context, pA.body, pA.node, pB.node, segmentIds, routeNodeIds);

            if (['flyby', 'intercept'].includes(pB.node)) {
                segmentIds.push({ id: `trunk_${pA.body}`, sameDirection: false });
                routeNodeIds.push('node_interplanetary');
            }

            aNodes.push(...routeNodeIds);
            bNodes.push(...routeNodeIds);
            return { segmentIds, routeNodeIds, aNodes, bNodes };
        }

        const aChain = _ancestorChain(context, pA.body);
        const bChain = _ancestorChain(context, pB.body);

        let lca = null;
        for (const ancestor of aChain) {
            if (bChain.includes(ancestor)) {
                lca = ancestor;
                break;
            }
        }
        if (!lca) lca = 'interplanetary';

        const bSegs = [];
        _walkToAncestor(context, pB.body, pB.node, lca, bSegs, bNodes);

        const aSegs = [];
        if (pA.body !== lca) {
            const aBody = context.bodies[pA.body];
            const aKeys = _getNodeKeys(aBody);
            const aIdx = aKeys.indexOf(pA.node);

            for (let i = 0; i <= aIdx; i += 1) {
                aNodes.push(`node_${pA.body}_${aKeys[i]}`);
            }

            for (let i = 0; i < aIdx; i += 1) {
                aSegs.push({
                    id: `path_${pA.body}_${aKeys[i]}_${aKeys[i + 1]}`,
                    sameDirection: false,
                });
            }

            aSegs.push({ id: `trunk_${pA.body}`, sameDirection: false });

            const aPlanet = aBody?.parent;
            if (aPlanet && aPlanet !== context.centralBody && aPlanet !== lca) {
                const planetBody = context.bodies[aPlanet];
                const planetKeys = _getNodeKeys(planetBody);
                const orbitKey = planetKeys.includes('orbit') ? 'orbit' : planetKeys[0];
                const orbitIdx = planetKeys.indexOf(orbitKey);

                for (let i = 0; i <= orbitIdx; i += 1) {
                    aNodes.push(`node_${aPlanet}_${planetKeys[i]}`);
                }

                for (let i = 0; i < orbitIdx; i += 1) {
                    aSegs.push({
                        id: `path_${aPlanet}_${planetKeys[i]}_${planetKeys[i + 1]}`,
                        sameDirection: false,
                    });
                }

                aSegs.push({ id: `trunk_${aPlanet}`, sameDirection: false });
            }
        } else if (bChain.includes(pA.body) && pA.body !== pB.body) {
            const aBody = context.bodies[pA.body];
            const aKeys = _getNodeKeys(aBody);
            const child = bChain[bChain.indexOf(pA.body) - 1];
            let exitNode = 'orbit';

            if (aBody && child) {
                exitNode = aKeys.includes('orbit') ? 'orbit' : aKeys[0];
            }

            _collectBodyPath(context, pA.body, pA.node, exitNode, aSegs, aNodes);
        }

        bSegs.reverse();
        bNodes.reverse();

        for (const segment of [...aSegs, ...bSegs]) {
            if (!segmentIds.some(existing => existing.id === segment.id)) {
                segmentIds.push(segment);
            }
        }

        for (const nodeId of [...aNodes, ...bNodes]) {
            if (!routeNodeIds.includes(nodeId)) {
                routeNodeIds.push(nodeId);
            }
        }

        return { segmentIds, routeNodeIds, aNodes, bNodes };
    }

    function routePassesThroughIPS(context) {
        return _topLevelBody(context, context.pointA.body) !== _topLevelBody(context, context.pointB.body);
    }

    global.DeltaVMapRoute = {
        collectRoute,
        routePassesThroughIPS,
    };
})(window);
