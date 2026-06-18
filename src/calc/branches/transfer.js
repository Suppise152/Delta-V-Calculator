(function attachDeltaVCalcTransferBranches(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const LOW_GRAVITY_ESCAPE_BUDGET_DV = 600;

    /**
     * Inputs: route segment, body lookup, system metadata, and evaluation options.
     * Outputs: branch result for interplanetary or moon intercept transfer.
     */
    function calculateEscapeInterceptBranch(segment, bodies, meta, options) {
        const body = bodies[segment.bodyId];
        if (!body) {
            return {
                dv: 0,
                branchType: 'escape_to_intercept',
                debug: {
                    unresolved: true,
                    from: segment.from,
                    to: segment.to,
                },
            };
        }

        if (segment.from.bodyId === api.INTERPLANETARY_ID && segment.to.nodeKey === segment.primaryNodeKey) {
            if (body.parent === meta?.centralBody) {
                const originTopLevelBody = _resolveTransferOriginTopLevelBody(options?.routeContext?.startPoint?.body, bodies, meta);
                const originBody = bodies[originTopLevelBody];
                const centralBody = bodies[meta?.centralBody];
                if (originBody && centralBody) {
                    const fromCentralBody = originTopLevelBody === meta?.centralBody;
                    const context = fromCentralBody
                        ? _computeCentralBodyOriginArrivalContext(body, centralBody, meta)
                        : api.computeInterplanetaryContext(originBody, body, meta, centralBody);
                    const originMu = Number(api.getPhysics(originBody).mu) || 0;
                    const originPeriapsis = fromCentralBody
                        ? null
                        : api.lowOrbitRadius(originBody, meta);
                    const localEscape = fromCentralBody
                        ? 0
                        : api.hyperbolicDepartureBurn(originMu, originPeriapsis, 0);
                    const departureBurn = fromCentralBody
                        ? 0
                        : api.hyperbolicDepartureBurn(originMu, originPeriapsis, context.vinfDepartCoplanar);
                    const coplanarExtra = departureBurn - localEscape;
                    const planeChange = fromCentralBody
                        ? 0
                        : api.planeChangeDeltaV(context.originSpeed, context.planeAngle);
                    return {
                        dv: coplanarExtra + planeChange,
                        branchType: 'escape_to_intercept',
                        debug: {
                            source: fromCentralBody
                                ? 'formula.central_low_orbit_to_outer_intercept'
                                : 'formula.periapsis_to_periapsis_departure_plane_change',
                            coplanarExtra,
                            planeChange,
                            originTopLevelBody,
                            originLowOrbitAltitudeMeters: fromCentralBody ? null : api.getLowOrbitAltitude(originBody, meta),
                            originLowOrbitRadiusMeters: originPeriapsis,
                            targetEndpointRadiusMeters: context.targetRadius,
                        },
                    };
                }
            }

            return {
                dv: Number.isFinite(options?.ipsBranchDV) ? options.ipsBranchDV : api.DEFAULT_IPS_BRANCH_DV,
                branchType: 'escape_to_intercept',
                debug: {
                    source: 'options.ipsBranchDV',
                    placeholder: true,
                },
            };
        }

        const isMoonTransfer = body.parent && body.parent !== meta?.centralBody
            && segment.to.nodeKey === segment.primaryNodeKey
            && (
                (segment.from.bodyId === body.parent && (segment.from.nodeKey === 'orbit' || segment.from.nodeKey === api.getNodeKeys(bodies[body.parent])[0]))
                || (segment.from.nodeKey === 'orbit' && segment.from.bodyId !== segment.to.bodyId)
            );
        if (isMoonTransfer) {
            const hostBody = bodies[body.parent];
            const context = api.computeMoonTransferContext(hostBody, body, meta, 'periapsis');
            const fromHostIntercept = segment.from.bodyId === hostBody.id && segment.from.nodeKey === api.getNodeKeys(hostBody)[0];
            const isTopLevelHostArrival = hostBody.parent === meta?.centralBody;
            let coplanarExtra = Math.abs(context.transferDepartSpeed - context.originSpeed);
            let planeChangeSpeed = context.transferArriveSpeed;
            if (fromHostIntercept && isTopLevelHostArrival) {
                const originTopLevelBody = _resolveTransferOriginTopLevelBody(options?.routeContext?.startPoint?.body, bodies, meta);
                const hostArrivalContext = originTopLevelBody && originTopLevelBody !== hostBody.id
                    ? api.computeInterplanetaryContext(bodies[originTopLevelBody], hostBody, meta, bodies[meta?.centralBody])
                    : null;
                const hostSoiRadius = Number(api.getPhysics(hostBody).soiRadius) || 0;
                const retargetScale = hostSoiRadius > 0
                    ? Math.max(0, Math.min(1, context.targetRadius / hostSoiRadius))
                    : 0;
                coplanarExtra = Math.abs(
                    (hostArrivalContext?.vinfArriveCoplanar ?? 0) - context.vinfDepartCoplanar,
                ) * retargetScale;
                planeChangeSpeed = hostArrivalContext?.vinfArriveCombined ?? context.transferArriveSpeed;
            }
            const planeChange = api.planeChangeDeltaV(planeChangeSpeed, context.planeAngle);
            return {
                dv: coplanarExtra + planeChange,
                branchType: 'escape_to_intercept',
                debug: {
                    source: 'formula.moon_transfer',
                    coplanarExtra,
                    planeChange,
                    hostBodyId: hostBody.id,
                    fromHostIntercept,
                    isTopLevelHostArrival,
                    planeChangeSpeed,
                    hostLowOrbitAltitudeMeters: api.getLowOrbitAltitude(hostBody, meta),
                    hostLowOrbitRadiusMeters: context.originRadius,
                    targetEndpointRadiusMeters: context.targetRadius,
                },
            };
        }

        if (segment.from.nodeKey === 'orbit' && segment.to.nodeKey === segment.primaryNodeKey) {
            return {
                dv: Number(body.nodes?.[segment.primaryNodeKey]) || 0,
                branchType: 'escape_to_intercept',
                debug: {
                    source: `body.nodes.${segment.primaryNodeKey}`,
                    hostRelative: true,
                },
            };
        }

        return {
            dv: 0,
            branchType: 'escape_to_intercept',
            debug: {
                unresolved: true,
                from: segment.from,
                to: segment.to,
            },
        };
    }

    /**
     * Inputs: target top-level body, central body, and metadata.
     * Outputs: context shaped like interplanetary arrival from central low orbit.
     */
    function _computeCentralBodyOriginArrivalContext(targetBody, centralBody, meta) {
        const context = api.computeCentralBodyTransferContext(targetBody, centralBody, meta);
        return {
            ...context,
            originSpeed: context.centralLowOrbitSpeed,
            targetRadius: context.outerRadius,
            targetSpeed: context.outerSpeed,
            transferArriveSpeed: context.transferOuterSpeed,
            vinfDepartCoplanar: 0,
            vinfArriveCoplanar: context.vinfAtOuterCoplanar,
            vinfArriveCombined: context.vinfAtOuterCombined,
        };
    }

    /**
     * Inputs: route segment, body lookup, metadata, and evaluation options.
     * Outputs: branch result for escaping a moon toward a different top-level destination.
     */
    function calculateMoonHostEscapeBranch(segment, bodies, meta, options) {
        const hostBody = bodies[segment.bodyId];
        const moonBody = bodies[segment.from.bodyId];
        const destinationTopLevelBody = bodies[_resolveTransferOriginTopLevelBody(
            options?.routeContext?.endPoint?.body,
            bodies,
            meta,
        )];
        const centralBody = bodies[meta?.centralBody];
        if (!hostBody || !moonBody || !destinationTopLevelBody || !centralBody) {
            return _emptyBranchResult(segment, 'moon_host_escape');
        }

        const moonContext = api.computeMoonTransferContext(hostBody, moonBody, meta, 'periapsis');
        const hostDepartureContext = api.computeInterplanetaryContext(
            hostBody,
            destinationTopLevelBody,
            meta,
            centralBody,
        );
        const hostSoiRadius = Number(api.getPhysics(hostBody).soiRadius) || 0;
        const retargetScale = hostSoiRadius > 0
            ? Math.max(0, Math.min(1, moonContext.targetRadius / hostSoiRadius))
            : 0;
        const coplanarExtra = Math.abs(
            hostDepartureContext.vinfDepartCoplanar - moonContext.vinfArriveCoplanar,
        ) * retargetScale;
        const planeChangeSpeed = hostDepartureContext.vinfDepartCoplanar;
        const planeChange = api.planeChangeDeltaV(planeChangeSpeed, moonContext.planeAngle);

        return {
            dv: coplanarExtra + planeChange,
            branchType: 'moon_host_escape',
            debug: {
                source: 'formula.moon_host_escape',
                hostBodyId: hostBody.id,
                moonBodyId: moonBody.id,
                destinationTopLevelBodyId: destinationTopLevelBody.id,
                coplanarExtra,
                planeChange,
                planeChangeSpeed,
                retargetScale,
                hostDepartureVinfDepartCoplanar: hostDepartureContext.vinfDepartCoplanar,
                moonTransferVinfArriveCoplanar: moonContext.vinfArriveCoplanar,
                hostSoiRadius,
                moonTransferTargetRadiusMeters: moonContext.targetRadius,
            },
        };
    }

    /**
     * Inputs: direct top-level transfer segment, body lookup, and metadata.
     * Outputs: branch result with escape, intercept, and capture breakdown entries.
     */
    function calculateDirectOrbitalTransferBranch(segment, bodies, meta) {
        const originBody = bodies[segment.originBodyId || segment.from.bodyId];
        const targetBody = bodies[segment.targetBodyId || segment.to.bodyId];
        const centerBody = bodies[segment.transferCenterBodyId || meta?.centralBody];

        if (
            !originBody
            || !targetBody
            || !centerBody
            || originBody.id === targetBody.id
            || originBody.parent !== centerBody.id
            || targetBody.parent !== centerBody.id
        ) {
            return _emptyBranchResult(segment, 'direct_orbital_transfer');
        }

        return _calculateDirectOrbitTransfer(
            segment,
            originBody,
            targetBody,
            centerBody,
            meta,
            'direct_orbital_transfer',
            'formula.direct_orbital_interplanetary_context',
        );
    }

    /**
     * Inputs: direct moon transfer segment, body lookup, and metadata.
     * Outputs: branch result with escape, intercept, and capture breakdown entries.
     */
    function calculateDirectMoonTransferBranch(segment, bodies, meta) {
        const originMoon = bodies[segment.originBodyId || segment.from.bodyId];
        const targetMoon = bodies[segment.targetBodyId || segment.to.bodyId];
        const hostBody = bodies[segment.hostBodyId || originMoon?.parent];

        if (
            !originMoon
            || !targetMoon
            || !hostBody
            || originMoon.id === targetMoon.id
            || originMoon.parent !== targetMoon.parent
            || originMoon.parent !== hostBody.id
            || originMoon.parent === meta?.centralBody
        ) {
            return _emptyBranchResult(segment, 'direct_moon_transfer');
        }

        return _calculateDirectOrbitTransfer(
            segment,
            originMoon,
            targetMoon,
            hostBody,
            meta,
            'direct_moon_transfer',
            'formula.direct_moon_interplanetary_context',
        );
    }

    /**
     * Inputs: origin/target orbiting bodies, their transfer center, and branch labels.
     * Outputs: branch result using the shared direct transfer formula.
     */
    function _calculateDirectOrbitTransfer(segment, originBody, targetBody, centerBody, meta, branchType, source) {
        const context = api.computeInterplanetaryContext(originBody, targetBody, meta, centerBody);
        const originMu = Number(api.getPhysics(originBody).mu) || 0;
        const originPeriapsis = api.lowOrbitRadius(originBody, meta);
        const targetPeriapsis = api.lowOrbitRadius(targetBody, meta);
        const localEscapeBurn = api.hyperbolicDepartureBurn(originMu, originPeriapsis, 0);
        const useSoiBudget = _usesLowGravitySoiBudget(branchType, originBody, localEscapeBurn, meta);
        const targetOrbitSpeed = Math.sqrt((Number(api.getPhysics(targetBody).mu) || 0) / targetPeriapsis);
        const departureBurn = useSoiBudget
            ? localEscapeBurn + context.vinfDepartCoplanar
            : api.hyperbolicDepartureBurn(
                originMu,
                originPeriapsis,
                context.vinfDepartCoplanar,
            );
        const planeChange = api.planeChangeDeltaV(context.originSpeed, context.planeAngle);
        const captureBurn = useSoiBudget
            ? context.vinfArriveCombined
            : api.hyperbolicCaptureBurn(
                Number(api.getPhysics(targetBody).mu) || 0,
                targetPeriapsis,
                context.vinfArriveCombined,
                targetOrbitSpeed,
            );
        const dv = departureBurn + planeChange + captureBurn;
        const transferInjectionBurn = departureBurn - localEscapeBurn;
        const interceptBurn = transferInjectionBurn + planeChange;

        if (!Number.isFinite(dv)) {
            return _emptyBranchResult(segment, branchType);
        }

        return {
            dv,
            branchType,
            breakdownEntries: [
                {
                    bodyId: originBody.id,
                    nodeKey: 'escape',
                    dv: localEscapeBurn,
                    rawDv: departureBurn,
                    markerBodyId: originBody.id,
                },
                {
                    bodyId: targetBody.id,
                    nodeKey: 'intercept',
                    dv: interceptBurn,
                    markerBodyId: centerBody.id,
                },
                {
                    bodyId: targetBody.id,
                    nodeKey: 'orbit',
                    dv: captureBurn,
                    markerBodyId: targetBody.id,
                },
            ],
            debug: {
                source,
                originBodyId: originBody.id,
                targetBodyId: targetBody.id,
                centerBodyId: centerBody.id,
                budgetModel: useSoiBudget ? 'low_gravity_soi_budget' : 'hyperbolic_low_orbit',
                localEscapeBurn,
                departureVinf: context.vinfDepartCoplanar,
                arrivalVinf: context.vinfArriveCombined,
                departureBurn,
                transferInjectionBurn,
                interceptBurn,
                planeChange,
                captureBurn,
                originLowOrbitAltitudeMeters: api.getLowOrbitAltitude(originBody, meta),
                originLowOrbitRadiusMeters: originPeriapsis,
                targetLowOrbitAltitudeMeters: api.getLowOrbitAltitude(targetBody, meta),
                targetLowOrbitRadiusMeters: targetPeriapsis,
                originOrbitRadiusMeters: context.originRadius,
                targetOrbitRadiusMeters: context.targetRadius,
            },
        };
    }

    /**
     * Inputs: direct transfer branch, origin body, local escape burn, and metadata.
     * Outputs: true when low-gravity top-level departures should use SOI-budget terms.
     */
    function _usesLowGravitySoiBudget(branchType, originBody, localEscapeBurn, meta) {
        return Boolean(
            branchType === 'direct_orbital_transfer'
            && originBody?.id !== meta?.originBody
            && localEscapeBurn < LOW_GRAVITY_ESCAPE_BUDGET_DV
        );
    }

    /**
     * Inputs: route segment, body lookup, metadata, and evaluation options.
     * Outputs: branch result for transfers involving the central body's low orbit.
     */
    function calculateCentralBodyTransferBranch(segment, bodies, meta, options) {
        const centralBody = bodies[meta?.centralBody];
        if (!centralBody) {
            return _emptyBranchResult(segment, 'central_body_transfer');
        }

        const travellingToCentralBody = segment.to.bodyId === meta?.centralBody;
        const routePoint = travellingToCentralBody
            ? options?.routeContext?.startPoint
            : options?.routeContext?.endPoint;
        const outerBodyId = _resolveTransferOriginTopLevelBody(routePoint?.body, bodies, meta);
        const outerBody = bodies[outerBodyId];
        if (!outerBody || outerBody.id === centralBody.id) {
            return {
                dv: Number(centralBody.nodes?.orbit) || 0,
                branchType: 'central_body_transfer',
                debug: {
                    source: 'body.nodes.orbit',
                    fallback: true,
                },
            };
        }

        const context = api.computeCentralBodyTransferContext(outerBody, centralBody, meta);
        if (travellingToCentralBody) {
            const outerMu = Number(api.getPhysics(outerBody).mu) || 0;
            const outerPeriapsis = api.lowOrbitRadius(outerBody, meta);
            const localEscape = api.hyperbolicDepartureBurn(outerMu, outerPeriapsis, 0);
            const departureBurn = api.hyperbolicDepartureBurn(outerMu, outerPeriapsis, context.vinfAtOuterCoplanar);
            const coplanarExtra = departureBurn - localEscape;
            const planeChange = api.planeChangeDeltaV(context.outerSpeed, context.planeAngle);
            return {
                dv: coplanarExtra + planeChange + context.centralLowOrbitInsertion,
                branchType: 'central_body_transfer',
                debug: {
                    source: 'formula.outer_orbit_to_central_low_orbit',
                    outerBodyId: outerBody.id,
                    centralBodyId: centralBody.id,
                    coplanarExtra,
                    planeChange,
                    centralLowOrbitInsertion: context.centralLowOrbitInsertion,
                    centralLowOrbitAltitudeMeters: api.getLowOrbitAltitude(centralBody, meta),
                    centralLowOrbitRadiusMeters: context.centralLowOrbitRadius,
                },
            };
        }

        return {
            dv: context.centralLowOrbitDeparture,
            branchType: 'central_body_transfer',
            debug: {
                source: 'formula.central_low_orbit_to_outer_orbit',
                outerBodyId: outerBody.id,
                centralBodyId: centralBody.id,
                centralLowOrbitDeparture: context.centralLowOrbitDeparture,
                centralLowOrbitAltitudeMeters: api.getLowOrbitAltitude(centralBody, meta),
                centralLowOrbitRadiusMeters: context.centralLowOrbitRadius,
            },
        };
    }

    /**
     * Inputs: route segment and branch type label.
     * Outputs: zero-DV unresolved branch result.
     */
    function _emptyBranchResult(segment, branchType) {
        return {
            dv: 0,
            branchType,
            debug: {
                unresolved: true,
                from: segment.from,
                to: segment.to,
            },
        };
    }

    /**
     * Inputs: starting body id, body lookup, and system metadata.
     * Outputs: top-level body id used for transfer context.
     */
    function _resolveTransferOriginTopLevelBody(startBodyId, bodies, meta) {
        let currentBodyId = startBodyId;
        while (currentBodyId && bodies[currentBodyId]) {
            const parentId = bodies[currentBodyId].parent;
            if (parentId === meta?.centralBody || parentId == null) {
                return currentBodyId;
            }
            currentBodyId = parentId;
        }
        return startBodyId;
    }

    Object.assign(api, {
        calculateCentralBodyTransferBranch,
        calculateDirectMoonTransferBranch,
        calculateDirectOrbitalTransferBranch,
        calculateEscapeInterceptBranch,
        calculateMoonHostEscapeBranch,
    });
})(typeof window !== 'undefined' ? window : globalThis);
