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

    function _shiftPositions(positions, dx, dy = 0, excludeKeys = []) {
        return Object.fromEntries(Object.entries(positions).map(([key, pos]) => {
            if (excludeKeys.includes(key)) return [key, { ...pos }];
            return [key, { x: pos.x + dx, y: pos.y + dy }];
        }));
    }

    const OPM_POSITIONS = {
        ..._shiftPositions(STOCK_POSITIONS, -200, 0, ['interplanetary']),

        // ─── SARNUS (Saturn analogue) ─────────────────
        sarnus_intercept: { x: 720, y: 180 },
        sarnus_orbit: { x: 880, y: 180 },
        sarnus_land: { x: 920, y: 260 },
        sarnus_label: { x: 950, y: 260 },

        tekto_intercept: { x: 880, y: 140 },
        tekto_orbit: { x: 910, y: 90 },
        tekto_land: { x: 910, y: 32 },
        tekto_label: { x: 890, y: 0 },

        urlum_intercept: { x: 830, y: 160 },
        urlum_orbit: { x: 850, y: 110 },
        urlum_land: { x: 850, y: 32 },
        urlum_label: { x: 830, y: 0 },

        // ─── URLUM (Uranus analogue) ─────────────────
        urlum_intercept: { x: 780, y: 320 },
        urlum_orbit: { x: 900, y: 320 },
        urlum_land: { x: 940, y: 380 },
        urlum_label: { x: 960, y: 380 },

        polta_intercept: { x: 900, y: 280 },
        polta_orbit: { x: 920, y: 200 },
        polta_land: { x: 920, y: 120 },
        polta_label: { x: 900, y: 100 },

        // ─── NEIDON (Neptune analogue) ───────────────
        neidon_intercept: { x: 820, y: 480 },
        neidon_orbit: { x: 920, y: 480 },
        neidon_land: { x: 960, y: 480 },
        neidon_label: { x: 980, y: 480 },

        thatmo_intercept: { x: 920, y: 440 },
        thatmo_orbit: { x: 940, y: 380 },
        thatmo_land: { x: 940, y: 320 },
        thatmo_label: { x: 920, y: 300 },

        // ─── PLOCK (Pluto analogue) ─────────────────
        plock_intercept: { x: 860, y: 580 },
        plock_orbit: { x: 940, y: 580 },
        plock_land: { x: 980, y: 580 },
        plock_label: { x: 1000, y: 580 },
    };

    const RSS_POSITIONS = {
        interplanetary: { x: 493, y: 488 },

        sun_orbit: { x: 215, y: 490 },
        sun_label: { x: -25, y: 488 },

        // ─── INNER PLANETS ─────────────────
        mercury_intercept: { x: 325, y: 420 },
        mercury_orbit: { x: 185, y: 420 },
        mercury_land: { x: 55, y: 420 },
        mercury_label: { x: -10, y: 420 },

        venus_intercept: { x: 360, y: 350 },
        venus_orbit: { x: 200, y: 350 },
        venus_land: { x: 55, y: 350 },
        venus_label: { x: -5, y: 350 },

        earth_flyby: { x: 493, y: 580 },
        earth_orbit: { x: 493, y: 650 },
        earth_land: { x: 493, y: 720 },
        earth_label: { x: 470, y: 770 },

        moon_intercept: { x: 370, y: 615 },
        moon_orbit: { x: 260, y: 615 },
        moon_land: { x: 150, y: 615 },
        moon_label: { x: 95, y: 615 },

        mars_intercept: { x: 310, y: 200 },
        mars_orbit: { x: 170, y: 200 },
        mars_land: { x: 55, y: 200 },
        mars_label: { x: -15, y: 200 },

        phobos_intercept: { x: 250, y: 150 },
        phobos_orbit: { x: 200, y: 120 },
        phobos_land: { x: 150, y: 100 },
        phobos_label: { x: 120, y: 90 },

        deimos_intercept: { x: 280, y: 160 },
        deimos_orbit: { x: 230, y: 140 },
        deimos_land: { x: 200, y: 120 },
        deimos_label: { x: 180, y: 110 },

        // ─── ASTEROID BELT ─────────────────
        ceres_intercept: { x: 470, y: 260 },
        ceres_orbit: { x: 300, y: 120 },
        ceres_land: { x: 120, y: 40 },
        ceres_label: { x: 80, y: 30 },

        // ─── GAS GIANTS ─────────────────
        jupiter_intercept: { x: 650, y: 260 },
        jupiter_orbit: { x: 880, y: 260 },
        jupiter_label: { x: 940, y: 260 },

        europa_intercept: { x: 820, y: 200 },
        europa_orbit: { x: 850, y: 140 },
        europa_land: { x: 850, y: 80 },
        europa_label: { x: 830, y: 60 },

        saturn_intercept: { x: 720, y: 180 },
        saturn_orbit: { x: 900, y: 180 },
        saturn_label: { x: 950, y: 180 },

        titan_intercept: { x: 880, y: 140 },
        titan_orbit: { x: 910, y: 90 },
        titan_land: { x: 910, y: 32 },
        titan_label: { x: 890, y: 0 },

        uranus_intercept: { x: 780, y: 350 },
        uranus_orbit: { x: 920, y: 350 },
        uranus_label: { x: 960, y: 350 },

        neptune_intercept: { x: 820, y: 480 },
        neptune_orbit: { x: 940, y: 480 },
        neptune_label: { x: 980, y: 480 },

        pluto_intercept: { x: 860, y: 580 },
        pluto_orbit: { x: 980, y: 580 },
        pluto_label: { x: 1020, y: 580 },
    };

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
            viewBox: '-200 -25 1200 810',
            positions: OPM_POSITIONS,
        },
        rss: {
            id: 'rss',
            label: 'RSS',
            viewBox: DEFAULT_VIEW_BOX,
            positions: RSS_POSITIONS,
        },
    };

    function getMapLayout(mapId) {
        return MAP_LAYOUTS[mapId] || MAP_LAYOUTS.stock;
    }

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
