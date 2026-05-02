(function attachDeltaVCalcSegmentTypes(global) {
    const api = global.DeltaVCalc = global.DeltaVCalc || {};
    const INTERPLANETARY_ID = 'interplanetary';
    const DEFAULT_IPS_BRANCH_DV = 1000;

    function emptyResult() {
        return {
            totalDV: 0,
            breakdown: [],
            transferAngles: {
                arrive: null,
                depart: null,
            },
        };
    }

    function getNodeKeys(body) {
        return Object.keys(body?.nodes || {}).filter((key) => key !== 'comment');
    }

    function isValidPoint(point, bodies) {
        if (!point?.body) return false;
        if (point.body === INTERPLANETARY_ID) return true;

        const body = bodies[point.body];
        if (!body) return false;

        return getNodeKeys(body).includes(point.node);
    }

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

    function getBodyPhysics(body) {
        return body?.physics || null;
    }

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

    function getFlybyPeriapsisAltitude(body, meta) {
        const nodeModel = getNodeModel(meta);
        const physics = getBodyPhysics(body);
        const atmosphereHeight = Number(physics?.atmosphereHeight) || 0;
        return Math.max(
            Number(nodeModel.flybyPeriapsisAltitudeMeters) || 0,
            atmosphereHeight + (Number(nodeModel.flybyPeriapsisAltitudeMeters) || 0),
        );
    }

    function getPhysicalRadius(body, altitudeMeters) {
        const physics = getBodyPhysics(body);
        if (!physics) return null;
        return (Number(physics.radius) || 0) + (Number(altitudeMeters) || 0);
    }

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

    function stateId(bodyId, nodeKey) {
        return `${bodyId}::${nodeKey}`;
    }

    function parseStateId(value) {
        if (value === INTERPLANETARY_ID) {
            return { bodyId: INTERPLANETARY_ID, nodeKey: null };
        }

        const [bodyId, nodeKey] = String(value).split('::');
        return { bodyId, nodeKey: nodeKey || null };
    }

    function resolveMarkerBodyId(body, nodeKey) {
        if (!body) return null;

        if (nodeKey === 'intercept' || nodeKey === 'flyby') {
            return body.parent || body.id;
        }

        return body.id;
    }

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
