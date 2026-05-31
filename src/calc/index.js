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
            aeroLowOrbitDest: Boolean(options.aeroLowOrbitDest),
            aeroInterceptDest: Boolean(options.aeroInterceptDest),
            aeroLowOrbitOrigin: Boolean(options.aeroLowOrbitOrigin),
            aeroInterceptOrigin: Boolean(options.aeroInterceptOrigin),
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
        const transferAngles = api.calculateTransferWindowAngles
            ? api.calculateTransferWindowAngles(pointA, pointB, bodies, meta)
            : {
                arrive: null,
                depart: null,
                model: null,
            };

        return {
            totalDV,
            breakdown,
            transferAngles,
            debug: {
                options: legOptions,
                route: debugRoute,
                transferAngles,
            },
        };
    }

    function evaluateRouteSegments(segments, bodies, meta, options, routeContext) {
        const breakdown = [];
        const debugSegments = [];
        const evaluationOptions = { ...options, meta, routeContext };

        for (const segment of segments) {
            const branchResult = evaluateSegmentBranch(segment, bodies, meta, evaluationOptions);
            const aerobrakeAdjustment = getAerobrakeAdjustment(segment, branchResult, routeContext, options, bodies);
            const adjustedDv = aerobrakeAdjustment.zeroed ? 0 : branchResult.dv;
            const body = bodies[segment.bodyId];
            breakdown.push({
                label: api.formatEntryLabel(body, segment.nodeKey),
                dv: adjustedDv,
                rawDv: branchResult.dv,
                type: segment.nodeKey,
                markerBodyId: api.resolveMarkerBodyId(body, segment.nodeKey),
                zeroed: aerobrakeAdjustment.zeroed,
                aerobrake: aerobrakeAdjustment.zeroed ? aerobrakeAdjustment.mode : null,
            });
            debugSegments.push({
                segment,
                branchType: branchResult.branchType,
                dv: adjustedDv,
                debug: {
                    ...branchResult.debug,
                    aerobrake: aerobrakeAdjustment.zeroed ? aerobrakeAdjustment.mode : null,
                    rawDv: branchResult.dv,
                },
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

        if (_isCentralBodyTransferSegment(segment, meta)) {
            return api.calculateCentralBodyTransferBranch(segment, bodies, meta, options);
        }

        if (_isMoonHostEscapeSegment(segment, bodies, meta)) {
            return api.calculateMoonHostEscapeBranch(segment, bodies, meta, options);
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

    function _isMoonHostEscapeSegment(segment, bodies, meta) {
        if (segment.to.bodyId !== api.INTERPLANETARY_ID || segment.nodeKey !== 'escape') {
            return false;
        }

        const moonBody = bodies[segment.from.bodyId];
        const hostBody = bodies[segment.bodyId];
        return Boolean(
            moonBody
            && hostBody
            && moonBody.parent === hostBody.id
            && hostBody.parent === meta?.centralBody
            && segment.from.nodeKey === segment.primaryNodeKey
        );
    }

    function _isFlybyCaptureSegment(segment) {
        return (
            segment.from.bodyId === segment.to.bodyId
            && segment.from.nodeKey === segment.primaryNodeKey
            && segment.to.nodeKey === 'orbit'
        );
    }

    function _isCentralBodyTransferSegment(segment, meta) {
        const centralBodyId = meta?.centralBody;
        if (!centralBodyId) return false;

        return (
            (
                segment.from.bodyId === api.INTERPLANETARY_ID
                && segment.to.bodyId === centralBodyId
                && segment.to.nodeKey === 'orbit'
            )
            || (
                segment.from.bodyId === centralBodyId
                && segment.from.nodeKey === 'orbit'
                && segment.to.bodyId === api.INTERPLANETARY_ID
            )
        );
    }

    function getAerobrakeAdjustment(segment, branchResult, routeContext, options, bodies) {
        const isForward = routeContext?.direction === 'forward';
        const appliesToDestination = segment.bodyId === routeContext?.endPoint?.body;

        if (!appliesToDestination) {
            return { zeroed: false, mode: null };
        }

        const destinationBody = routeContext?.endPoint?.body ? (bodies?.[routeContext.endPoint.body] || null) : null;
        const segmentBody = segment.bodyId ? (bodies?.[segment.bodyId] || null) : null;
        const aerobrakeBody = segmentBody || destinationBody;
        if (!aerobrakeBody?.surface?.canAerobrake) {
            return { zeroed: false, mode: null };
        }

        const interceptToggle = isForward
            ? options?.aeroInterceptDest
            : options?.aeroInterceptOrigin;
        const orbitToggle = isForward
            ? options?.aeroLowOrbitDest
            : options?.aeroLowOrbitOrigin;

        if (
            interceptToggle
            && (
                branchResult.branchType === 'flyby_to_capture'
                || branchResult.branchType === 'orbit_to_surface'
                || _isReturnMoonToAtmosphericOriginOrbitSegment(segment, routeContext, bodies)
            )
        ) {
            return { zeroed: true, mode: 'intercept' };
        }

        if (orbitToggle && branchResult.branchType === 'orbit_to_surface') {
            return { zeroed: true, mode: 'orbit' };
        }

        return { zeroed: false, mode: null };
    }

    function _isReturnMoonToAtmosphericOriginOrbitSegment(segment, routeContext, bodies) {
        if (routeContext?.direction !== 'return') return false;
        if (!['land', 'orbit'].includes(routeContext?.endPoint?.node)) return false;

        const originBodyId = routeContext?.endPoint?.body;
        const originBody = originBodyId ? bodies?.[originBodyId] : null;
        const sourceBody = segment?.from?.bodyId ? bodies?.[segment.from.bodyId] : null;
        if (!originBody?.surface?.canAerobrake || sourceBody?.parent !== originBodyId) return false;

        return (
            segment.bodyId === originBodyId
            && segment.to.bodyId === originBodyId
            && segment.to.nodeKey === 'orbit'
            && segment.nodeKey === 'orbit'
        );
    }

    Object.assign(api, {
        calculateRoute,
        evaluateRouteSegments,
        normalizeCalculationOptions,
    });
})(typeof window !== 'undefined' ? window : globalThis);
