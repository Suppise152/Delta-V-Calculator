(function attachMapPositionHelpers(global) {
    /**
     * Inputs: position map, x/y offsets, and keys to leave unchanged.
     * Outputs: shifted copy of the position map.
     */
    function _shiftPositions(positions, dx, dy = 0, excludeKeys = []) {
        return Object.fromEntries(Object.entries(positions).map(([key, pos]) => {
            if (excludeKeys.includes(key)) return [key, { ...pos }];
            return [key, { x: pos.x + dx, y: pos.y + dy }];
        }));
    }

    function _shiftBodyPositions(positions, bodyIds, dx, dy = 0) {
        bodyIds.forEach((bodyId) => {
            Object.keys(positions).forEach((key) => {
                if (key === bodyId || key.startsWith(`${bodyId}_`)) {
                    positions[key] = { x: positions[key].x + dx, y: positions[key].y + dy };
                }
            });
        });
    }

    global.DeltaVMapPositionHelpers = { _shiftPositions, _shiftBodyPositions };
})(window);
