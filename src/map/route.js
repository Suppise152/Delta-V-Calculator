(function attachMapRoute(global) {
    /**
     * Inputs: body data object.
     * Outputs: ordered route node keys excluding metadata comments.
     */
    function _getNodeKeys(body) {
        return Object.keys(body?.nodes || {}).filter(key => key !== 'comment');
    }

    /**
     * Inputs: route context, body/node endpoints, and route id accumulators.
     * Outputs: mutates accumulators with intra-body path and node ids.
     */
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

    /**
     * Inputs: route context, start body/node, ancestor body, and accumulators.
     * Outputs: mutates accumulators with path ids from a body toward an ancestor.
     */
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

    /**
     * Inputs: route context and body id.
     * Outputs: body id chain from selected body up toward the top-level host.
     */
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

    /**
     * Inputs: route context and body id.
     * Outputs: top-level body id under the central body.
     */
    function _topLevelBody(context, bodyId) {
        let body = context.bodies[bodyId];
        while (body && body.parent && body.parent !== context.centralBody) {
            body = context.bodies[body.parent];
        }
        return body ? body.id : bodyId;
    }

    /**
     * Inputs: body data.
     * Outputs: preferred node key for attaching child routes to the host.
     */
    function _getOrbitAttachNode(body) {
        const nodeKeys = _getNodeKeys(body);
        return nodeKeys.includes('orbit') ? 'orbit' : nodeKeys[0];
    }

    /**
     * Inputs: map route context.
     * Outputs: host body id for the active origin branch.
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
     * Inputs: route context and body id.
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
     * Inputs: route context and child body.
     * Outputs: node key on the parent body where the child trunk is rendered.
     */
    function _getTrunkAttachNode(context, body) {
        if (!body?.parent || body.parent === context.centralBody) return null;

        const parentBody = context.bodies[body.parent];
        const parentKeys = _getNodeKeys(parentBody);
        const orbitKey = parentKeys.includes('orbit') ? 'orbit' : parentKeys[0];

        if (body.parent === _getPointABranchHostId(context) || _isPointAAncestorBody(context, body.id)) {
            return orbitKey;
        }

        return parentKeys.find(key => ['flyby', 'intercept'].includes(key)) || orbitKey;
    }

    /**
     * Inputs: route context, origin body/node, ancestor id, and accumulators.
     * Outputs: node key reached on the ancestor body, or null.
     */
    function _walkOriginToAncestor(context, bodyId, nodeKey, ancestor, segs, nodes) {
        let currentBodyId = bodyId;
        let currentNodeKey = nodeKey;

        while (currentBodyId && currentBodyId !== ancestor) {
            const body = context.bodies[currentBodyId];
            if (!body) return null;

            const nodeKeys = _getNodeKeys(body);
            const nodeIdx = nodeKeys.indexOf(currentNodeKey);
            if (nodeIdx === -1) return null;

            for (let i = 0; i <= nodeIdx; i += 1) {
                nodes.push(`node_${currentBodyId}_${nodeKeys[i]}`);
            }

            for (let i = 0; i < nodeIdx; i += 1) {
                segs.push({
                    id: `path_${currentBodyId}_${nodeKeys[i]}_${nodeKeys[i + 1]}`,
                    sameDirection: false,
                });
            }

            segs.push({ id: `trunk_${currentBodyId}`, sameDirection: false });

            const parentId = body.parent;
            if (!parentId || parentId === context.centralBody) return null;

            const attachNode = _getTrunkAttachNode(context, body);
            if (!attachNode) return null;

            if (parentId === ancestor) {
                nodes.push(`node_${parentId}_${attachNode}`);
                return attachNode;
            }

            currentBodyId = parentId;
            currentNodeKey = attachNode;
        }

        return currentNodeKey;
    }

    /**
     * Inputs: map route context with selected endpoints, body lookup, and central body.
     * Outputs: route path ids, route node ids, and endpoint-side node groups.
     * Purpose: translates selected endpoints into SVG ids used for route highlighting.
     */
    function collectRoute(context) {
        const pA = context.pointA;
        const pB = context.pointB;
        const segmentIds = [];
        const routeNodeIds = [];
        const aNodes = [];
        const bNodes = [];

        if (pB.body === 'interplanetary') {
            _walkOriginToAncestor(context, pA.body, pA.node, 'interplanetary', segmentIds, aNodes);

            aNodes.forEach(id => routeNodeIds.push(id));
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
        if (pB.body === lca && pA.body !== lca && aChain.includes(lca)) {
            const hostBody = context.bodies[lca];
            const attachNode = _getOrbitAttachNode(hostBody);
            if (attachNode && pB.node !== attachNode) {
                _collectBodyPath(context, lca, attachNode, pB.node, bSegs, bNodes);
            } else if (attachNode) {
                bNodes.push(`node_${lca}_${attachNode}`);
            }
        }

        const aSegs = [];
        let aLcaAttachNode = null;
        if (pA.body !== lca) {
            aLcaAttachNode = _walkOriginToAncestor(context, pA.body, pA.node, lca, aSegs, aNodes);
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

        if (lca !== 'interplanetary' && pA.body !== lca && pB.body !== lca && aLcaAttachNode) {
            const destinationChildId = bChain[bChain.indexOf(lca) - 1];
            const destinationAttachNode = _getTrunkAttachNode(context, context.bodies[destinationChildId]);
            if (destinationAttachNode && destinationAttachNode !== aLcaAttachNode) {
                _collectBodyPath(context, lca, aLcaAttachNode, destinationAttachNode, aSegs, aNodes);
            }
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

    /**
     * Inputs: map route context.
     * Outputs: true when the visible route crosses interplanetary space.
     */
    function routePassesThroughIPS(context) {
        return _topLevelBody(context, context.pointA.body) !== _topLevelBody(context, context.pointB.body);
    }

    global.DeltaVMapRoute = {
        collectRoute,
        routePassesThroughIPS,
    };
})(window);
