#!/usr/bin/env python3
"""Standalone Delta-V Calculator formula report.

This file is intended to be shareable as a single-file calculation reference.
It contains readable copies of the same JavaScript calculation modules used by
this site, then runs those modules with Node.js to produce the report. The
reporting wrapper is Python; the formulas are JavaScript so they can be lifted
into another JS project with minimal translation.

JSON pack requirements for --pack:
- Top-level object with `meta` and `bodies`.
- `meta.centralBody` is required; `meta.originBody` may define the default
  report origin. `meta.nodeModel` may define node keys and altitude defaults.
- Each body needs `id`, `label`, `parent`, `nodes`, `surface`, `orbit`, and
  `physics`.
- `nodes` supplies route keys such as `land`, `orbit`, `intercept`, and
  `flyby`. `surface` supplies `canAerobrake`, `dvToOrbit`, and `dvToLand`.
- `orbit` uses meters, seconds, and degrees: `sma`, `eccentricity`,
  `inclination`, `longitudeOfAscendingNode`, optional `siderealPeriod`, and
  periapsis/apoapsis radii when available.
- `physics` uses meters and m^3/s^2: `radius`, `mu`, `atmosphereHeight`, and
  optionally `soiRadius`.

Porting note:
- Copy `CALCULATOR_SOURCES` into a JavaScript project in
  `CALCULATOR_SOURCE_ORDER`, then call `jscalculate(pointA, pointB, options,
  bodies, meta)`. The embedded `data/stock.json` is only a default data pack;
  `--pack` can run the same formulas against another compatible JSON file.

Node.js is required because the authoritative calculator is JavaScript.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


DEFAULT_ORIGIN_BODY_ID = "kerbin"
DEFAULT_SURFACE_NODE_KEY = "land"
DEFAULT_IPS_BRANCH_DV = 1000
EMBEDDED_PACK_NAME = "embedded stock.json"

# Keep this order when porting the embedded calculator. Later modules attach to
# functions exported by earlier modules on globalThis.DeltaVCalc.
CALCULATOR_SOURCE_ORDER = [
    'src/calc/segment-types.js',
    'src/calc/physics.js',
    'src/calc/route-builder.js',
    'src/calc/assemble.js',
    'src/calc/branches/local.js',
    'src/calc/branches/transfer.js',
    'src/calc/index.js',
    'src/calculator.js',
]

CALCULATOR_SOURCES = {
    # Embedded site calculator source: src/calc/segment-types.js
    'src/calc/segment-types.js': r"""(function attachDeltaVCalcSegmentTypes(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const INTERPLANETARY_ID = 'interplanetary';
    const DEFAULT_IPS_BRANCH_DV = 1000;

    /**
     * Inputs: none.
     * Outputs: empty calculation result object.
     */
    function emptyResult() {
        return {
            totalDV: 0,
            breakdown: [],
            transferAngles: {
                arrive: null,
                depart: null,
                model: null,
            },
        };
    }

    /**
     * Inputs: body data object.
     * Outputs: ordered list of real node keys, excluding metadata comments.
     */
    function getNodeKeys(body) {
        return Object.keys(body?.nodes || {}).filter((key) => key !== 'comment');
    }

    /**
     * Inputs: endpoint point and body lookup.
     * Outputs: boolean indicating whether the point can be routed.
     */
    function isValidPoint(point, bodies) {
        if (!point?.body) return false;
        if (point.body === INTERPLANETARY_ID) return true;

        const body = bodies[point.body];
        if (!body) return false;

        return getNodeKeys(body).includes(point.node);
    }

    /**
     * Inputs: system metadata.
     * Outputs: node model with surface, orbit, flyby, and altitude defaults.
     */
    function getNodeModel(meta) {
        return meta?.nodeModel || {
            surfaceNodeKey: 'land',
            orbitNodeKey: 'orbit',
            flybyNodeKeys: ['flyby', 'intercept'],
            lowOrbitAltitudeMeters: 10000,
            flybyPeriapsisAltitudeMeters: 10000,
            lowOrbitAltitudeOverrides: {},
        };
    }

    /**
     * Inputs: body data object.
     * Outputs: physics object or null.
     */
    function getBodyPhysics(body) {
        return body?.physics || null;
    }

    /**
     * Inputs: body data and system metadata.
     * Outputs: low-orbit altitude in meters.
     * Purpose: centralizes altitude overrides and atmosphere clearance rules.
     */
    function getLowOrbitAltitude(body, meta) {
        const nodeModel = getNodeModel(meta);
        const overrides = nodeModel.lowOrbitAltitudeOverrides || {};
        if (Object.prototype.hasOwnProperty.call(overrides, body.id)) {
            return Number(overrides[body.id]) || 0;
        }

        const physics = getBodyPhysics(body);
        const atmosphereHeight = Number(physics?.atmosphereHeight) || 0;
        return Math.max(
            Number(nodeModel.lowOrbitAltitudeMeters) || 0,
            atmosphereHeight + (Number(nodeModel.lowOrbitAltitudeMeters) || 0),
        );
    }

    /**
     * Inputs: body data and system metadata.
     * Outputs: flyby/capture periapsis altitude in meters.
     */
    function getFlybyPeriapsisAltitude(body, meta) {
        const nodeModel = getNodeModel(meta);
        const physics = getBodyPhysics(body);
        const atmosphereHeight = Number(physics?.atmosphereHeight) || 0;
        return Math.max(
            Number(nodeModel.flybyPeriapsisAltitudeMeters) || 0,
            atmosphereHeight + (Number(nodeModel.flybyPeriapsisAltitudeMeters) || 0),
        );
    }

    /**
     * Inputs: body data and altitude in meters.
     * Outputs: radius from body center in meters, or null without physics data.
     */
    function getPhysicalRadius(body, altitudeMeters) {
        const physics = getBodyPhysics(body);
        if (!physics) return null;
        return (Number(physics.radius) || 0) + (Number(altitudeMeters) || 0);
    }

    /**
     * Inputs: body, node key, and system metadata.
     * Outputs: canonical node descriptor for map/calculation consumers.
     */
    function describeCanonicalNodeState(body, nodeKey, meta) {
        const nodeModel = getNodeModel(meta);
        if (nodeKey === nodeModel.surfaceNodeKey) {
            return { type: 'surface', bodyId: body.id };
        }
        if (nodeKey === nodeModel.orbitNodeKey) {
            return {
                type: 'orbit',
                bodyId: body.id,
                altitudeMeters: getLowOrbitAltitude(body, meta),
                radiusMeters: getPhysicalRadius(body, getLowOrbitAltitude(body, meta)),
            };
        }
        if ((nodeModel.flybyNodeKeys || []).includes(nodeKey)) {
            return {
                type: 'flyby',
                bodyId: body.id,
                altitudeMeters: getFlybyPeriapsisAltitude(body, meta),
                radiusMeters: getPhysicalRadius(body, getFlybyPeriapsisAltitude(body, meta)),
            };
        }

        return { type: nodeKey, bodyId: body.id };
    }

    /**
     * Inputs: body id and node key.
     * Outputs: graph state id string.
     */
    function stateId(bodyId, nodeKey) {
        return `${bodyId}::${nodeKey}`;
    }

    /**
     * Inputs: graph state id string.
     * Outputs: parsed body id and node key.
     */
    function parseStateId(value) {
        if (value === INTERPLANETARY_ID) {
            return { bodyId: INTERPLANETARY_ID, nodeKey: null };
        }

        const [bodyId, nodeKey] = String(value).split('::');
        return { bodyId, nodeKey: nodeKey || null };
    }

    /**
     * Inputs: body data and node key.
     * Outputs: body id whose map marker should represent the node.
     */
    function resolveMarkerBodyId(body, nodeKey) {
        if (!body) return null;

        if (nodeKey === 'intercept' || nodeKey === 'flyby') {
            return body.parent || body.id;
        }

        return body.id;
    }

    /**
     * Inputs: body data and node key.
     * Outputs: human-readable breakdown label.
     */
    function formatEntryLabel(body, nodeKey) {
        if (!body || !nodeKey) return 'Transfer';

        if (nodeKey === 'orbit') {
            return `Low ${body.label} Orbit`;
        }

        const nodeLabel = {
            flyby: 'Fly-by',
            intercept: 'Intercept',
            land: 'Surface',
            escape: 'Escape',
        }[nodeKey] || nodeKey;

        return `${body.label} ${nodeLabel}`;
    }

    Object.assign(api, {
        DEFAULT_IPS_BRANCH_DV,
        INTERPLANETARY_ID,
        describeCanonicalNodeState,
        emptyResult,
        formatEntryLabel,
        getBodyPhysics,
        getFlybyPeriapsisAltitude,
        getLowOrbitAltitude,
        getNodeKeys,
        getNodeModel,
        getPhysicalRadius,
        isValidPoint,
        parseStateId,
        resolveMarkerBodyId,
        stateId,
    });
})(typeof window !== 'undefined' ? window : globalThis);
""",
    # Embedded site calculator source: src/calc/physics.js
    'src/calc/physics.js': r"""(function attachDeltaVCalcPhysics(global) {
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
        const bodyAHosts = _ancestorHostChain(bodyAId, bodies);
        const bodyBHosts = new Set(_ancestorHostChain(bodyBId, bodies));
        return bodyAHosts.find(hostId => hostId !== centralBodyId && bodyBHosts.has(hostId)) || null;
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
            currentId = body.parent;
        }

        return null;
    }

    /**
     * Inputs: body id and body lookup.
     * Outputs: parent chain from nearest host outward.
     */
    function _ancestorHostChain(bodyId, bodies) {
        const chain = [];
        let currentId = bodies?.[bodyId]?.parent || null;

        while (currentId) {
            chain.push(currentId);
            currentId = bodies?.[currentId]?.parent || null;
        }

        return chain;
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
""",
    # Embedded site calculator source: src/calc/route-builder.js
    'src/calc/route-builder.js': r"""(function attachDeltaVCalcRouteBuilder(global) {
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
""",
    # Embedded site calculator source: src/calc/assemble.js
    'src/calc/assemble.js': r"""(function attachDeltaVCalcAssemble(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const {
        formatEntryLabel,
        parseStateId,
        resolveMarkerBodyId,
        stateId,
    } = api;

    /**
     * Inputs: route graph, start/end state ids, body lookup, and system metadata.
     * Outputs: ordered state id path, or an empty array if no path exists.
     */
    function findPath(graph, startId, endId, bodies, meta) {
        if (startId === endId) return [startId];

        const queue = [startId];
        const previous = new Map([[startId, null]]);
        const targetState = parseStateId(endId);
        const targetBody = bodies?.[targetState.bodyId] || null;
        const targetHostId = targetBody?.parent || null;

        while (queue.length) {
            const currentId = queue.shift();
            const edges = _sortEdgesForTarget(graph.get(currentId) || [], currentId, targetState, targetHostId, bodies, meta);

            for (const edge of edges) {
                if (_shouldSkipEdgeForTarget(edge, targetState, targetHostId)) continue;
                if (previous.has(edge.to)) continue;

                previous.set(edge.to, currentId);
                if (edge.to === endId) {
                    return reconstructPath(previous, endId);
                }

                queue.push(edge.to);
            }
        }

        return [];
    }

    /**
     * Inputs: edge and final target context.
     * Outputs: true when the edge would over-commit to a host body before reaching its moon.
     */
    function _shouldSkipEdgeForTarget(edge, targetState, targetHostId) {
        return Boolean(
            edge.branchType === 'direct_orbital_transfer'
            && edge.targetBodyId
            && targetState?.bodyId !== edge.targetBodyId
            && targetHostId === edge.targetBodyId
        );
    }

    /**
     * Inputs: candidate edges plus current/target route context.
     * Outputs: edge list sorted to prefer sensible moon-host routing.
     */
    function _sortEdgesForTarget(edges, currentId, targetState, targetHostId, bodies, meta) {
        const currentState = parseStateId(currentId);
        const currentBody = bodies?.[currentState.bodyId] || null;
        if (!currentBody || currentState.nodeKey == null || !targetState?.bodyId) {
            return edges;
        }

        const centralBodyId = meta?.centralBody;
        const currentPrimaryNode = _getPrimaryNodeKey(currentBody);
        const currentIsMoonTransferNode = (
            currentBody.parent
            && currentBody.parent !== centralBodyId
            && (
                currentState.nodeKey === currentPrimaryNode
                || currentState.nodeKey === 'orbit'
            )
        );
        if (!currentIsMoonTransferNode) return edges;

        const targetIsSameHostSystem = targetState.bodyId === currentBody.parent || targetHostId === currentBody.parent;
        return [...edges].sort((left, right) => (
            _edgePriority(left, currentBody, targetIsSameHostSystem)
            - _edgePriority(right, currentBody, targetIsSameHostSystem)
        ));
    }

    /**
     * Inputs: edge, current body, and whether the target stays in the same host system.
     * Outputs: numeric priority used by moon transfer pathfinding.
     */
    function _edgePriority(edge, currentBody, targetIsSameHostSystem) {
        if (targetIsSameHostSystem) {
            if (edge.branchType === 'direct_moon_transfer') return 0;
            if (edge.to === stateId(currentBody.parent, 'orbit')) return 1;
            if (edge.to === api.INTERPLANETARY_ID) return 3;
            return 2;
        }

        if (edge.to === api.INTERPLANETARY_ID) return 0;
        if (edge.to === stateId(currentBody.parent, 'orbit')) return 2;
        return 1;
    }

    /**
     * Inputs: body data.
     * Outputs: first configured node key or null.
     */
    function _getPrimaryNodeKey(body) {
        return api.getNodeKeys(body)[0] || null;
    }

    /**
     * Inputs: predecessor map from pathfinding and final state id.
     * Outputs: ordered state id path from start to end.
     */
    function reconstructPath(previous, endId) {
        const path = [];
        let currentId = endId;

        while (currentId) {
            path.push(currentId);
            currentId = previous.get(currentId) ?? null;
        }

        return path.reverse();
    }

    /**
     * Inputs: graph edge and body lookup.
     * Outputs: basic display breakdown entry.
     */
    function buildBreakdownEntry(edge, bodies) {
        const body = bodies[edge.bodyId];
        const label = formatEntryLabel(body, edge.nodeKey);

        return {
            label,
            dv: edge.dv,
            type: edge.nodeKey,
            markerBodyId: resolveMarkerBodyId(body, edge.nodeKey),
            zeroed: false,
        };
    }

    /**
     * Inputs: route graph, endpoint points, body lookup, and system metadata.
     * Outputs: ordered calculation segment descriptors.
     * Purpose: turns graph path edges into branch-evaluator inputs.
     */
    function collectRouteSegments(graph, startPoint, endPoint, bodies, meta) {
        const path = findPath(
            graph,
            stateId(startPoint.body, startPoint.node),
            stateId(endPoint.body, endPoint.node),
            bodies,
            meta,
        );

        if (path.length < 2) return [];

        const segments = [];
        for (let index = 0; index < path.length - 1; index += 1) {
            const fromId = path[index];
            const toId = path[index + 1];
            const edge = (graph.get(fromId) || []).find((candidate) => candidate.to === toId);
            if (!edge) continue;

            const body = bodies[edge.bodyId];
            const nodeKeys = body ? api.getNodeKeys(body) : [];
            segments.push({
                from: parseStateId(fromId),
                to: parseStateId(toId),
                bodyId: edge.bodyId,
                nodeKey: edge.nodeKey,
                primaryNodeKey: nodeKeys[0] || edge.nodeKey,
                branchType: edge.branchType || null,
                originBodyId: edge.originBodyId || null,
                targetBodyId: edge.targetBodyId || null,
                hostBodyId: edge.hostBodyId || null,
                transferCenterBodyId: edge.transferCenterBodyId || null,
            });
        }

        return segments;
    }

    /**
     * Inputs: route graph, endpoint points, body lookup, and system metadata.
     * Outputs: legacy/simple breakdown entries from raw graph edges.
     */
    function collectLegBreakdown(graph, startPoint, endPoint, bodies, meta) {
        const path = findPath(
            graph,
            stateId(startPoint.body, startPoint.node),
            stateId(endPoint.body, endPoint.node),
            bodies,
            meta,
        );

        if (path.length < 2) return [];

        const breakdown = [];
        for (let index = 0; index < path.length - 1; index += 1) {
            const fromId = path[index];
            const toId = path[index + 1];
            const edge = (graph.get(fromId) || []).find((candidate) => candidate.to === toId);
            if (!edge) continue;

            breakdown.push(buildBreakdownEntry(edge, bodies));
        }

        return breakdown;
    }

    Object.assign(api, {
        buildBreakdownEntry,
        collectLegBreakdown,
        collectRouteSegments,
        findPath,
        reconstructPath,
    });
})(typeof window !== 'undefined' ? window : globalThis);
""",
    # Embedded site calculator source: src/calc/branches/local.js
    'src/calc/branches/local.js': r"""(function attachDeltaVCalcLocalBranches(global) {
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
""",
    # Embedded site calculator source: src/calc/branches/transfer.js
    'src/calc/branches/transfer.js': r"""(function attachDeltaVCalcTransferBranches(global) {
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
""",
    # Embedded site calculator source: src/calc/index.js
    'src/calc/index.js': r"""(function attachDeltaVCalcIndex(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const {
        DEFAULT_IPS_BRANCH_DV,
        buildRouteGraph,
        collectRouteSegments,
        emptyResult,
        isValidPoint,
    } = api;

    /**
     * Inputs: partial calculation options from UI or caller.
     * Outputs: normalized options with defaults and booleans applied.
     */
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

    /**
     * Inputs: route endpoints, options, body lookup, and system metadata.
     * Outputs: total DV, breakdown entries, transfer angles, and debug route data.
     * Purpose: top-level calculation pipeline for one-way, return-only, or round-trip routes.
     */
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

    /**
     * Inputs: route segments, body lookup, metadata, normalized options, and route direction context.
     * Outputs: evaluated breakdown and debug segment list.
     */
    function evaluateRouteSegments(segments, bodies, meta, options, routeContext) {
        const breakdown = [];
        const debugSegments = [];
        const evaluationOptions = { ...options, meta, routeContext };

        for (const segment of segments) {
            const branchResult = evaluateSegmentBranch(segment, bodies, meta, evaluationOptions);
            const aerobrakeAdjustment = getAerobrakeAdjustment(segment, branchResult, routeContext, options, bodies);
            const adjustedDv = aerobrakeAdjustment.zeroed ? 0 : branchResult.dv;
            breakdown.push(...buildSegmentBreakdownEntries(
                segment,
                branchResult,
                adjustedDv,
                aerobrakeAdjustment,
                bodies,
            ));
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

    /**
     * Inputs: segment, branch result, adjusted DV, aerobrake adjustment, and body lookup.
     * Outputs: display-ready breakdown entries for that segment.
     */
    function buildSegmentBreakdownEntries(segment, branchResult, adjustedDv, aerobrakeAdjustment, bodies) {
        if (Array.isArray(branchResult.breakdownEntries) && branchResult.breakdownEntries.length) {
            return branchResult.breakdownEntries.map((entry) => {
                const body = bodies[entry.bodyId];
                const nodeKey = entry.nodeKey;
                return {
                    label: entry.label || api.formatEntryLabel(body, nodeKey),
                    dv: entry.dv,
                    rawDv: entry.rawDv ?? entry.dv,
                    type: nodeKey,
                    markerBodyId: entry.markerBodyId ?? api.resolveMarkerBodyId(body, nodeKey),
                    zeroed: false,
                    aerobrake: null,
                };
            });
        }

        const body = bodies[segment.bodyId];
        return [{
            label: api.formatEntryLabel(body, segment.nodeKey),
            dv: adjustedDv,
            rawDv: branchResult.dv,
            type: segment.nodeKey,
            markerBodyId: api.resolveMarkerBodyId(body, segment.nodeKey),
            zeroed: aerobrakeAdjustment.zeroed,
            aerobrake: aerobrakeAdjustment.zeroed ? aerobrakeAdjustment.mode : null,
        }];
    }

    /**
     * Inputs: segment, body lookup, metadata, and evaluation options.
     * Outputs: branch result containing DV, branch type, and debug data.
     * Purpose: dispatches a route segment to the specialized calculation branch.
     */
    function evaluateSegmentBranch(segment, bodies, meta, options) {
        if (segment.branchType === 'direct_moon_transfer') {
            return api.calculateDirectMoonTransferBranch(segment, bodies, meta, options);
        }

        if (segment.branchType === 'direct_orbital_transfer') {
            return api.calculateDirectOrbitalTransferBranch(segment, bodies, meta, options);
        }

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

    /**
     * Inputs: route segment.
     * Outputs: true when segment is same-body surface/orbit movement.
     */
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

    /**
     * Inputs: route segment.
     * Outputs: true when segment represents orbit-to-escape movement.
     */
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

    /**
     * Inputs: route segment, body lookup, and metadata.
     * Outputs: true when segment represents escape/interplanetary intercept work.
     */
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

    /**
     * Inputs: route segment, body lookup, and metadata.
     * Outputs: true when escaping from a moon through its top-level host.
     */
    function _isMoonHostEscapeSegment(segment, bodies, meta) {
        if (segment.to.bodyId !== api.INTERPLANETARY_ID || segment.nodeKey !== 'escape') {
            return false;
        }

        const moonBody = bodies[segment.from.bodyId];
        const hostBody = bodies[segment.bodyId];
        const moonPrimaryNode = moonBody ? api.getNodeKeys(moonBody)[0] : null;
        return Boolean(
            moonBody
            && hostBody
            && moonBody.parent === hostBody.id
            && hostBody.parent === meta?.centralBody
            && segment.from.nodeKey === moonPrimaryNode
        );
    }

    /**
     * Inputs: route segment.
     * Outputs: true when segment captures from flyby/intercept to low orbit.
     */
    function _isFlybyCaptureSegment(segment) {
        return (
            segment.from.bodyId === segment.to.bodyId
            && segment.from.nodeKey === segment.primaryNodeKey
            && segment.to.nodeKey === 'orbit'
        );
    }

    /**
     * Inputs: route segment and metadata.
     * Outputs: true when segment moves between central low orbit and interplanetary space.
     */
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

    /**
     * Inputs: segment, branch result, route context, options, and body lookup.
     * Outputs: aerobrake zeroing decision and mode.
     */
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

    /**
     * Inputs: route segment, route context, and body lookup.
     * Outputs: true for moon-return segments that can aerobrake into atmospheric origin orbit.
     */
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
""",
    # Embedded site calculator source: src/calculator.js
    'src/calculator.js': r"""(function attachDeltaVCalculator(global) {
    /**
     * Inputs: route endpoints, calculation options, body lookup, and system metadata.
     * Outputs: full calculation result with total DV, breakdown, transfer angles, and debug data.
     * Purpose: public compatibility wrapper used by the UI to call the modular calculator.
     */
    function jscalculate(pointA, pointB, options = {}, bodies = {}, meta = {}) {
        const calculator = global.DeltaVCalc?.calculateRoute;
        if (typeof calculator !== 'function') {
            return {
                totalDV: 0,
                breakdown: [],
                transferAngles: {
                    arrive: null,
                    depart: null,
                    model: null,
                },
            };
        }
        return calculator(pointA, pointB, options, bodies, meta);
    }

    global.jscalculate = jscalculate;
})(typeof window !== 'undefined' ? window : globalThis);
""",
}

# Embedded default data pack. Use --pack to run the same formulas against a
# different compatible JSON file.
EMBEDDED_STOCK_PACK_JSON = r"""
{
  "meta": {
    "name": "Kerbol System",
    "pack": "stock",
    "centralBody": "kerbol",
    "originBody": "kerbin",
    "interplanetaryNode": {
      "id": "interplanetary",
      "label": "Interplanetary Space",
      "mapColour": "#c8c8d4"
    },
    "nodeModel": {
      "surfaceNodeKey": "land",
      "orbitNodeKey": "orbit",
      "flybyNodeKeys": [
        "flyby",
        "intercept"
      ],
      "lowOrbitAltitudeMeters": 10000,
      "flybyPeriapsisAltitudeMeters": 10000
    }
  },
  "bodies": [
    {
      "id": "kerbol",
      "label": "Kerbol",
      "parent": null,
      "moons": [
        "moho",
        "eve",
        "kerbin",
        "duna",
        "dres",
        "jool",
        "eeloo"
      ],
      "mapColour": "#FFD700",
      "orbit": {
        "sma": 0,
        "eccentricity": 0,
        "inclination": 0,
        "comment": "Central body, no orbit",
        "periapsisRadius": 0.0,
        "apoapsisRadius": 0.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 19700,
        "dvToLand": null
      },
      "nodes": {
        "orbit": 19700,
        "land": 67000
      },
      "physics": {
        "radius": 261600000,
        "mu": 1.1723328e+18,
        "atmosphereHeight": 0,
        "soiRadius": null,
        "hillSphereRadius": null
      }
    },
    {
      "id": "moho",
      "label": "Moho",
      "parent": "kerbol",
      "moons": [],
      "mapColour": "#A0522D",
      "orbit": {
        "sma": 5263138304,
        "eccentricity": 0.2,
        "inclination": 7.0,
        "longitudeOfAscendingNode": 70.0,
        "argumentOfPeriapsis": 15.0,
        "siderealPeriod": 2215754,
        "periapsisRadius": 4210510643.2000003,
        "apoapsisRadius": 6315765964.8
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 870,
        "dvToLand": 870
      },
      "nodes": {
        "intercept": 3280,
        "orbit": 2410,
        "land": 870
      },
      "physics": {
        "radius": 250000,
        "mu": 168609380000.0,
        "atmosphereHeight": 0,
        "soiRadius": 9646663.037111413,
        "hillSphereRadius": 15295768.068277122
      }
    },
    {
      "id": "eve",
      "label": "Eve",
      "parent": "kerbol",
      "moons": [
        "gilly"
      ],
      "mapColour": "#9B59B6",
      "orbit": {
        "sma": 9832684544,
        "eccentricity": 0.01,
        "inclination": 2.1,
        "longitudeOfAscendingNode": 15.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 5657995,
        "periapsisRadius": 9734357698.56,
        "apoapsisRadius": 9931011389.44
      },
      "surface": {
        "canAerobrake": true,
        "dvToOrbit": 8000,
        "dvToLand": 8000
      },
      "nodes": {
        "intercept": 520,
        "orbit": 1410,
        "land": 8000
      },
      "physics": {
        "radius": 700000,
        "mu": 8171730200000.0,
        "atmosphereHeight": 90000,
        "soiRadius": 85109364.46648951,
        "hillSphereRadius": 128930178.42229204
      }
    },
    {
      "id": "gilly",
      "label": "Gilly",
      "parent": "eve",
      "moons": [],
      "mapColour": "#8B7355",
      "orbit": {
        "sma": 31500000,
        "eccentricity": 0.55,
        "inclination": 12.0,
        "longitudeOfAscendingNode": 80.0,
        "argumentOfPeriapsis": 10.0,
        "siderealPeriod": 388587,
        "periapsisRadius": 14174999.999999998,
        "apoapsisRadius": 48825000.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 30,
        "dvToLand": 30
      },
      "nodes": {
        "intercept": 660,
        "orbit": 410,
        "land": 30
      },
      "parentAerobrake": "eve",
      "transferAngleDiagram": "eve",
      "physics": {
        "radius": 13000,
        "mu": 8289449.8,
        "atmosphereHeight": 0,
        "soiRadius": 126123.27179534175,
        "hillSphereRadius": 98753.6625210987
      }
    },
    {
      "id": "kerbin",
      "label": "Kerbin",
      "parent": "kerbol",
      "moons": [
        "mun",
        "minmus"
      ],
      "mapColour": "#4A90D9",
      "orbit": {
        "sma": 13599840256,
        "eccentricity": 0.0,
        "inclination": 0.0,
        "longitudeOfAscendingNode": 0.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 9203545,
        "periapsisRadius": 13599840256.0,
        "apoapsisRadius": 13599840256.0
      },
      "surface": {
        "canAerobrake": true,
        "dvToOrbit": 3400,
        "dvToLand": 3400
      },
      "nodes": {
        "flyby": 3400,
        "orbit": 950,
        "land": 3400
      },
      "physics": {
        "radius": 600000,
        "mu": 3531600000000.0,
        "atmosphereHeight": 70000,
        "soiRadius": 84159286.33124468,
        "hillSphereRadius": 136186351.88639668
      }
    },
    {
      "id": "mun",
      "label": "Mun",
      "parent": "kerbin",
      "moons": [],
      "mapColour": "#AAAAAA",
      "orbit": {
        "sma": 12000000,
        "eccentricity": 0.0,
        "inclination": 0.0,
        "longitudeOfAscendingNode": 0.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 138984,
        "periapsisRadius": 12000000.0,
        "apoapsisRadius": 12000000.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 580,
        "dvToLand": 580
      },
      "nodes": {
        "intercept": 860,
        "orbit": 310,
        "land": 580
      },
      "baseTransferCost": 3400,
      "phaseAngles": {
        "arrive": 90,
        "depart": null
      },
      "physics": {
        "radius": 200000,
        "mu": 65138398000.0,
        "atmosphereHeight": 0,
        "soiRadius": 2429559.123714396,
        "hillSphereRadius": 2198345.8415387743
      }
    },
    {
      "id": "minmus",
      "label": "Minmus",
      "parent": "kerbin",
      "moons": [],
      "mapColour": "#88CCAA",
      "orbit": {
        "sma": 47000000,
        "eccentricity": 0.0,
        "inclination": 6.0,
        "longitudeOfAscendingNode": 78.0,
        "argumentOfPeriapsis": 38.0,
        "siderealPeriod": 1077311,
        "periapsisRadius": 47000000.0,
        "apoapsisRadius": 47000000.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 180,
        "dvToLand": 180
      },
      "nodes": {
        "intercept": 1170,
        "orbit": 160,
        "land": 180
      },
      "baseTransferCost": 3400,
      "phaseAngles": {
        "arrive": 90,
        "depart": null
      },
      "physics": {
        "radius": 60000,
        "mu": 1765800000.0,
        "atmosphereHeight": 0,
        "soiRadius": 2247428.3745065867,
        "hillSphereRadius": 2586509.6783007914
      }
    },
    {
      "id": "duna",
      "label": "Duna",
      "parent": "kerbol",
      "moons": [
        "ike"
      ],
      "mapColour": "#C1440E",
      "orbit": {
        "sma": 20726155264,
        "eccentricity": 0.051,
        "inclination": 0.06,
        "longitudeOfAscendingNode": 135.5,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 17315400,
        "periapsisRadius": 19669121345.536,
        "apoapsisRadius": 21783189182.463997
      },
      "surface": {
        "canAerobrake": true,
        "dvToOrbit": 1450,
        "dvToLand": 1450
      },
      "nodes": {
        "intercept": 140,
        "orbit": 610,
        "land": 1450
      },
      "physics": {
        "radius": 320000,
        "mu": 301363210000.0,
        "atmosphereHeight": 50000,
        "soiRadius": 47921949.1596144,
        "hillSphereRadius": 86714351.48289
      }
    },
    {
      "id": "ike",
      "label": "Ike",
      "parent": "duna",
      "moons": [],
      "mapColour": "#888888",
      "orbit": {
        "sma": 3200000,
        "eccentricity": 0.03,
        "inclination": 0.2,
        "longitudeOfAscendingNode": 0.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 65518,
        "periapsisRadius": 3104000.0,
        "apoapsisRadius": 3296000.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 390,
        "dvToLand": 390
      },
      "nodes": {
        "intercept": 420,
        "orbit": 180,
        "land": 390
      },
      "parentAerobrake": "duna",
      "transferAngleDiagram": "duna",
      "physics": {
        "radius": 130000,
        "mu": 18568369000.0,
        "atmosphereHeight": 0,
        "soiRadius": 1049598.9517146116,
        "hillSphereRadius": 850046.0807189175
      }
    },
    {
      "id": "dres",
      "label": "Dres",
      "parent": "kerbol",
      "moons": [],
      "mapColour": "#9B9B7A",
      "orbit": {
        "sma": 40839348203,
        "eccentricity": 0.145,
        "inclination": 5.0,
        "longitudeOfAscendingNode": 280.0,
        "argumentOfPeriapsis": 90.0,
        "siderealPeriod": 47893063,
        "periapsisRadius": 34917642713.565,
        "apoapsisRadius": 46761053692.435
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 430,
        "dvToLand": 430
      },
      "nodes": {
        "intercept": 1620,
        "orbit": 1290,
        "land": 430
      },
      "physics": {
        "radius": 138000,
        "mu": 21484489000.0,
        "atmosphereHeight": 0,
        "soiRadius": 32832839.763400655,
        "hillSphereRadius": 63830640.571476504
      }
    },
    {
      "id": "jool",
      "label": "Jool",
      "parent": "kerbol",
      "moons": [
        "laythe",
        "vall",
        "tylo",
        "bop",
        "pol"
      ],
      "mapColour": "#5B8C3E",
      "orbit": {
        "sma": 68773560320,
        "eccentricity": 0.05,
        "inclination": 1.304,
        "longitudeOfAscendingNode": 52.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 104661432,
        "periapsisRadius": 65334882304.0,
        "apoapsisRadius": 72212238336.0
      },
      "surface": {
        "canAerobrake": true,
        "dvToOrbit": 14000,
        "dvToLand": 14000
      },
      "nodes": {
        "intercept": 1250,
        "orbit": 2970,
        "land": 14000
      },
      "physics": {
        "radius": 6000000,
        "mu": 282528000000000.0,
        "atmosphereHeight": 200000,
        "soiRadius": 2455985166.4543757,
        "hillSphereRadius": 2819085327.580729
      }
    },
    {
      "id": "laythe",
      "label": "Laythe",
      "parent": "jool",
      "moons": [],
      "mapColour": "#4A7FA5",
      "orbit": {
        "sma": 27184000,
        "eccentricity": 0.0,
        "inclination": 0.0,
        "longitudeOfAscendingNode": 0.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 52981,
        "periapsisRadius": 27184000.0,
        "apoapsisRadius": 27184000.0
      },
      "surface": {
        "canAerobrake": true,
        "dvToOrbit": 2900,
        "dvToLand": 2900
      },
      "nodes": {
        "intercept": 2340,
        "orbit": 1070,
        "land": 2900
      },
      "parentAerobrake": "jool",
      "transferAngleDiagram": "jool",
      "physics": {
        "radius": 500000,
        "mu": 1962000000000.0,
        "atmosphereHeight": 50000,
        "soiRadius": 3723645.8111330215,
        "hillSphereRadius": 3595992.5163919614
      }
    },
    {
      "id": "vall",
      "label": "Vall",
      "parent": "jool",
      "moons": [],
      "mapColour": "#7EB8C9",
      "orbit": {
        "sma": 43152000,
        "eccentricity": 0.0,
        "inclination": 0.0,
        "longitudeOfAscendingNode": 0.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 105962,
        "periapsisRadius": 43152000.0,
        "apoapsisRadius": 43152000.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 860,
        "dvToLand": 860
      },
      "nodes": {
        "intercept": 2030,
        "orbit": 910,
        "land": 860
      },
      "parentAerobrake": "jool",
      "transferAngleDiagram": "jool",
      "physics": {
        "radius": 300000,
        "mu": 207481500000.0,
        "atmosphereHeight": 0,
        "soiRadius": 2406401.4615787165,
        "hillSphereRadius": 2699395.205521751
      }
    },
    {
      "id": "tylo",
      "label": "Tylo",
      "parent": "jool",
      "moons": [],
      "mapColour": "#C8B89A",
      "orbit": {
        "sma": 68500000,
        "eccentricity": 0.0,
        "inclination": 0.025,
        "longitudeOfAscendingNode": 0.0,
        "argumentOfPeriapsis": 0.0,
        "siderealPeriod": 211926,
        "periapsisRadius": 68500000.0,
        "apoapsisRadius": 68500000.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 2270,
        "dvToLand": 2270
      },
      "nodes": {
        "intercept": 1810,
        "orbit": 1100,
        "land": 2270
      },
      "parentAerobrake": "jool",
      "transferAngleDiagram": "jool",
      "physics": {
        "radius": 600000,
        "mu": 2825280000000.0,
        "atmosphereHeight": 0,
        "soiRadius": 10856518.368358627,
        "hillSphereRadius": 10232540.837972194
      }
    },
    {
      "id": "bop",
      "label": "Bop",
      "parent": "jool",
      "moons": [],
      "mapColour": "#8B7D6B",
      "orbit": {
        "sma": 128500000,
        "eccentricity": 0.235,
        "inclination": 15.0,
        "longitudeOfAscendingNode": 10.0,
        "argumentOfPeriapsis": 25.0,
        "siderealPeriod": 544507,
        "periapsisRadius": 98302500.0,
        "apoapsisRadius": 158697499.99999997
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 230,
        "dvToLand": 230
      },
      "nodes": {
        "intercept": 4070,
        "orbit": 900,
        "land": 230
      },
      "parentAerobrake": "jool",
      "transferAngleDiagram": "jool",
      "physics": {
        "radius": 65000,
        "mu": 2486834900.0,
        "atmosphereHeight": 0,
        "soiRadius": 1221060.861397352,
        "hillSphereRadius": 1407297.6552164224
      }
    },
    {
      "id": "pol",
      "label": "Pol",
      "parent": "jool",
      "moons": [],
      "mapColour": "#C8B45A",
      "orbit": {
        "sma": 179890000,
        "eccentricity": 0.171,
        "inclination": 4.25,
        "longitudeOfAscendingNode": 2.0,
        "argumentOfPeriapsis": 15.0,
        "siderealPeriod": 901903,
        "periapsisRadius": 149128810.0,
        "apoapsisRadius": 210651190.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 130,
        "dvToLand": 130
      },
      "nodes": {
        "intercept": 2270,
        "orbit": 820,
        "land": 130
      },
      "parentAerobrake": "jool",
      "transferAngleDiagram": "jool",
      "physics": {
        "radius": 44000,
        "mu": 721702080.0,
        "atmosphereHeight": 0,
        "soiRadius": 1042138.8985134125,
        "hillSphereRadius": 1413470.0848778097
      }
    },
    {
      "id": "eeloo",
      "label": "Eeloo",
      "parent": "kerbol",
      "moons": [],
      "mapColour": "#C8D8E8",
      "orbit": {
        "sma": 90118820000,
        "eccentricity": 0.26,
        "inclination": 6.15,
        "longitudeOfAscendingNode": 50.0,
        "argumentOfPeriapsis": 260.0,
        "siderealPeriod": 156992048,
        "periapsisRadius": 66687926800.0,
        "apoapsisRadius": 113549713200.0
      },
      "surface": {
        "canAerobrake": false,
        "dvToOrbit": 620,
        "dvToLand": 620
      },
      "nodes": {
        "intercept": 2470,
        "orbit": 1370,
        "land": 620
      },
      "physics": {
        "radius": 210000,
        "mu": 74410815000.0,
        "atmosphereHeight": 0,
        "soiRadius": 119082941.74060374,
        "hillSphereRadius": 184445690.72137803
      }
    }
  ],
  "transferConfig": {
    "originBody": "kerbin",
    "lkoAltitude": 80000,
    "lkoVelocity": 2246,
    "ejectionDV": 4350,
    "kerbinMoonBaseCost": 3400
  }
}
""".strip()


def _embedded_calculator_sources() -> dict[str, str]:
    """Inputs: none. Outputs: readable embedded calculator sources keyed by site path."""
    return {path: CALCULATOR_SOURCES[path] for path in CALCULATOR_SOURCE_ORDER}


def _load_pack(pack_path: str | None) -> tuple[dict[str, Any], str]:
    """Inputs: optional JSON path. Outputs: parsed pack and display source label."""
    if pack_path:
        path = Path(pack_path).expanduser().resolve()
        return json.loads(path.read_text(encoding="utf-8")), str(path)

    return json.loads(EMBEDDED_STOCK_PACK_JSON), EMBEDDED_PACK_NAME


def _build_options(args: argparse.Namespace) -> dict[str, Any]:
    """Inputs: parsed CLI args. Outputs: options object matching the site calculator."""
    return {
        "ipsBranchDV": args.ips_branch_dv,
        "roundTrip": args.round_trip,
        "returnOnly": args.return_only,
        "aeroLowOrbitDest": args.aero_low_orbit_dest,
        "aeroInterceptDest": args.aero_intercept_dest,
        "aeroLowOrbitOrigin": args.aero_low_orbit_origin,
        "aeroInterceptOrigin": args.aero_intercept_origin,
        "redundancyMultiplier": args.redundancy_multiplier,
    }


def _run_site_calculator(
    pack: dict[str, Any],
    pack_label: str,
    origin_body: str,
    origin_node: str,
    options: dict[str, Any],
) -> dict[str, Any]:
    """Inputs: pack, origin, and options. Outputs: rows from the embedded JS calculator."""
    js = r"""
const vm = require('vm');

const calculatorSources = __CALCULATOR_SOURCES__;
const sourceOrder = __CALCULATOR_SOURCE_ORDER__;
for (const file of sourceOrder) {
  vm.runInThisContext(calculatorSources[file], { filename: file });
}

const pack = __PACK__;
const bodies = Object.fromEntries(pack.bodies.map((body) => [body.id, body]));
const meta = pack.meta;
const origin = { body: __ORIGIN_BODY_ID__, node: __ORIGIN_NODE_KEY__ };
const options = __OPTIONS__;

function roundSiteTotal(subtotal, redundancyMultiplier) {
  return Math.round((subtotal * redundancyMultiplier) / 10) * 10;
}

function routeRows() {
  return pack.bodies
    .filter((body) => (
      body.id !== meta.centralBody
      && body.id !== origin.body
      && Object.prototype.hasOwnProperty.call(body.nodes || {}, 'land')
    ))
    .map((target) => {
      const pointB = { body: target.id, node: 'land' };
      const result = jscalculate(origin, pointB, options, bodies, meta);
      const breakdownSubtotal = result.breakdown.reduce((sum, item) => sum + item.dv, 0);
      const roundedSubtotal = roundSiteTotal(breakdownSubtotal, result.debug?.options?.redundancyMultiplier ?? 1);

      return {
        bodyId: target.id,
        label: target.label,
        pointA: origin,
        pointB,
        totalDV: result.totalDV,
        breakdownSubtotal,
        roundedSubtotal,
        roundingDifference: result.totalDV - breakdownSubtotal,
        breakdown: result.breakdown.map((item) => ({
          label: item.label,
          dv: item.dv,
          rawDv: item.rawDv,
          type: item.type,
          markerBodyId: item.markerBodyId,
          zeroed: item.zeroed,
          aerobrake: item.aerobrake,
        })),
        debugSegments: (result.debug?.route?.segments || []).map((item) => ({
          branchType: item.branchType,
          dv: item.dv,
          bodyId: item.segment?.bodyId,
          nodeKey: item.segment?.nodeKey,
          source: item.debug?.source,
          budgetModel: item.debug?.budgetModel || null,
          aerobrake: item.debug?.aerobrake || null,
          rawDv: item.debug?.rawDv,
        })),
      };
    });
}

console.log(JSON.stringify({
  packName: pack.meta?.name || null,
  packLabel: __PACK_LABEL__,
  origin,
  options,
  rows: routeRows(),
}, null, 2));
"""
    js = (
        js
        .replace("__CALCULATOR_SOURCES__", json.dumps(_embedded_calculator_sources()))
        .replace("__CALCULATOR_SOURCE_ORDER__", json.dumps(CALCULATOR_SOURCE_ORDER))
        .replace("__PACK__", json.dumps(pack))
        .replace("__PACK_LABEL__", json.dumps(pack_label))
        .replace("__ORIGIN_BODY_ID__", json.dumps(origin_body))
        .replace("__ORIGIN_NODE_KEY__", json.dumps(origin_node))
        .replace("__OPTIONS__", json.dumps(options))
    )

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as temp_file:
            temp_file.write(js)
            temp_path = temp_file.name

        result = subprocess.run(
            ["node", temp_path],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise SystemExit("Node.js is required to run this standalone calculator report.") from exc
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(exc.stderr)
        raise SystemExit(exc.returncode) from exc
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)

    return json.loads(result.stdout)

def format_dv(value: float) -> str:
    """Inputs: numeric delta-v. Outputs: display string rounded to one decimal where needed."""
    rounded = round(float(value), 1)
    if abs(rounded - round(rounded)) < 0.05:
        return f"{round(rounded):,} m/s"
    return f"{rounded:,.1f} m/s"


def _body_label(pack: dict[str, Any], body_id: str) -> str:
    """Inputs: pack and body id. Outputs: human-readable body label fallback."""
    for body in pack.get("bodies", []):
        if body.get("id") == body_id:
            return str(body.get("label") or body_id)
    return body_id


def print_actual_breakdowns(report: dict[str, Any], pack: dict[str, Any]) -> None:
    """Inputs: report rows and pack. Outputs: prints per-target site calculator breakdowns."""
    origin = report["origin"]
    origin_label = _body_label(pack, origin["body"])
    origin_node = "Surface" if origin["node"] == "land" else origin["node"]

    print("Site calculation breakdowns")
    print("===========================")
    print(f"Origin: {origin_label} {origin_node}")
    print(f"Data:   {report['packLabel']}")
    print()

    for row in report["rows"]:
        print(f"{row['label']} Surface")
        print("-" * (len(row["label"]) + len(" Surface")))
        for item in row["breakdown"]:
            raw_note = ""
            if item.get("rawDv") is not None and abs(float(item["rawDv"]) - float(item["dv"])) >= 0.05:
                raw_note = f"  raw {format_dv(item['rawDv'])}"
            print(f"  {item['label']:<24} {format_dv(item['dv']):>12}{raw_note}")
        print(f"  {'Subtotal':<24} {format_dv(row['breakdownSubtotal']):>12}")
        print(f"  {'Site total':<24} {format_dv(row['totalDV']):>12}")
        print()


def print_total_summary(report: dict[str, Any]) -> None:
    """Inputs: report rows. Outputs: prints site totals and subtotal rounding checks."""
    print("Site total summary")
    print("==================")
    print(f"{'Target':<12} {'Subtotal':>14} {'Site total':>14} {'Rounding':>14}")
    print("-" * 58)

    for row in report["rows"]:
        print(
            f"{row['label']:<12} "
            f"{format_dv(row['breakdownSubtotal']):>14} "
            f"{format_dv(row['totalDV']):>14} "
            f"{format_dv(row['roundingDifference']):>14}"
        )


def print_branch_debug(report: dict[str, Any]) -> None:
    """Inputs: report rows. Outputs: prints site branch types and formula sources."""
    print()
    print("Site branch debug")
    print("=================")

    for row in report["rows"]:
        print(f"{row['label']} Surface branches")
        print("-" * (len(row["label"]) + len(" Surface branches")))
        for item in row["debugSegments"]:
            model = f", {item['budgetModel']}" if item.get("budgetModel") else ""
            print(
                f"  {item['branchType']:<24} "
                f"{format_dv(item['dv']):>12}  "
                f"{item['source']}{model}"
            )
        print()


def parse_args() -> argparse.Namespace:
    """Inputs: CLI argv. Outputs: parsed options."""
    parser = argparse.ArgumentParser(
        description="Run the embedded Delta-V Calculator formula report from any directory.",
    )
    parser.add_argument("--pack", help="Optional compatible JSON pack path. Defaults to embedded stock.json.")
    parser.add_argument("--origin-body", default=None, help="Origin body id. Defaults to pack meta.originBody or kerbin.")
    parser.add_argument("--origin-node", default=DEFAULT_SURFACE_NODE_KEY, help="Origin node key. Defaults to land.")
    parser.add_argument("--ips-branch-dv", type=float, default=DEFAULT_IPS_BRANCH_DV)
    parser.add_argument("--redundancy-multiplier", type=float, default=1)
    parser.add_argument("--round-trip", action="store_true")
    parser.add_argument("--return-only", action="store_true")
    parser.add_argument("--aero-low-orbit-dest", action="store_true")
    parser.add_argument("--aero-intercept-dest", action="store_true")
    parser.add_argument("--aero-low-orbit-origin", action="store_true")
    parser.add_argument("--aero-intercept-origin", action="store_true")
    parser.add_argument("--json", action="store_true", help="Print machine-readable report JSON instead of text.")
    return parser.parse_args()


def main() -> None:
    """Inputs: CLI args. Outputs: standalone site-calculation report."""
    args = parse_args()
    pack, pack_label = _load_pack(args.pack)
    origin_body = args.origin_body or pack.get("meta", {}).get("originBody") or DEFAULT_ORIGIN_BODY_ID
    options = _build_options(args)
    report = _run_site_calculator(pack, pack_label, origin_body, args.origin_node, options)

    if args.json:
        print(json.dumps(report, indent=2))
        return

    print_actual_breakdowns(report, pack)
    print_total_summary(report)
    print_branch_debug(report)


if __name__ == "__main__":
    main()
