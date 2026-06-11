(function attachMapPositions(global) {
    const STOCK_POSITIONS = {
        interplanetary: { x: 493, y: 488 },

        kerbol_orbit: { x: 215, y: 490 },
        kerbol_land: { x: 55, y: 490 },
        kerbol_label: { x: -25, y: 488 },

        moho_intercept: { x: 325, y: 401 },
        moho_orbit: { x: 185, y: 401 },
        moho_land: { x: 55, y: 401 },
        moho_label: { x: -10, y: 401 },

        eve_intercept: { x: 360, y: 333 },
        eve_orbit: { x: 200, y: 333 },
        eve_land: { x: 55, y: 333 },
        eve_label: { x: -5, y: 333 },

        gilly_intercept: { x: 280, y: 251 },
        gilly_orbit: { x: 165, y: 251 },
        gilly_land: { x: 75, y: 251 },
        gilly_label: { x: 0, y: 251 },

        kerbin_flyby: { x: 493, y: 570 },
        kerbin_orbit: { x: 493, y: 641 },
        kerbin_land: { x: 493, y: 712 },
        kerbin_label: { x: 470, y: 765 },

        mun_intercept: { x: 370, y: 606 },
        mun_orbit: { x: 260, y: 606 },
        mun_land: { x: 150, y: 606 },
        mun_label: { x: 95, y: 606 },

        minmus_intercept: { x: 616, y: 606 },
        minmus_orbit: { x: 725, y: 606 },
        minmus_land: { x: 835, y: 606 },
        minmus_label: { x: 870, y: 606 },

        duna_intercept: { x: 310, y: 171 },
        duna_orbit: { x: 170, y: 171 },
        duna_land: { x: 55, y: 171 },
        duna_label: { x: -15, y: 171 },

        ike_intercept: { x: 230, y: 90 },
        ike_orbit: { x: 155, y: 90 },
        ike_land: { x: 75, y: 90 },
        ike_label: { x: 10, y: 90 },

        dres_intercept: { x: 470, y: 189 },
        dres_orbit: { x: 240, y: 26 },
        dres_land: { x: 55, y: 26 },
        dres_label: { x: -10, y: 26 },

        jool_intercept: { x: 630, y: 256 },
        jool_orbit: { x: 880, y: 256 },
        jool_land: { x: 920, y: 355 },
        jool_label: { x: 950, y: 355 },

        laythe_intercept: { x: 880, y: 200 },
        laythe_orbit: { x: 910, y: 110 },
        laythe_land: { x: 910, y: 32 },
        laythe_label: { x: 890, y: -10 },

        vall_intercept: { x: 818, y: 180 },
        vall_orbit: { x: 836, y: 105 },
        vall_land: { x: 836, y: 32 },
        vall_label: { x: 816, y: -10 },

        tylo_intercept: { x: 756, y: 180 },
        tylo_orbit: { x: 756, y: 109 },
        tylo_land: { x: 756, y: 32 },
        tylo_label: { x: 736, y: -10 },

        bop_intercept: { x: 694, y: 180 },
        bop_orbit: { x: 678, y: 107 },
        bop_land: { x: 678, y: 32 },
        bop_label: { x: 668, y: -10 },

        pol_intercept: { x: 630, y: 200 },
        pol_orbit: { x: 600, y: 108 },
        pol_land: { x: 600, y: 32 },
        pol_label: { x: 590, y: -10 },

        eeloo_intercept: { x: 705, y: 490 },
        eeloo_orbit: { x: 825, y: 490 },
        eeloo_land: { x: 960, y: 490 },
        eeloo_label: { x: 1000, y: 490 },
    };

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

    const OPM_POSITIONS = {
        ..._shiftPositions(STOCK_POSITIONS, -500),

        jool_intercept: { x: 80, y: 256 },
        jool_orbit: { x: 330, y: 256 },
        jool_land: { x: 400, y: 180 },
        jool_label: { x: 385, y: 140 },

        laythe_intercept: { x: 330, y: 190 },
        laythe_orbit: { x: 330, y: 110 },
        laythe_land: { x: 330, y: 32 },
        laythe_label: { x: 330, y: -10 },

        vall_intercept: { x: 268, y: 180 },
        vall_orbit: { x: 268, y: 105 },
        vall_land: { x: 268, y: 32 },
        vall_label: { x: 268, y: -10 },

        tylo_intercept: { x: 206, y: 180 },
        tylo_orbit: { x: 206, y: 109 },
        tylo_land: { x: 206, y: 32 },
        tylo_label: { x: 206, y: -10 },

        bop_intercept: { x: 144, y: 180 },
        bop_orbit: { x: 144, y: 107 },
        bop_land: { x: 144, y: 32 },
        bop_label: { x: 144, y: -10 },

        pol_intercept: { x: 80, y: 190 },
        pol_orbit: { x: 80, y: 108 },
        pol_land: { x: 80, y: 32 },
        pol_label: { x: 80, y: -10 },

        sarnus_intercept: { x: 470, y: 260 },
        sarnus_orbit: { x: 720, y: 260 },
        sarnus_land: { x: 800, y: 190 },
        sarnus_label: { x: 780, y: 150 },

        tekto_intercept: { x: 720, y: 190 },
        tekto_orbit: { x: 720, y: 100 },
        tekto_land: { x: 720, y: 30 },
        tekto_label: { x: 705, y: -5 },

        slate_intercept: { x: 658, y: 180 },
        slate_orbit: { x: 658, y: 100 },
        slate_land: { x: 658, y: 30 },
        slate_label: { x: 640, y: -5 },

        eeloo_intercept: { x: 596, y: 180 },
        eeloo_orbit: { x: 596, y: 100 },
        eeloo_land: { x: 596, y: 30 },
        eeloo_label: { x: 580, y: -5 },

        ovok_intercept: { x: 534, y: 180 },
        ovok_orbit: { x: 534, y: 100 },
        ovok_land: { x: 534, y: 30 },
        ovok_label: { x: 525, y: -5 },

        hale_intercept: { x: 472, y: 190 },
        hale_orbit: { x: 472, y: 100 },
        hale_land: { x: 472, y: 30 },
        hale_label: { x: 455, y: -5 },

        urlum_intercept: { x: 710, y: 360 },
        urlum_orbit: { x: 910, y: 360 },
        urlum_land: { x: 1050, y: 360 },
        urlum_label: { x: 1080, y: 360 },

        polta_intercept: { x: 776, y: 300 },
        polta_orbit: { x: 842, y: 240 },
        polta_land: { x: 940, y: 240 },
        polta_label: { x: 970, y: 240 },

        priax_intercept: { x: 842, y: 300 },
        priax_orbit: { x: 930, y: 300 },
        priax_land: { x: 1020, y: 300 },
        priax_label: { x: 1050, y: 300 },

        wal_intercept: { x: 810, y: 430 },
        wal_orbit: { x: 930, y: 430 },
        wal_land: { x: 1070, y: 430 },
        wal_label: { x: 1100, y: 430 },

        tal_intercept: { x: 870, y: 490 },
        tal_orbit: { x: 970, y: 490 },
        tal_land: { x: 1070, y: 490 },
        tal_label: { x: 1100, y: 490 },

        neidon_intercept: { x: 540, y: 460 },
        neidon_orbit: { x: 720, y: 460 },
        neidon_land: { x: 820, y: 570 },
        neidon_label: { x: 850, y: 570 },

        nissee_intercept: { x: 600, y: 550 },
        nissee_orbit: { x: 650, y: 670 },
        nissee_land: { x: 730, y: 710 },
        nissee_label: { x: 765, y: 710 },

        thatmo_intercept: { x: 660, y: 550 },
        thatmo_orbit: { x: 720, y: 620 },
        thatmo_land: { x: 800, y: 660 },
        thatmo_label: { x: 835, y: 660 },

        plock_intercept: { x: 500, y: 540 },
        plock_orbit: { x: 550, y: 630 },
        plock_land: { x: 550, y: 720 },
        plock_label: { x: 530, y: 760 },

        karen_intercept: { x: 465, y: 605 },
        karen_orbit: { x: 465, y: 685 },
        karen_land: { x: 465, y: 765 },
        karen_label: { x: 385, y: 765 },
    };

    const RSS_POSITIONS = {
        interplanetary: { x: OPM_POSITIONS.interplanetary.x, y: OPM_POSITIONS.interplanetary.y },

        sol_orbit: { x: 155, y: 490 },
        sol_land: { x: 5, y: 490 },
        sol_label: { x: -55, y: 490 },

        // ─── INNER PLANETS ─────────────────
        mercury_intercept: { x: 325, y: 420 },
        mercury_orbit: { x: 185, y: 420 },
        mercury_land: { x: 55, y: 420 },
        mercury_label: { x: -40, y: 420 },

        venus_intercept: { x: 360, y: 350 },
        venus_orbit: { x: 200, y: 350 },
        venus_land: { x: 55, y: 350 },
        venus_label: { x: -30, y: 350 },

        earth_flyby: { x: 493, y: 580 },
        earth_orbit: { x: 493, y: 650 },
        earth_land: { x: 493, y: 720 },
        earth_label: { x: 475, y: 770 },

        moon_intercept: { x: 370, y: 615 },
        moon_orbit: { x: 260, y: 615 },
        moon_land: { x: 150, y: 615 },
        moon_label: { x: 85, y: 615 },

        mars_intercept: { x: 370, y: 200 },
        mars_orbit: { x: 170, y: 200 },
        mars_land: { x: 55, y: 200 },
        mars_label: { x: -15, y: 200 },

        phobos_intercept: { x: 270, y: 130 },
        phobos_orbit: { x: 170, y: 130 },
        phobos_land: { x: 100, y: 130 },
        phobos_label: { x: 20, y: 130 },

        deimos_intercept: { x: 270, y: 270 },
        deimos_orbit: { x: 170, y: 270 },
        deimos_land: { x: 100, y: 270 },
        deimos_label: { x: 20, y: 270 },

        ceres_intercept: { x: 430, y: 160 },
        ceres_orbit: { x: 300, y: 70 },
        ceres_land: { x: 120, y: 70 },
        ceres_label: { x: 40, y: 70 },

        vesta_intercept: { x: 510, y: 160 },
        vesta_orbit: { x: 300, y: 15 },
        vesta_land: { x: 120, y: 15 },
        vesta_label: { x: 40, y: 15 },

        jupiter_intercept: { x: 80, y: 256 },
        jupiter_orbit: { x: 330, y: 256 },
        jupiter_land: { x: 400, y: 180 },
        jupiter_label: { x: 385, y: 140 },

        io_intercept: { x: 330, y: 190 },
        io_orbit: { x: 330, y: 110 },
        io_land: { x: 330, y: 32 },
        io_label: { x: 320, y: -10 },

        europa_intercept: { x: 246, y: 180 },
        europa_orbit: { x: 246, y: 105 },
        europa_land: { x: 246, y: 32 },
        europa_label: { x: 226, y: -10 },

        ganymede_intercept: { x: 163, y: 180 },
        ganymede_orbit: { x: 163, y: 109 },
        ganymede_land: { x: 163, y: 32 },
        ganymede_label: { x: 135, y: -10 },

        callisto_intercept: { x: 80, y: 190 },
        callisto_orbit: { x: 80, y: 107 },
        callisto_land: { x: 80, y: 32 },
        callisto_label: { x: 50, y: -10 },

        saturn_intercept: { x: 470, y: 260 },
        saturn_orbit: { x: 720, y: 260 },
        saturn_land: { x: 800, y: 190 },
        saturn_label: { x: 780, y: 150 },

        titan_intercept: { x: 720, y: 190 },
        titan_orbit: { x: 720, y: 100 },
        titan_land: { x: 720, y: 30 },
        titan_label: { x: 700, y: -10 },

        rhea_intercept: { x: 637, y: 180 },
        rhea_orbit: { x: 637, y: 100 },
        rhea_land: { x: 637, y: 30 },
        rhea_label: { x: 617, y: -10 },

        dione_intercept: { x: 554, y: 180 },
        dione_orbit: { x: 554, y: 100 },
        dione_land: { x: 554, y: 30 },
        dione_label: { x: 534, y: -10 },

        enceladus_intercept: { x: 470, y: 180 },
        enceladus_orbit: { x: 470, y: 100 },
        enceladus_land: { x: 470, y: 30 },
        enceladus_label: { x: 435, y: -10 },

        uranus_intercept: { x: 660, y: 390 },
        uranus_orbit: { x: 930, y: 390 },
        uranus_land: { x: 1080, y: 390 },
        uranus_label: { x: 1110, y: 390 },

        miranda_intercept: { x: 863, y: 450 },
        miranda_orbit: { x: 930, y: 450 },
        miranda_land: { x: 1020, y: 450 },
        miranda_label: { x: 1050, y: 450 },

        ariel_intercept: { x: 795, y: 450 },
        ariel_orbit: { x: 860, y: 520 },
        ariel_land: { x: 950, y: 520 },
        ariel_label: { x: 980, y: 520 },

        umbriel_intercept: { x: 727, y: 450 },
        umbriel_orbit: { x: 840, y: 590 },
        umbriel_land: { x: 930, y: 590 },
        umbriel_label: { x: 960, y: 590 },

        titania_intercept: { x: 760, y: 330 },
        titania_orbit: { x: 842, y: 270 },
        titania_land: { x: 940, y: 270 },
        titania_label: { x: 970, y: 270 },

        oberon_intercept: { x: 857, y: 330 },
        oberon_orbit: { x: 930, y: 330 },
        oberon_land: { x: 1020, y: 330 },
        oberon_label: { x: 1050, y: 330 },

        neptune_intercept: { x: 490, y: 520 },
        neptune_orbit: { x: 680, y: 520 },
        neptune_land: { x: 770, y: 640 },
        neptune_label: { x: 770, y: 680 },

        triton_intercept: { x: 580, y: 590 },
        triton_orbit: { x: 580, y: 660 },
        triton_land: { x: 650, y: 710 },
        triton_label: { x: 680, y: 710 },

        pluto_intercept: { x: 200, y: 600 },
        pluto_orbit: { x: 320, y: 600 },
        pluto_land: { x: 430, y: 600 },
        pluto_label: { x: 460, y: 600 },

        charon_intercept: { x: 265, y: 680 },
        charon_orbit: { x: 370, y: 680 },
        charon_land: { x: 450, y: 680 },
        charon_label: { x: 480, y: 680 },
    };

    _shiftBodyPositions(RSS_POSITIONS, [
        'sol',
        'mercury',
        'venus',
        'earth',
        'moon',
        'mars',
        'phobos',
        'deimos',
        'ceres',
        'vesta',
    ], -500);

    const DEFAULT_VIEW_BOX = '0 -25 1000 810';
    const MAP_LAYOUTS = {
        stock: {
            id: 'stock',
            label: 'Stock',
            viewBox: DEFAULT_VIEW_BOX,
            positions: STOCK_POSITIONS,
        },
        opm: {
            id: 'opm',
            label: 'OPM',
            viewBox: '-550 -25 1700 820',
            positions: OPM_POSITIONS,
        },
        rss: {
            id: 'rss',
            label: 'RSS',
            viewBox: '-610 -25 1780 820',
            positions: RSS_POSITIONS,
        },
    };

    /**
     * Inputs: map pack/layout id.
     * Outputs: matching layout descriptor, falling back to stock.
     */
    function getMapLayout(mapId) {
        return MAP_LAYOUTS[mapId] || MAP_LAYOUTS.stock;
    }

    /**
     * Inputs: none.
     * Outputs: all map layout descriptors as an array.
     */
    function getMapLayouts() {
        return Object.values(MAP_LAYOUTS);
    }

    global.DeltaVMapPositions = {
        STOCK_POSITIONS,
        OPM_POSITIONS,
        RSS_POSITIONS,
        getMapLayout,
        getMapLayouts,
    };
})(window);
