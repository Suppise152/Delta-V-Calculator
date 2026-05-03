(function attachDeltaVCalcPhysics(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};

    function circularSpeed(mu, radius) {
        return Math.sqrt(mu / radius);
    }

    function relativeSpeed(speedA, speedB, angleRad) {
        return Math.sqrt(
            (speedA * speedA)
            + (speedB * speedB)
            - (2 * speedA * speedB * Math.cos(angleRad))
        );
    }

    function hyperbolicDepartureBurn(mu, periapsisRadius, vInf) {
        return Math.sqrt((vInf * vInf) + ((2 * mu) / periapsisRadius)) - Math.sqrt(mu / periapsisRadius);
    }

    function hyperbolicCaptureBurn(mu, periapsisRadius, vInf, finalSpeed) {
        return Math.sqrt((vInf * vInf) + ((2 * mu) / periapsisRadius)) - finalSpeed;
    }

    function hohmannTransferSpeeds(mu, radiusA, radiusB) {
        const semiMajorAxis = (radiusA + radiusB) / 2;
        const speedA = Math.sqrt(mu * ((2 / radiusA) - (1 / semiMajorAxis)));
        const speedB = Math.sqrt(mu * ((2 / radiusB) - (1 / semiMajorAxis)));
        return { speedA, speedB };
    }

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

    function planeChangeDeltaV(speed, angleRad) {
        return 2 * speed * Math.sin(angleRad / 2);
    }

    function bodyInclinationAngle(body) {
        return Math.PI * (Number(body.orbit?.inclination) || 0) / 180;
    }

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

    function orbitalSpeed(mu, semiMajorAxis, radius) {
        return Math.sqrt(mu * ((2 / radius) - (1 / semiMajorAxis)));
    }

    function getPhysics(body) {
        return body?.physics || {};
    }

    function constrainedPeriapsisRadius(body, altitudeMeters) {
        const physics = getPhysics(body);
        const bodyRadius = Number(physics.radius) || 0;
        const soiRadius = Number(physics.soiRadius) || 0;
        const requestedRadius = bodyRadius + altitudeMeters;
        if (!soiRadius) return requestedRadius;
        return Math.min(requestedRadius, Math.max(bodyRadius + 1, soiRadius * 0.95));
    }

    function lowOrbitRadius(body, meta) {
        return constrainedPeriapsisRadius(body, api.getLowOrbitAltitude(body, meta));
    }

    function flybyPeriapsisRadius(body, meta) {
        return constrainedPeriapsisRadius(body, api.getFlybyPeriapsisAltitude(body, meta));
    }

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
        circularSpeed,
        computeInterplanetaryContext,
        computeMoonTransferContext,
        flybyPeriapsisRadius,
        getPhysics,
        hohmannTransferSpeeds,
        hyperbolicCaptureBurn,
        hyperbolicDepartureBurn,
        lowOrbitRadius,
        orbitalRadius,
        orbitalSpeed,
        planeAngle,
        planeChangeDeltaV,
        relativeSpeed,
    });
})(typeof window !== 'undefined' ? window : globalThis);
