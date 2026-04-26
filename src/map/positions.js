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

    const OPM_POSITIONS = {
        ...STOCK_POSITIONS,
        plock_intercept: { x: 550, y: 300 },
        plock_orbit: { x: 700, y: 300 },
        plock_land: { x: 850, y: 300 },
        plock_label: { x: 890, y: 300 },
    };

    const RSS_POSITIONS = {
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
            viewBox: DEFAULT_VIEW_BOX,
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
