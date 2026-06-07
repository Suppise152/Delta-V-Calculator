(function attachDeltaVCalcPhysics(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};

    /**
     * Inputs: angle in degrees.
     * Outputs: angle normalized to [-180, 180], or null for invalid input.
     */
    function normalizeAngleDegrees(angleDeg) {
        if (!Number.isFinite(angleDeg)) return null;
        let normalized = ((angleDeg + 180) % 360 + 360) % 360 - 180;
        if (Object.is(normalized, -0)) normalized = 0;
        return normalized;
    }

    /**
     * Inputs: gravitational parameter and orbital radius.
     * Outputs: circular orbital speed.
     */
    function circularSpeed(mu, radius) {
        return Math.sqrt(mu / radius);
    }

    /**
     * Inputs: two speeds and the angle between velocity vectors in radians.
     * Outputs: magnitude of the relative velocity.
     */
    function relativeSpeed(speedA, speedB, angleRad) {
        return Math.sqrt(
            (speedA * speedA)
            + (speedB * speedB)
            - (2 * speedA * speedB * Math.cos(angleRad))
        );
    }

    /**
     * Inputs: body mu, periapsis radius, and hyperbolic excess speed.
     * Outputs: impulsive burn from circular orbit to hyperbolic departure.
     */
    function hyperbolicDepartureBurn(mu, periapsisRadius, vInf) {
        return Math.sqrt((vInf * vInf) + ((2 * mu) / periapsisRadius)) - Math.sqrt(mu / periapsisRadius);
    }

    /**
     * Inputs: body mu, periapsis radius, arrival v-infinity, and final orbital speed.
     * Outputs: impulsive capture burn at periapsis.
     */
    function hyperbolicCaptureBurn(mu, periapsisRadius, vInf, finalSpeed) {
        return Math.sqrt((vInf * vInf) + ((2 * mu) / periapsisRadius)) - finalSpeed;
    }

    /**
     * Inputs: central mu and transfer endpoint radii.
     * Outputs: transfer-orbit speeds at both endpoints.
     */
    function hohmannTransferSpeeds(mu, radiusA, radiusB) {
        const semiMajorAxis = (radiusA + radiusB) / 2;
        const speedA = Math.sqrt(mu * ((2 / radiusA) - (1 / semiMajorAxis)));
        const speedB = Math.sqrt(mu * ((2 / radiusB) - (1 / semiMajorAxis)));
        return { speedA, speedB };
    }

    /**
     * Inputs: central mu and transfer endpoint radii.
     * Outputs: half-period transfer time, or null if inputs are invalid.
     */
    function hohmannTransferTime(mu, radiusA, radiusB) {
        if (!(mu > 0) || !(radiusA > 0) || !(radiusB > 0)) return null;
        const semiMajorAxis = (radiusA + radiusB) / 2;
        return Math.PI * Math.sqrt((semiMajorAxis ** 3) / mu);
    }

    /**
     * Inputs: two orbiting bodies.
     * Outputs: relative orbital plane angle in radians.
     */
    function planeAngle(bodyA, bodyB) {
        const incA = Math.PI * (Number(bodyA.orbit?.inclination) || 0) / 180;
        const incB = Math.PI * (Number(bodyB.orbit?.inclination) || 0) / 180;
        const lanA = Math.PI * (Number(bodyA.orbit?.longitudeOfAscendingNode) || 0) / 180;
        const lanB = Math.PI * (Number(bodyB.orbit?.longitudeOfAscendingNode) || 0) / 180;

        const cosine = (
            (Math.cos(incA) * Math.cos(incB))
            + (Math.sin(incA) * Math.sin(incB) * Math.cos(lanA - lanB))
        );
        return Math.acos(Math.max(-1, Math.min(1, cosine)));
    }

    /**
     * Inputs: burn speed and plane angle in radians.
     * Outputs: impulsive plane-change delta-v.
     */
    function planeChangeDeltaV(speed, angleRad) {
        return 2 * speed * Math.sin(angleRad / 2);
    }

    /**
     * Inputs: body with orbit metadata.
     * Outputs: inclination in radians.
     */
    function bodyInclinationAngle(body) {
        return Math.PI * (Number(body.orbit?.inclination) || 0) / 180;
    }

    /**
     * Inputs: body and radius location name.
     * Outputs: orbital radius for periapsis, apoapsis, or semi-major axis.
     */
    function orbitalRadius(body, location) {
        if (location === 'periapsis' && body.orbit?.periapsisRadius != null) {
            return Number(body.orbit.periapsisRadius);
        }
        if (location === 'apoapsis' && body.orbit?.apoapsisRadius != null) {
            return Number(body.orbit.apoapsisRadius);
        }

        const sma = Number(body.orbit?.sma) || 0;
        const eccentricity = Number(body.orbit?.eccentricity) || 0;
        if (location === 'periapsis') return sma * (1 - eccentricity);
        if (location === 'apoapsis') return sma * (1 + eccentricity);
        return sma;
    }

    /**
     * Inputs: central mu, semi-major axis, and current radius.
     * Outputs: orbital speed from vis-viva.
     */
    function orbitalSpeed(mu, semiMajorAxis, radius) {
        return Math.sqrt(mu * ((2 / radius) - (1 / semiMajorAxis)));
    }

    /**
     * Inputs: body data object.
     * Outputs: physics object or empty object.
     */
    function getPhysics(body) {
        return body?.physics || {};
    }

    /**
     * Inputs: body data and requested altitude.
     * Outputs: periapsis radius clamped inside the body's SOI.
     */
    function constrainedPeriapsisRadius(body, altitudeMeters) {
        const physics = getPhysics(body);
        const bodyRadius = Number(physics.radius) || 0;
        const soiRadius = Number(physics.soiRadius) || 0;
        const requestedRadius = bodyRadius + altitudeMeters;
        if (!soiRadius) return requestedRadius;
        return Math.min(requestedRadius, Math.max(bodyRadius + 1, soiRadius * 0.95));
    }

    /**
     * Inputs: body data and system metadata.
     * Outputs: low-orbit radius from body center.
     */
    function lowOrbitRadius(body, meta) {
        return constrainedPeriapsisRadius(body, api.getLowOrbitAltitude(body, meta));
    }

    /**
     * Inputs: body data and system metadata.
     * Outputs: flyby/capture periapsis radius from body center.
     */
    function flybyPeriapsisRadius(body, meta) {
        return constrainedPeriapsisRadius(body, api.getFlybyPeriapsisAltitude(body, meta));
    }

    /**
     * Inputs: body data and optional central mu.
     * Outputs: orbital period in seconds, or null if unavailable.
     */
    function orbitalPeriod(body, centralMu = 0) {
        const siderealPeriod = Number(body?.orbit?.siderealPeriod);
        if (siderealPeriod > 0) return siderealPeriod;

        const sma = Number(body?.orbit?.sma) || 0;
        if (!(sma > 0) || !(centralMu > 0)) return null;

        return 2 * Math.PI * Math.sqrt((sma ** 3) / centralMu);
    }

    /**
     * Inputs: body data and optional central mu.
     * Outputs: mean motion in radians per second, or null.
     */
    function meanMotion(body, centralMu = 0) {
        const period = orbitalPeriod(body, centralMu);
        if (!(period > 0)) return null;
        return (2 * Math.PI) / period;
    }

    /**
     * Inputs: endpoint body ids, body lookup, and central body id.
     * Outputs: transfer-window diagram model, or null if not applicable.
     * Purpose: resolves nested moon/body selections to the orbiting bodies shown in the phase diagram.
     */
    function resolveTransferWindowModel(pointABodyId, pointBBodyId, bodies, centralBodyId) {
        const pointABody = bodies?.[pointABodyId];
        const pointBBody = bodies?.[pointBBodyId];
        if (!pointABody || !pointBBody) return null;

        if (pointABodyId === pointBBodyId) return null;
        if (_isAncestorBody(pointABodyId, pointBBodyId, bodies) || _isAncestorBody(pointBBodyId, pointABodyId, bodies)) {
            return null;
        }

        const sharedHost = _findSharedHost(pointABodyId, pointBBodyId, bodies, centralBodyId);
        const centerBodyId = sharedHost ?? centralBodyId;
        const fromBodyId = _resolveDiagramBody(pointABodyId, centerBodyId, bodies);
        const toBodyId = _resolveDiagramBody(pointBBodyId, centerBodyId, bodies);
        if (!fromBodyId || !toBodyId || fromBodyId === toBodyId) return null;

        const centerBody = bodies[centerBodyId];
        const fromBody = bodies[fromBodyId];
        const toBody = bodies[toBodyId];
        if (!centerBody || !fromBody || !toBody) return null;

        return {
            centerBodyId,
            centerLabel: centerBody.label,
            fromBodyId,
            fromLabel: fromBody.label,
            fromOrbitRadius: Number(fromBody.orbit?.sma) || 0,
            toBodyId,
            toLabel: toBody.label,
            toOrbitRadius: Number(toBody.orbit?.sma) || 0,
        };
    }

    /**
     * Inputs: origin body, target body, and central body.
     * Outputs: ideal Hohmann phase angle in degrees, or null.
     */
    function calculatePhaseAngleDegrees(originBody, targetBody, centralBody) {
        const centralMu = Number(getPhysics(centralBody).mu) || 0;
        const originRadius = Number(originBody?.orbit?.sma) || 0;
        const targetRadius = Number(targetBody?.orbit?.sma) || 0;
        const targetMeanMotion = meanMotion(targetBody, centralMu);
        const transferTime = hohmannTransferTime(centralMu, originRadius, targetRadius);

        if (!(originRadius > 0) || !(targetRadius > 0) || !(targetMeanMotion > 0) || !(transferTime > 0)) {
            return null;
        }

        return normalizeAngleDegrees((Math.PI - (targetMeanMotion * transferTime)) * (180 / Math.PI));
    }

    /**
     * Inputs: route endpoints, body lookup, and system metadata.
     * Outputs: arrival/departure transfer angles and diagram model.
     */
    function calculateTransferWindowAngles(pointA, pointB, bodies, meta) {
        const centralBodyId = meta?.centralBody;
        const transferModel = resolveTransferWindowModel(pointA?.body, pointB?.body, bodies, centralBodyId);
        if (!transferModel) {
            return {
                arrive: null,
                depart: null,
                model: null,
            };
        }

        const centerBody = bodies?.[transferModel.centerBodyId];
        const fromBody = bodies?.[transferModel.fromBodyId];
        const toBody = bodies?.[transferModel.toBodyId];
        if (!centerBody || !fromBody || !toBody) {
            return {
                arrive: null,
                depart: null,
                model: transferModel,
            };
        }

        return {
            arrive: calculatePhaseAngleDegrees(fromBody, toBody, centerBody),
            depart: normalizeAngleDegrees(-(calculatePhaseAngleDegrees(toBody, fromBody, centerBody))),
            model: transferModel,
        };
    }

    /**
     * Inputs: two body ids, body lookup, and central body id.
     * Outputs: shared non-central host id, or null.
     */
    function _findSharedHost(bodyAId, bodyBId, bodies, centralBodyId) {
        const bodyA = bodies?.[bodyAId];
        const bodyB = bodies?.[bodyBId];
        if (!bodyA?.parent || !bodyB?.parent) return null;
        if (bodyA.parent !== bodyB.parent) return null;
        if (bodyA.parent === centralBodyId) return null;
        return bodyA.parent;
    }

    /**
     * Inputs: selected body id, diagram center body id, and body lookup.
     * Outputs: body id that directly orbits the diagram center, or null.
     */
    function _resolveDiagramBody(bodyId, centerBodyId, bodies) {
        let currentId = bodyId;

        while (currentId) {
            const body = bodies?.[currentId];
            if (!body) return null;
            if (body.parent === centerBodyId) return currentId;
            if (!body.parent) return null;
            currentId = body.transferAngleDiagram || body.parent;
        }

        return null;
    }

    /**
     * Inputs: possible ancestor id, body id, and body lookup.
     * Outputs: boolean indicating ancestry through parent links.
     */
    function _isAncestorBody(ancestorId, bodyId, bodies) {
        let currentId = bodies?.[bodyId]?.parent ?? null;
        while (currentId) {
            if (currentId === ancestorId) return true;
            currentId = bodies?.[currentId]?.parent ?? null;
        }
        return false;
    }

    /**
     * Inputs: origin, target, metadata, and central body.
     * Outputs: velocities, radii, plane angle, and v-infinity values for interplanetary transfer.
     */
    function computeInterplanetaryContext(originBody, targetBody, meta, centralBody) {
        const starMu = Number(getPhysics(centralBody).mu) || 0;
        const originRadius = orbitalRadius(originBody, 'periapsis');
        const targetRadius = orbitalRadius(targetBody, 'periapsis');
        const originSpeed = orbitalSpeed(starMu, Number(originBody.orbit?.sma) || 0, originRadius);
        const targetSpeed = orbitalSpeed(starMu, Number(targetBody.orbit?.sma) || 0, targetRadius);
        const { speedA: transferDepartSpeed, speedB: transferArriveSpeed } = hohmannTransferSpeeds(
            starMu,
            originRadius,
            targetRadius,
        );
        const angle = planeAngle(originBody, targetBody);

        return {
            originRadius,
            targetRadius,
            originSpeed,
            targetSpeed,
            transferDepartSpeed,
            transferArriveSpeed,
            planeAngle: angle,
            vinfDepartCoplanar: Math.abs(transferDepartSpeed - originSpeed),
            vinfArriveCoplanar: Math.abs(targetSpeed - transferArriveSpeed),
            vinfArriveCombined: relativeSpeed(targetSpeed, transferArriveSpeed, angle),
        };
    }

    /**
     * Inputs: outer body, central body, and system metadata.
     * Outputs: low-orbit transfer context between central body and outer orbit.
     */
    function computeCentralBodyTransferContext(outerBody, centralBody, meta) {
        const centralMu = Number(getPhysics(centralBody).mu) || 0;
        const outerRadius = orbitalRadius(outerBody, 'periapsis');
        const centralLowOrbitRadius = lowOrbitRadius(centralBody, meta);
        const outerSpeed = orbitalSpeed(centralMu, Number(outerBody.orbit?.sma) || 0, outerRadius);
        const centralLowOrbitSpeed = circularSpeed(centralMu, centralLowOrbitRadius);
        const { speedA: transferOuterSpeed, speedB: transferCentralSpeed } = hohmannTransferSpeeds(
            centralMu,
            outerRadius,
            centralLowOrbitRadius,
        );
        const angle = bodyInclinationAngle(outerBody);

        return {
            outerBodyId: outerBody.id,
            centralBodyId: centralBody.id,
            outerRadius,
            centralLowOrbitRadius,
            outerSpeed,
            centralLowOrbitSpeed,
            transferOuterSpeed,
            transferCentralSpeed,
            planeAngle: angle,
            vinfAtOuterCoplanar: Math.abs(transferOuterSpeed - outerSpeed),
            vinfAtOuterCombined: relativeSpeed(outerSpeed, transferOuterSpeed, angle),
            centralLowOrbitInsertion: Math.abs(transferCentralSpeed - centralLowOrbitSpeed),
            centralLowOrbitDeparture: Math.abs(transferCentralSpeed - centralLowOrbitSpeed),
        };
    }

    /**
     * Inputs: host body, target moon/body, metadata, and target radius location.
     * Outputs: transfer context from host low orbit to target orbit.
     */
    function computeMoonTransferContext(hostBody, targetBody, meta, targetLocation = 'periapsis') {
        const hostMu = Number(getPhysics(hostBody).mu) || 0;
        const originRadius = lowOrbitRadius(hostBody, meta);
        const targetRadius = orbitalRadius(targetBody, targetLocation);
        const originSpeed = circularSpeed(hostMu, originRadius);
        const targetSpeed = orbitalSpeed(hostMu, Number(targetBody.orbit?.sma) || 0, targetRadius);
        const { speedA: transferDepartSpeed, speedB: transferArriveSpeed } = hohmannTransferSpeeds(
            hostMu,
            originRadius,
            targetRadius,
        );
        const angle = bodyInclinationAngle(targetBody);

        return {
            originRadius,
            targetRadius,
            originSpeed,
            targetSpeed,
            transferDepartSpeed,
            transferArriveSpeed,
            planeAngle: angle,
            vinfDepartCoplanar: Math.abs(transferDepartSpeed - originSpeed),
            vinfArriveCoplanar: Math.abs(targetSpeed - transferArriveSpeed),
            vinfArriveCombined: relativeSpeed(targetSpeed, transferArriveSpeed, angle),
        };
    }

    Object.assign(api, {
        bodyInclinationAngle,
        calculatePhaseAngleDegrees,
        calculateTransferWindowAngles,
        circularSpeed,
        computeInterplanetaryContext,
        computeCentralBodyTransferContext,
        computeMoonTransferContext,
        flybyPeriapsisRadius,
        getPhysics,
        hohmannTransferSpeeds,
        hohmannTransferTime,
        hyperbolicCaptureBurn,
        hyperbolicDepartureBurn,
        lowOrbitRadius,
        meanMotion,
        normalizeAngleDegrees,
        orbitalRadius,
        orbitalPeriod,
        orbitalSpeed,
        planeAngle,
        planeChangeDeltaV,
        relativeSpeed,
        resolveTransferWindowModel,
    });
})(typeof window !== 'undefined' ? window : globalThis);
