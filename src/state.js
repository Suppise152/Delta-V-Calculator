(function attachDeltaVState(global) {
    let _calculationResult = null;
    let _calculationOptions = null;

    /**
     * Inputs: latest calculation result and optional options snapshot.
     * Outputs: mutates shared app state.
     */
    function setCalculationState(result, options = null) {
        _calculationResult = result ? { ...result } : null;
        _calculationOptions = options ? { ...options } : null;
    }

    /**
     * Inputs: none.
     * Outputs: clears shared calculation result and options state.
     */
    function clearCalculationState() {
        _calculationResult = null;
        _calculationOptions = null;
    }

    /**
     * Inputs: none.
     * Outputs: current calculation result copy or null.
     */
    function getCalculationResult() {
        return _calculationResult ? { ..._calculationResult } : null;
    }

    /**
     * Inputs: none.
     * Outputs: current calculation options copy or null.
     */
    function getCalculationOptions() {
        return _calculationOptions ? { ..._calculationOptions } : null;
    }

    global.setCalculationState = setCalculationState;
    global.clearCalculationState = clearCalculationState;
    global.getCalculationResult = getCalculationResult;
    global.getCalculationOptions = getCalculationOptions;
})(typeof window !== 'undefined' ? window : globalThis);
