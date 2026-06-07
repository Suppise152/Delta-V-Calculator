(function attachDeltaVCalcLocalBranches(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};

    /**
     * Inputs: route segment, body lookup, and system metadata.
     * Outputs: branch result for surface-to-orbit or orbit-to-surface.
     */
    function calculateSurfaceOrbitBranch(segment, bodies, meta) {
        const body = bodies[segment.bodyId];
        if (!body) return _emptyBranchResult(segment, 'surface_orbit');

        if (segment.from.nodeKey === 'land' && segment.to.nodeKey === 'orbit') {
            const dvToOrbit = _configuredDv(body.surface?.dvToOrbit, body.nodes?.orbit);
            return {
                dv: dvToOrbit,
                branchType: 'surface_to_orbit',
                debug: {
                    source: body.surface?.dvToOrbit == null ? 'body.nodes.orbit' : 'body.surface.dvToOrbit',
                    altitudeMeters: api.getLowOrbitAltitude(body, meta),
                    radiusMeters: api.lowOrbitRadius(body, meta),
                },
            };
        }

        if (segment.from.nodeKey === 'orbit' && segment.to.nodeKey === 'land') {
            const dvToLand = _configuredDv(body.surface?.dvToLand, body.nodes?.land);
            return {
                dv: dvToLand,
                branchType: 'orbit_to_surface',
                debug: {
                    source: body.surface?.dvToLand == null ? 'body.nodes.land' : 'body.surface.dvToLand',
                    altitudeMeters: api.getLowOrbitAltitude(body, meta),
                    radiusMeters: api.lowOrbitRadius(body, meta),
                },
            };
        }

        return _emptyBranchResult(segment, 'surface_orbit');
    }

    /**
     * Inputs: primary configured value and fallback value.
     * Outputs: finite configured DV, falling back to zero.
     */
    function _configuredDv(primaryValue, fallbackValue) {
        const primary = Number(primaryValue);
        if (primaryValue != null && Number.isFinite(primary)) return primary;

        const fallback = Number(fallbackValue);
        return Number.isFinite(fallback) ? fallback : 0;
    }

    /**
     * Inputs: route segment, body lookup, and evaluation options.
     * Outputs: branch result for local or host-relative orbit escape.
     */
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

    /**
     * Inputs: route segment, body lookup, metadata, and evaluation options.
     * Outputs: branch result for capture from flyby/intercept to low orbit.
     */
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
                return {
                    dv: api.hyperbolicCaptureBurn(mu, periapsis, context.vinfArriveCombined, finalSpeed),
                    branchType: 'flyby_to_capture',
                    debug: {
                        source: 'formula.moon_capture',
                        hostRelative: true,
                        periapsis,
                        altitudeMeters: api.getLowOrbitAltitude(body, meta),
                        flybyAltitudeMeters: api.getFlybyPeriapsisAltitude(body, meta),
                        hostLowOrbitRadiusMeters: context.originRadius,
                        moonTransferTargetRadiusMeters: context.targetRadius,
                        hostBodyId: hostBody.id,
                    },
                };
            }

            if (body.parent === meta?.centralBody) {
                const originTopLevelBody = _resolveTransferOriginTopLevelBody(options?.routeContext?.startPoint?.body, bodies, meta);
                const originBody = bodies[originTopLevelBody];
                const centralBody = bodies[meta?.centralBody];
                if (originBody && centralBody) {
                    const context = originTopLevelBody === meta?.centralBody
                        ? _computeCentralBodyOriginArrivalContext(body, centralBody, meta)
                        : api.computeInterplanetaryContext(originBody, body, meta, centralBody);
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

    /**
     * Inputs: route segment and body lookup.
     * Outputs: branch result using configured node-to-node body data.
     */
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

    /**
     * Inputs: target top-level body, central body, and metadata.
     * Outputs: arrival-style transfer context for central-body routes.
     */
    function _computeCentralBodyOriginArrivalContext(targetBody, centralBody, meta) {
        const context = api.computeCentralBodyTransferContext(targetBody, centralBody, meta);
        return {
            ...context,
            targetRadius: context.outerRadius,
            targetSpeed: context.outerSpeed,
            transferArriveSpeed: context.transferOuterSpeed,
            vinfArriveCoplanar: context.vinfAtOuterCoplanar,
            vinfArriveCombined: context.vinfAtOuterCombined,
        };
    }

    Object.assign(api, {
        calculateBodyChainBranch,
        calculateFlybyCaptureBranch,
        calculateOrbitEscapeBranch,
        calculateSurfaceOrbitBranch,
    });
})(typeof window !== 'undefined' ? window : globalThis);
