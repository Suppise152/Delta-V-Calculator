(function attachDeltaVCalcLocalBranches(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};

    function calculateSurfaceOrbitBranch(segment, bodies, meta) {
        const body = bodies[segment.bodyId];
        if (!body) return _emptyBranchResult(segment, 'surface_orbit');

        if (segment.from.nodeKey === 'land' && segment.to.nodeKey === 'orbit') {
            return {
                dv: Number(body.surface?.dvToOrbit) || 0,
                branchType: 'surface_to_orbit',
                debug: {
                    source: 'body.surface.dvToOrbit',
                    altitudeMeters: api.getLowOrbitAltitude(body, meta),
                    radiusMeters: api.lowOrbitRadius(body, meta),
                },
            };
        }

        if (segment.from.nodeKey === 'orbit' && segment.to.nodeKey === 'land') {
            return {
                dv: Number(body.surface?.dvToLand) || 0,
                branchType: 'orbit_to_surface',
                debug: {
                    source: 'body.surface.dvToLand',
                    altitudeMeters: api.getLowOrbitAltitude(body, meta),
                    radiusMeters: api.lowOrbitRadius(body, meta),
                },
            };
        }

        return _emptyBranchResult(segment, 'surface_orbit');
    }

    function calculateOrbitEscapeBranch(segment, bodies, options) {
        const body = bodies[segment.bodyId];
        if (!body) return _emptyBranchResult(segment, 'orbit_escape');

        if (
            (segment.from.nodeKey === 'orbit' || (segment.nodeKey === 'escape' && segment.to.bodyId === api.INTERPLANETARY_ID))
            && (segment.to.bodyId === api.INTERPLANETARY_ID || segment.to.nodeKey === segment.primaryNodeKey)
        ) {
            if (body.parent && body.parent === options?.meta?.centralBody) {
                const mu = Number(api.getPhysics(body).mu) || 0;
                const periapsis = api.lowOrbitRadius(body, options?.meta);
                return {
                    dv: api.hyperbolicDepartureBurn(mu, periapsis, 0),
                    branchType: 'orbit_to_escape',
                    debug: {
                        source: 'formula.hyperbolic_departure',
                        periapsis,
                        altitudeMeters: api.getLowOrbitAltitude(body, options?.meta),
                        hostRelative: segment.from.bodyId !== body.id,
                    },
                };
            }

            if (segment.to.nodeKey === segment.primaryNodeKey && body.parent && body.parent !== options?.meta?.centralBody) {
                const hostBody = bodies[body.parent];
                const context = api.computeMoonTransferContext(hostBody, body, options?.meta, 'periapsis');
                const periapsis = api.lowOrbitRadius(body, options?.meta);
                const mu = Number(api.getPhysics(body).mu) || 0;
                return {
                    dv: api.hyperbolicDepartureBurn(mu, periapsis, context.vinfArriveCombined),
                    branchType: 'orbit_to_escape',
                    debug: {
                        source: 'formula.moon_escape',
                        hostRelative: true,
                        periapsis,
                        altitudeMeters: api.getLowOrbitAltitude(body, options?.meta),
                        hostLowOrbitAltitudeMeters: api.getLowOrbitAltitude(hostBody, options?.meta),
                        hostLowOrbitRadiusMeters: context.originRadius,
                        hostBodyId: hostBody.id,
                    },
                };
            }

            return {
                dv: Number.isFinite(options?.ipsBranchDV) ? options.ipsBranchDV : api.DEFAULT_IPS_BRANCH_DV,
                branchType: 'orbit_to_escape',
                debug: {
                    source: 'options.ipsBranchDV',
                    placeholder: true,
                },
            };
        }

        return _emptyBranchResult(segment, 'orbit_escape');
    }

    function calculateFlybyCaptureBranch(segment, bodies, meta, options) {
        const body = bodies[segment.bodyId];
        if (!body) return _emptyBranchResult(segment, 'flyby_capture');

        if (segment.from.nodeKey === segment.primaryNodeKey && segment.to.nodeKey === 'orbit') {
            if (body.parent && body.parent !== meta?.centralBody) {
                const hostBody = bodies[body.parent];
                const context = api.computeMoonTransferContext(hostBody, body, meta, 'periapsis');
                const periapsis = api.flybyPeriapsisRadius(body, meta);
                const mu = Number(api.getPhysics(body).mu) || 0;
                const finalSpeed = Math.sqrt(mu / periapsis);
                const originTopLevelBody = _resolveTransferOriginTopLevelBody(options?.routeContext?.startPoint?.body, bodies, meta);
                const isForeignHostArrival = originTopLevelBody && originTopLevelBody !== hostBody.id;
                let hostToMoonInsertion = 0;
                if (isForeignHostArrival) {
                    const hostArrivalContext = api.computeInterplanetaryContext(
                        bodies[originTopLevelBody],
                        hostBody,
                        meta,
                        bodies[meta?.centralBody],
                    );
                    const hostPeriapsis = api.flybyPeriapsisRadius(hostBody, meta);
                    const hostMu = Number(api.getPhysics(hostBody).mu) || 0;
                    const hostToMoonTransfer = api.hohmannTransferSpeeds(
                        hostMu,
                        hostPeriapsis,
                        context.targetRadius,
                    );
                    hostToMoonInsertion = api.hyperbolicCaptureBurn(
                        hostMu,
                        hostPeriapsis,
                        hostArrivalContext.vinfArriveCombined,
                        hostToMoonTransfer.speedA,
                    );
                    const hostSoiRadius = Number(api.getPhysics(hostBody).soiRadius) || 0;
                    const retargetScale = hostSoiRadius > 0
                        ? Math.max(0, Math.min(1, context.targetRadius / hostSoiRadius))
                        : 0;
                    hostToMoonInsertion += Math.abs(
                        hostArrivalContext.vinfArriveCoplanar - context.vinfDepartCoplanar,
                    ) * (1 - retargetScale);
                }
                return {
                    dv: hostToMoonInsertion + api.hyperbolicCaptureBurn(mu, periapsis, context.vinfArriveCombined, finalSpeed),
                    branchType: 'flyby_to_capture',
                    debug: {
                        source: 'formula.moon_capture',
                        hostRelative: true,
                        periapsis,
                        altitudeMeters: api.getLowOrbitAltitude(body, meta),
                        flybyAltitudeMeters: api.getFlybyPeriapsisAltitude(body, meta),
                        hostFlybyAltitudeMeters: isForeignHostArrival ? api.getFlybyPeriapsisAltitude(hostBody, meta) : null,
                        hostLowOrbitRadiusMeters: context.originRadius,
                        moonTransferTargetRadiusMeters: context.targetRadius,
                        hostBodyId: hostBody.id,
                        hostToMoonInsertion,
                        isForeignHostArrival,
                    },
                };
            }

            if (body.parent === meta?.centralBody) {
                const originTopLevelBody = _resolveTransferOriginTopLevelBody(options?.routeContext?.startPoint?.body, bodies, meta);
                const originBody = bodies[originTopLevelBody];
                const centralBody = bodies[meta?.centralBody];
                if (originBody && centralBody) {
                    const context = api.computeInterplanetaryContext(originBody, body, meta, centralBody);
                    const periapsis = api.flybyPeriapsisRadius(body, meta);
                    const mu = Number(api.getPhysics(body).mu) || 0;
                    const finalSpeed = Math.sqrt(mu / periapsis);
                    return {
                        dv: api.hyperbolicCaptureBurn(mu, periapsis, context.vinfArriveCombined, finalSpeed),
                        branchType: 'flyby_to_capture',
                        debug: {
                            source: 'formula.hyperbolic_capture',
                            arrivalMode: 'combined',
                            periapsis,
                            altitudeMeters: api.getLowOrbitAltitude(body, meta),
                            flybyAltitudeMeters: api.getFlybyPeriapsisAltitude(body, meta),
                        },
                    };
                }
            }

            return {
                dv: Number.isFinite(options?.ipsBranchDV) ? options.ipsBranchDV : api.DEFAULT_IPS_BRANCH_DV,
                branchType: 'flyby_to_capture',
                debug: {
                    source: 'options.ipsBranchDV',
                    placeholder: true,
                },
            };
        }

        return _emptyBranchResult(segment, 'flyby_capture');
    }

    function calculateBodyChainBranch(segment, bodies) {
        const body = bodies[segment.bodyId];
        if (!body) return _emptyBranchResult(segment, 'body_chain');

        const dv = Number(body.nodes?.[segment.to.nodeKey]) || 0;
        return {
            dv,
            branchType: 'body_chain',
            debug: {
                source: `body.nodes.${segment.to.nodeKey}`,
            },
        };
    }

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
        calculateBodyChainBranch,
        calculateFlybyCaptureBranch,
        calculateOrbitEscapeBranch,
        calculateSurfaceOrbitBranch,
    });
})(typeof window !== 'undefined' ? window : globalThis);
