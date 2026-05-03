(function attachDeltaVCalcIndex(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const {
        DEFAULT_IPS_BRANCH_DV,
        buildRouteGraph,
        collectRouteSegments,
        emptyResult,
        isValidPoint,
    } = api;

    function normalizeCalculationOptions(options = {}) {
        return {
            ipsBranchDV: Number.isFinite(options.ipsBranchDV) ? options.ipsBranchDV : DEFAULT_IPS_BRANCH_DV,
            roundTrip: Boolean(options.roundTrip),
            returnOnly: Boolean(options.returnOnly),
            redundancyMultiplier: Number.isFinite(options.redundancyMultiplier) ? options.redundancyMultiplier : 1,
        };
    }

    function calculateRoute(pointA, pointB, options = {}, bodies = {}, meta = {}) {
        if (!isValidPoint(pointA, bodies) || !isValidPoint(pointB, bodies)) {
            return emptyResult();
        }

        const legOptions = normalizeCalculationOptions(options);
        const graph = buildRouteGraph(bodies, meta, legOptions.ipsBranchDV);
        const forwardSegments = collectRouteSegments(graph, pointA, pointB, bodies, meta);
        const returnSegments = collectRouteSegments(graph, pointB, pointA, bodies, meta);

        const forwardEvaluation = evaluateRouteSegments(forwardSegments, bodies, meta, legOptions, {
            startPoint: pointA,
            endPoint: pointB,
            direction: 'forward',
        });
        const returnEvaluation = evaluateRouteSegments(returnSegments, bodies, meta, legOptions, {
            startPoint: pointB,
            endPoint: pointA,
            direction: 'return',
        });

        let breakdown = forwardEvaluation.breakdown;
        let debugRoute = forwardEvaluation.debug;
        if (legOptions.returnOnly) {
            breakdown = returnEvaluation.breakdown;
            debugRoute = returnEvaluation.debug;
        } else if (legOptions.roundTrip) {
            breakdown = [...forwardEvaluation.breakdown, ...returnEvaluation.breakdown];
            debugRoute = {
                mode: 'round_trip',
                forward: forwardEvaluation.debug,
                return: returnEvaluation.debug,
            };
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
            debug: {
                options: legOptions,
                route: debugRoute,
            },
        };
    }

    function evaluateRouteSegments(segments, bodies, meta, options, routeContext) {
        const breakdown = [];
        const debugSegments = [];
        const evaluationOptions = { ...options, meta, routeContext };

        for (const segment of segments) {
            const branchResult = evaluateSegmentBranch(segment, bodies, meta, evaluationOptions);
            const body = bodies[segment.bodyId];
            breakdown.push({
                label: api.formatEntryLabel(body, segment.nodeKey),
                dv: branchResult.dv,
                type: segment.nodeKey,
                markerBodyId: api.resolveMarkerBodyId(body, segment.nodeKey),
                zeroed: false,
            });
            debugSegments.push({
                segment,
                branchType: branchResult.branchType,
                dv: branchResult.dv,
                debug: branchResult.debug,
            });
        }

        return {
            breakdown,
            debug: {
                routeContext,
                segments: debugSegments,
            },
        };
    }

    function evaluateSegmentBranch(segment, bodies, meta, options) {
        if (_isSurfaceOrbitSegment(segment)) {
            return api.calculateSurfaceOrbitBranch(segment, bodies, meta, options);
        }

        if (_isOrbitEscapeSegment(segment)) {
            return api.calculateOrbitEscapeBranch(segment, bodies, options);
        }

        if (_isEscapeInterceptSegment(segment, bodies, meta)) {
            return api.calculateEscapeInterceptBranch(segment, bodies, meta, options);
        }

        if (_isFlybyCaptureSegment(segment)) {
            return api.calculateFlybyCaptureBranch(segment, bodies, meta, options);
        }

        return api.calculateBodyChainBranch(segment, bodies);
    }

    function _isSurfaceOrbitSegment(segment) {
        const fromNode = segment.from.nodeKey;
        const toNode = segment.to.nodeKey;
        return (
            segment.from.bodyId === segment.to.bodyId
            && (
                (fromNode === 'land' && toNode === 'orbit')
                || (fromNode === 'orbit' && toNode === 'land')
            )
        );
    }

    function _isOrbitEscapeSegment(segment) {
        return (
            (
                segment.from.nodeKey === 'orbit'
                || (segment.nodeKey === 'escape' && segment.to.bodyId === api.INTERPLANETARY_ID)
            )
            && (
                    segment.to.bodyId === api.INTERPLANETARY_ID
                    || (
                        segment.from.bodyId === segment.to.bodyId
                        && segment.to.nodeKey === segment.primaryNodeKey
                    )
                )
        );
    }

    function _isEscapeInterceptSegment(segment, bodies, meta) {
        const targetBody = bodies[segment.to.bodyId];
        const targetIsMoon = targetBody?.parent && targetBody.parent !== meta?.centralBody;
        const targetParent = targetBody?.parent || null;
        const targetParentPrimary = targetParent && bodies[targetParent] ? api.getNodeKeys(bodies[targetParent])[0] : null;
        return (
            (segment.from.bodyId === api.INTERPLANETARY_ID && segment.to.nodeKey === segment.primaryNodeKey)
            || (
                segment.from.nodeKey === 'orbit'
                && segment.from.bodyId !== segment.to.bodyId
                && segment.to.nodeKey === segment.primaryNodeKey
            )
            || (
                targetIsMoon
                && segment.from.bodyId === targetParent
                && segment.from.nodeKey === targetParentPrimary
                && segment.to.nodeKey === segment.primaryNodeKey
            )
        );
    }

    function _isFlybyCaptureSegment(segment) {
        return (
            segment.from.bodyId === segment.to.bodyId
            && segment.from.nodeKey === segment.primaryNodeKey
            && segment.to.nodeKey === 'orbit'
        );
    }

    Object.assign(api, {
        calculateRoute,
        evaluateRouteSegments,
        normalizeCalculationOptions,
    });
})(typeof window !== 'undefined' ? window : globalThis);
