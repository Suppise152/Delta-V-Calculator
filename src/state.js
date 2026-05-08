(function attachDeltaVState(global) {
    let _calculationResult = null;
    let _calculationOptions = null;

    function setCalculationState(result, options = null) {
        _calculationResult = result ? { ...result } : null;
        _calculationOptions = options ? { ...options } : null;
    }

    function clearCalculationState() {
        _calculationResult = null;
        _calculationOptions = null;
    }

    function getCalculationResult() {
        return _calculationResult ? { ..._calculationResult } : null;
    }

    function getCalculationOptions() {
        return _calculationOptions ? { ..._calculationOptions } : null;
    }

    global.setCalculationState = setCalculationState;
    global.clearCalculationState = clearCalculationState;
    global.getCalculationResult = getCalculationResult;
    global.getCalculationOptions = getCalculationOptions;
})(typeof window !== 'undefined' ? window : globalThis);
