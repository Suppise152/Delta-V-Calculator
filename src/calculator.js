(function attachDeltaVCalculator(global) {
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
