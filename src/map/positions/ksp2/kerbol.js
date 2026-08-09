(function attachKerbolMapPositions(global) {
    const { _shiftPositions } = global.DeltaVMapPositionHelpers;
    const STOCK_POSITIONS = global.DeltaVMapPositionData.stock;

    // KSP 2's Kerbol system reuses the KSP 1 Stock layout for now.
    const KERBOL_POSITIONS = _shiftPositions(STOCK_POSITIONS, 0, 0);

    // Placeholder positions for Dres' KSP 2 moons, roughly midway between
    // dres_orbit and dres_intercept. Reposition once the map is laid out.
    Object.assign(KERBOL_POSITIONS, {
        dres_intercept: { x: 470, y: 220 },
        dres_orbit: { x: 240, y: 26 },
        dres_land: { x: 55, y: 26 },
        dres_label: { x: -10, y: 26 },

        beyl_intercept: { x: 500, y: 150 },
        beyl_orbit: { x: 500, y: 80 },
        beyl_land: { x: 500, y: 20 },
        beyl_label: { x: 480, y: -15 },

        drast_intercept: { x: 440, y: 80 },
        drast_orbit: { x: 400, y: 20 },
        drast_land: { x: 340, y: 20 },
        drast_label: { x: 320, y: -15 },
    });

    global.DeltaVMapPositionData.kerbol = KERBOL_POSITIONS;
})(window);
